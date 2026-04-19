import React, {useEffect, useState, useMemo, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {gql} from '@apollo/client';
import {gqlQueryTyped, gqlMutate} from '../../api';
import {WcaCompetitionsDocument, WcaSearchCompetitionsDocument, MyWcaCompetitionsDocument} from '../../../@types/generated/graphql';
import {useMe} from '../../../util/hooks/useMe';
import {MagnifyingGlass, Trophy} from 'phosphor-react';
import {resourceUri} from '../../../util/storage';
import {LINKED_SERVICES} from '../../../../shared/integration';
import {b, I18N_LOCALE_MAP, formatDateRange} from './shared';
import {prefetchCompetitionDetail} from './CompetitionLoader';
import {useZktCompListRefetch} from '../zkt_competitions/useZktCompRefetch';

const ZKT_COMPETITIONS_QUERY = gql`
	query ZktCompetitionsForList($page: Int!, $pageSize: Int!, $searchQuery: String!) {
		zktCompetitions(page: $page, pageSize: $pageSize, searchQuery: $searchQuery) {
			items {
				id
				name
				date_start
				date_end
				location
				status
				championship_type
				events {
					id
					event_id
				}
			}
		}
	}
`;

function championshipBadgeKey(type: string | null | undefined): string | null {
	if (!type) return null;
	const map: Record<string, string> = {
		NATIONAL: 'zkt_comp.championship_badge_national',
		REGIONAL: 'zkt_comp.championship_badge_regional',
		CITY: 'zkt_comp.championship_badge_city',
		INVITATIONAL: 'zkt_comp.championship_badge_invitational',
		YOUTH: 'zkt_comp.championship_badge_youth',
	};
	return map[type] || null;
}

let cachedZktComps: {data: any[]; ts: number} | null = null;
function getZktCache(): any[] | null {
	if (!cachedZktComps) return null;
	if (Date.now() - cachedZktComps.ts > 30 * 60 * 1000) {
		cachedZktComps = null;
		return null;
	}
	return cachedZktComps.data;
}

// Module-level cache with TTL
const LIST_CACHE_TTL = 30 * 60 * 1000; // 30 dakika
let cachedCompetitions: {data: any[]; ts: number} | null = null;
let cachedMyComps: {data: any[]; ts: number} | null = null;

function getListCache(): any[] | null {
	if (!cachedCompetitions) return null;
	if (Date.now() - cachedCompetitions.ts > LIST_CACHE_TTL) { cachedCompetitions = null; return null; }
	return cachedCompetitions.data;
}
function getMyCache(): any[] | null {
	if (!cachedMyComps) return null;
	if (Date.now() - cachedMyComps.ts > LIST_CACHE_TTL) { cachedMyComps = null; return null; }
	return cachedMyComps.data;
}

export default function CompetitionList() {
	const {t, i18n} = useTranslation();
	const me = useMe();
	const history = useHistory();
	const locale = I18N_LOCALE_MAP[i18n.language] || i18n.language;

	const [competitions, setCompetitions] = useState<any[] | null>(getListCache());
	const [compSearch, setCompSearch] = useState('');
	const [searchResults, setSearchResults] = useState<any[] | null>(null);
	const [searching, setSearching] = useState(false);
	const [myComps, setMyComps] = useState<any[] | null>(getMyCache());
	const [zktComps, setZktComps] = useState<any[] | null>(getZktCache());
	const [loadError, setLoadError] = useState<string | null>(null);

	const filteredCompetitions = useMemo(() => {
		if (!competitions) return [];
		let list = competitions;
		if (compSearch.trim()) {
			const q = compSearch.toLowerCase();
			list = list.filter(
				(c: any) => c.name.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q)
			);
		}
		// Devam eden yarismalari listenin basina koy
		const now = new Date();
		const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		const ongoing = list.filter((c: any) => c.start_date <= today && c.end_date >= today);
		const rest = list.filter((c: any) => !(c.start_date <= today && c.end_date >= today));
		return [...ongoing, ...rest];
	}, [competitions, compSearch]);

	useEffect(() => {
		if (!getListCache()) fetchCompetitions();
		if (!getZktCache()) fetchZktCompetitions();
	}, []);

	// Live refresh: any ZKT competition create/update/delete → refetch list.
	useZktCompListRefetch(fetchZktCompetitions);

	useEffect(() => {
		if (me && !getMyCache()) fetchMyCompetitions();
	}, [me]);

	async function fetchZktCompetitions() {
		try {
			const res = await gqlMutate(ZKT_COMPETITIONS_QUERY, {
				page: 0,
				pageSize: 50,
				searchQuery: '',
			});
			const data = res?.data?.zktCompetitions?.items || [];
			cachedZktComps = {data, ts: Date.now()};
			setZktComps(data);
		} catch (err) {
			// sessiz — ZKT yarisma yoksa veya login degilse zaten bos gosterilecek
			setZktComps([]);
		}
	}

	// App resume / tab focus: arka planda sessiz refresh et — cached liste varken
	// kullanici yeni yarismalari gorebilsin, manuel aç/kapa gerekmesin
	useEffect(() => {
		const silentRefresh = () => {
			if (document.visibilityState !== 'visible') return;
			// Son fetch 2 dakikadan eskiyse tekrar dene (cok sik istek atma)
			const cache = cachedCompetitions;
			if (!cache || Date.now() - cache.ts > 2 * 60 * 1000) {
				fetchCompetitions();
			}
			if (me) {
				const myCache = cachedMyComps;
				if (!myCache || Date.now() - myCache.ts > 2 * 60 * 1000) {
					fetchMyCompetitions();
				}
			}
		};
		window.addEventListener('focus', silentRefresh);
		document.addEventListener('visibilitychange', silentRefresh);
		return () => {
			window.removeEventListener('focus', silentRefresh);
			document.removeEventListener('visibilitychange', silentRefresh);
		};
	}, [me]);

	// Prefetch: kullanicinin yarismalari + en yakin 3 yarisma
	useEffect(() => {
		if (!myComps || myComps.length === 0) return;
		// Kullanici yarismalari yuklenince ilk 3'unu prefetch et
		const targets = myComps.slice(0, 3);
		targets.forEach((c: any, i: number) => {
			setTimeout(() => prefetchCompetitionDetail(c.competitionId || c.id), 500 + i * 200);
		});
	}, [myComps]);

	useEffect(() => {
		if (!competitions || competitions.length === 0) return;
		// Genel listeden ilk 3 (genelde upcoming en yakin)
		const targets = competitions.slice(0, 3);
		targets.forEach((c: any, i: number) => {
			setTimeout(() => prefetchCompetitionDetail(c.id), 1500 + i * 300);
		});
	}, [competitions]);

	// Hover prefetch (web)
	const hoverTimerRef = useRef<any>(null);
	function handleHoverPrefetch(competitionId: string) {
		clearTimeout(hoverTimerRef.current);
		hoverTimerRef.current = setTimeout(() => prefetchCompetitionDetail(competitionId), 200);
	}
	function handleHoverLeave() {
		clearTimeout(hoverTimerRef.current);
	}

	async function fetchMyCompetitions() {
		try {
			const res = await gqlQueryTyped(MyWcaCompetitionsDocument, {});
			const data = res.data?.myWcaCompetitions || [];
			cachedMyComps = {data, ts: Date.now()};
			setMyComps(data);
		} catch (err) {
			console.warn('[CompetitionList] myWcaCompetitions fetch failed:', err);
			setMyComps([]);
		}
	}

	async function fetchCompetitions() {
		setLoadError(null);
		try {
			const res = await gqlQueryTyped(WcaCompetitionsDocument, {filter: {}}, {fetchPolicy: 'no-cache'});
			const data = res.data?.wcaCompetitions || [];
			if (data.length > 0) {
				// Sadece gercek data cache'lenir — bos dondugunde cache yazarsak 30 dk boyunca
				// "bulunamadi" kalir, kullanici her aç/kapa'da tekrar dener
				cachedCompetitions = {data, ts: Date.now()};
			} else {
				console.warn('[CompetitionList] wcaCompetitions returned empty array — cache yazilmadi');
			}
			setCompetitions(data);
		} catch (err: any) {
			console.warn('[CompetitionList] wcaCompetitions fetch failed:', err);
			setLoadError(err?.message || 'network_error');
			setCompetitions(null);
		}
	}

	function handleRetry() {
		setCompetitions(null);
		cachedCompetitions = null;
		fetchCompetitions();
	}

	const searchTimerRef = useRef<any>(null);
	function handleSearchChange(value: string) {
		setCompSearch(value);
		setSearchResults(null);

		if (value.trim().length >= 3) {
			clearTimeout(searchTimerRef.current);
			searchTimerRef.current = setTimeout(async () => {
				setSearching(true);
				try {
					const res = await gqlQueryTyped(WcaSearchCompetitionsDocument, {query: value.trim()}, {fetchPolicy: 'no-cache'});
					setSearchResults(res.data?.wcaSearchCompetitions || []);
				} catch {
					setSearchResults([]);
				}
				setSearching(false);
			}, 300);
		}
	}

	function handleSelectCompetition(compId: string) {
		history.push(`/community/competitions/${compId}`);
	}

	const showSearchResults = compSearch.trim().length >= 3 && searchResults;
	const displayList = showSearchResults ? searchResults : filteredCompetitions;

	const todayStr = useMemo(() => {
		const n = new Date();
		return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
	}, []);

	function renderCompCard(comp: any, opts: {mine?: boolean} = {}) {
		const isFinished = comp.end_date < todayStr;
		const isOngoing = comp.start_date <= todayStr && comp.end_date >= todayStr;
		return (
			<div
				key={comp.id}
				className={b('comp-card', {finished: isFinished, ongoing: isOngoing, mine: opts.mine})}
				onClick={() => handleSelectCompetition(comp.id)}
				onMouseEnter={() => handleHoverPrefetch(comp.id)}
				onMouseLeave={handleHoverLeave}
			>
				{comp.country_iso2 && (
					<span className={b('country-code')}>{comp.country_iso2}</span>
				)}
				<div className={b('comp-info')}>
					<span className={b('comp-title')}>{comp.name}</span>
					<span className={b('comp-sub')}>
						{formatDateRange(comp.start_date, comp.end_date, locale)}
						{comp.city && ` \u2013 ${comp.city}`}
					</span>
				</div>
				{isOngoing && (
					<span className={b('ongoing-badge')}>{t('my_schedule.ongoing')}</span>
				)}
			</div>
		);
	}

	return (
		<div className={b('content')}>
			<h1 className="sr-only">{t('seo.wca_competitions_title')}</h1>
			{/* WCA banner */}
			{((!me || (me && myComps !== null && myComps.length === 0)) && !compSearch.trim()) && (
				<div className={b('wca-banner')}>
					<img src={resourceUri('/images/logos/wca_logo.svg')} alt="WCA" className={b('wca-banner-logo')} />
					<div className={b('wca-banner-body')}>
						<h3 className={b('wca-banner-title')}>
							{!me ? t('my_schedule.wca_login') : t('my_schedule.connect_wca_btn')}
						</h3>
						<p className={b('wca-banner-desc')}>
							{!me ? t('my_schedule.login_description') : t('my_schedule.connect_wca_description')}
						</p>
						<button
							className={b('wca-banner-btn')}
							onClick={() => {
								const service = LINKED_SERVICES.wca;
								const params = new URLSearchParams({
									client_id: service.clientId,
									response_type: service.responseType,
									scope: service.scope.join(' '),
									redirect_uri: window.location.origin + (!me ? '/oauth/wca/login' : '/oauth/wca'),
									state: '/community/competitions',
								});
								window.location.href = `${service.authEndpoint}?${params.toString()}`;
							}}
						>
							{!me ? t('my_schedule.wca_login') : t('my_schedule.connect_wca_btn')}
						</button>
					</div>
				</div>
			)}

			{/* Benim Yarismalarin */}
			{!compSearch.trim() && myComps && myComps.length > 0 && (
				<div className={b('my-competitions')}>
					<h3 className={b('section-title')}>{t('my_schedule.my_competitions')}</h3>
					<div className={b('comp-list')}>
						{myComps.map((comp: any) => renderCompCard(comp, {mine: true}))}
					</div>
				</div>
			)}

			{/* Yaklasan Sampiyonalar — ozel vitrin */}
			{!compSearch.trim() && zktComps && zktComps.some((c: any) => c.championship_type && c.date_end >= todayStr) && (
				<div className={b('zkt-championships')}>
					<h3 className={b('section-title')}>
						<Trophy weight="fill" style={{marginRight: 8, verticalAlign: 'text-bottom', color: '#ffc400'}} />
						{t('zkt_comp.upcoming_championships')}
					</h3>
					<div className={b('comp-list')}>
						{zktComps
							.filter((c: any) => c.championship_type && c.date_end >= todayStr)
							.map((comp: any) => {
								const badgeKey = championshipBadgeKey(comp.championship_type);
								return (
									<div
										key={`champ-${comp.id}`}
										className={b('comp-card', {zkt: true, championship: true})}
										onClick={() => history.push(`/community/zkt-competitions/${comp.id}`)}
									>
										<span className={b('championship-badge', {[(comp.championship_type || 'default').toLowerCase()]: true})}>
											{badgeKey ? t(badgeKey) : ''}
										</span>
										<div className={b('comp-info')}>
											<span className={b('comp-title')}>{comp.name}</span>
											<span className={b('comp-sub')}>
												{formatDateRange(comp.date_start, comp.date_end, locale)}
												{comp.location && ` \u2013 ${comp.location}`}
											</span>
										</div>
									</div>
								);
							})}
					</div>
				</div>
			)}

			{/* ZKT Yarismalari — aktif sampiyonalari yukaridaki vitrinden tekrar
			     gosterme, sadece sampiyona olmayan veya gecmis olanlar burada. */}
			{(() => {
				const regularZkt = (zktComps || []).filter(
					(c: any) => !c.championship_type || c.date_end < todayStr
				);
				return !compSearch.trim() && regularZkt.length > 0 && (
					<div className={b('zkt-competitions')}>
						<h3 className={b('section-title')}>
							<Trophy weight="fill" style={{marginRight: 8, verticalAlign: 'text-bottom', color: 'rgb(var(--primary-color))'}} />
							{t('my_schedule.zkt_competitions')}
						</h3>
						<div className={b('comp-list')}>
							{regularZkt.map((comp: any) => {
							const champBadgeKey = championshipBadgeKey(comp.championship_type);
							return (
								<div
									key={comp.id}
									className={b('comp-card', {zkt: true, championship: !!comp.championship_type})}
									onClick={() => history.push(`/community/zkt-competitions/${comp.id}`)}
								>
									<span className={b('zkt-badge')}>ZKT</span>
									{champBadgeKey && (
										<span className={b('championship-badge', {[(comp.championship_type || 'default').toLowerCase()]: true})}>
											{t(champBadgeKey)}
										</span>
									)}
									<div className={b('comp-info')}>
										<span className={b('comp-title')}>{comp.name}</span>
										<span className={b('comp-sub')}>
											{formatDateRange(comp.date_start, comp.date_end, locale)}
											{comp.location && ` \u2013 ${comp.location}`}
										</span>
									</div>
									<span className={b('zkt-status', {[comp.status.toLowerCase()]: true})}>
										{t(`zkt_comp.status_${comp.status.toLowerCase()}`)}
									</span>
								</div>
							);
						})}
						</div>
					</div>
				);
			})()}

			{/* Arama */}
			<div className={b('search-box')}>
				<MagnifyingGlass size={18} weight="bold" />
				<input
					type="text"
					className={b('search-input')}
					placeholder={t('my_schedule.search_competitions')}
					value={compSearch}
					onChange={(e) => handleSearchChange(e.target.value)}
				/>
				{searching && <div className={b('search-progress')} />}
			</div>

			{competitions === null && !searching && !loadError && (
				<div className={b('wca-loading')}>
					<img src={resourceUri('/images/logos/wca_logo.svg')} alt="WCA" className={b('wca-loading-logo')} />
					<div className={b('wca-loading-bar')}>
						<div className={b('wca-loading-bar-fill')} />
					</div>
					<span className={b('wca-loading-text')}>{t('my_schedule.loading_competitions')}</span>
				</div>
			)}

			{loadError && (
				<div className={b('wca-loading')}>
					<img src={resourceUri('/images/logos/wca_logo.svg')} alt="WCA" className={b('wca-loading-logo')} />
					<span className={b('wca-loading-text')} style={{color: '#ef5350'}}>
						{t('my_schedule.load_error') || 'Yarismalar yuklenemedi.'}
					</span>
					<button
						className={b('wca-banner-btn')}
						style={{marginTop: 12}}
						onClick={handleRetry}
					>
						{t('my_schedule.retry') || 'Tekrar dene'}
					</button>
				</div>
			)}

			{!searching && displayList.length === 0 && competitions !== null && !loadError && (
				<p className={b('empty')}>{t('my_schedule.no_competitions')}</p>
			)}

			{displayList.length > 0 && (
				<>
					{!showSearchResults && (
						<h3 className={b('section-title')}>{t('my_schedule.upcoming_competitions')}</h3>
					)}
					<span className={b('competitor-count')}>
						{t('my_schedule.competition_count', {count: displayList.length})}
					</span>
					<div className={b('comp-list')}>
						{displayList.map((comp: any) => renderCompCard(comp))}
					</div>
				</>
			)}
		</div>
	);
}
