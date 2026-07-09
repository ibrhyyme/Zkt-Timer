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
import {wcaRedirectUri, openWcaAuthorize, markNativeOAuthState} from '../../../util/oauth-native';
import {b, I18N_LOCALE_MAP, formatDateRange} from './shared';
import {prefetchCompetitionDetail} from './CompetitionLoader';
import {useZktCompListRefetch} from '../zkt_competitions/useZktCompRefetch';
import {prefetchZktCompetitionDetail} from '../zkt_competitions/ZktCompetitionDetail';

const ZKT_COMPETITIONS_QUERY = gql`
	query ZktCompetitionsForList($page: Int!, $pageSize: Int!, $searchQuery: String!) {
		zktCompetitions(page: $page, pageSize: $pageSize, searchQuery: $searchQuery) {
			items {
				id
				slug
				name
				date_start
				date_end
				location
				status
				country_code
				events {
					id
					event_id
				}
			}
		}
	}
`;

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
const LIST_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
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
		// Display ongoing competitions first, then others
		const now = new Date();
		const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		const ongoing = list.filter((c: any) => c.start_date <= today && c.end_date >= today);
		const rest = list.filter((c: any) => !(c.start_date <= today && c.end_date >= today));
		return [...ongoing, ...rest];
	}, [competitions, compSearch]);

	const mountedRef = useRef(true);
	useEffect(() => () => {
		mountedRef.current = false;
	}, []);

	useEffect(() => {
		if (!getListCache()) fetchCompetitions();
		// ZKT competitions are published/updated often, and an empty cache (from a
		// visit before any comp existed, or a transient error) would otherwise stay
		// stuck for 30 min and hide the section. Always refetch on mount — the
		// cached value still renders instantly while fresh data lands (SWR).
		fetchZktCompetitions();
	}, []);

	// Live refresh: when any ZKT competition is created/updated/deleted, refetch list
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
			if (mountedRef.current) setZktComps(data);
		} catch (err) {
			// silent — if no ZKT competitions or not logged in, empty list will be shown anyway
			if (mountedRef.current) setZktComps([]);
		}
	}

	// App resume / tab focus: silently refresh in background — so users see new competitions
	// without manually refreshing
	useEffect(() => {
		const silentRefresh = () => {
			if (document.visibilityState !== 'visible') return;
			// If last fetch was older than 2 minutes, refetch (avoid excessive requests)
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

	// Prefetch: user's competitions + next 3 upcoming competitions
	useEffect(() => {
		if (!myComps || myComps.length === 0) return;
		// Once user competitions load, prefetch first 3
		const targets = myComps.slice(0, 3);
		targets.forEach((c: any, i: number) => {
			setTimeout(() => prefetchCompetitionDetail(c.competitionId || c.id), 500 + i * 200);
		});
	}, [myComps]);

	useEffect(() => {
		if (!competitions || competitions.length === 0) return;
		// Prefetch first 3 from general list (usually the nearest upcoming)
		const targets = competitions.slice(0, 3);
		targets.forEach((c: any, i: number) => {
			setTimeout(() => prefetchCompetitionDetail(c.id), 1500 + i * 300);
		});
	}, [competitions]);

	// On hover, prefetch competition detail after 200ms
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
			if (mountedRef.current) setMyComps(data);
		} catch (err) {
			console.warn('[CompetitionList] myWcaCompetitions fetch failed:', err);
			if (mountedRef.current) setMyComps([]);
		}
	}

	async function fetchCompetitions() {
		setLoadError(null);
		try {
			const res = await gqlQueryTyped(WcaCompetitionsDocument, {filter: {}}, {fetchPolicy: 'no-cache'});
			const data = res.data?.wcaCompetitions || [];
			if (data.length > 0) {
				// Only cache data with results — if empty, don't cache to avoid showing
				// "no competitions found" for 30 minutes when user force-refreshes
				cachedCompetitions = {data, ts: Date.now()};
			} else {
				console.warn('[CompetitionList] wcaCompetitions returned empty array — cache not written');
			}
			if (mountedRef.current) setCompetitions(data);
		} catch (err: any) {
			console.warn('[CompetitionList] wcaCompetitions fetch failed:', err);
			if (mountedRef.current) {
				setLoadError(err?.message || 'network_error');
				setCompetitions(null);
			}
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
		history.push(`/competitions/${compId}`);
	}

	const showSearchResults = compSearch.trim().length >= 3 && searchResults;
	const displayList = showSearchResults ? searchResults : filteredCompetitions;

	const todayStr = useMemo(() => {
		const n = new Date();
		return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
	}, []);

	// ZKT competitions live in their OWN section below — they're not WCA comps,
	// so keep them separate to avoid confusion. Reuse the WCA card shape so the
	// page stays visually consistent. Normalize to the WCA card fields here.
	const zktCards = useMemo(() => {
		if (showSearchResults) return [];
		return (zktComps || [])
			.map((c: any) => ({
				id: c.id,
				slug: c.slug,
				name: c.name,
				start_date: c.date_start,
				end_date: c.date_end,
				city: c.location,
				country_iso2: c.country_code || 'TR',
				status: c.status,
				events: c.events || [],
				__zkt: true,
			}))
			.sort((a: any, b: any) => (b.start_date || '').localeCompare(a.start_date || ''));
	}, [showSearchResults, zktComps, todayStr]);

	function renderCompCard(comp: any, opts: {mine?: boolean} = {}) {
		const isFinished = comp.end_date < todayStr;
		const isOngoing = comp.start_date <= todayStr && comp.end_date >= todayStr;
		const daysUntil = (() => {
			if (!opts.mine || isOngoing || isFinished) return null;
			const start = new Date(comp.start_date + 'T00:00:00');
			const today = new Date(todayStr + 'T00:00:00');
			const diff = Math.round((start.getTime() - today.getTime()) / (24 * 3600 * 1000));
			return diff;
		})();
		return (
			<div
				key={comp.id}
				className={b('comp-card', {finished: isFinished, ongoing: isOngoing, mine: opts.mine})}
				onClick={() =>
					comp.__zkt
						? history.push(`/zkt-competitions/${comp.slug || comp.id}`)
						: handleSelectCompetition(comp.id)
				}
				onMouseEnter={() => !comp.__zkt && handleHoverPrefetch(comp.id)}
				onMouseLeave={handleHoverLeave}
			>
				{opts.mine && <span className={b('mine-glow')} aria-hidden="true" />}
				{comp.country_iso2 && (
					<span className={b('country-code')}>{comp.country_iso2}</span>
				)}
				<div className={b('comp-info')}>
					{comp.__zkt && <span className={b('zkt-badge')}>ZKT</span>}
					{opts.mine && (
						<span className={b('mine-tag')}>
							<Trophy weight="fill" size={11} style={{marginRight: 4}} />
							{t('my_schedule.registered')}
						</span>
					)}
					<span className={b('comp-title')}>{comp.name}</span>
					<span className={b('comp-sub')}>
						{formatDateRange(comp.start_date, comp.end_date, locale)}
						{comp.city && ` \u2013 ${comp.city}`}
					</span>
				</div>
				{isOngoing ? (
					<span className={b('ongoing-badge')}>{t('my_schedule.ongoing')}</span>
				) : daysUntil !== null && daysUntil >= 0 ? (
					<span className={b('countdown-badge', {imminent: daysUntil <= 3})}>
						<span className={b('countdown-num')}>{daysUntil === 0 ? t('my_schedule.starts_today') : daysUntil}</span>
						{daysUntil > 0 && (
							<span className={b('countdown-label')}>
								{t('my_schedule.days_left', {count: daysUntil})}
							</span>
						)}
					</span>
				) : null}
			</div>
		);
	}

	// ZKT competitions get their OWN distinctive card (gradient rail + ZKT
	// monogram + event-icon strip) — intentionally NOT the WCA/mine card shape.
	function renderZktCard(comp: any) {
		const isFinished = comp.end_date < todayStr;
		const isOngoing = comp.start_date <= todayStr && comp.end_date >= todayStr;
		const statusKey = (comp.status || '').toLowerCase();
		const events = comp.events || [];
		return (
			<div
				key={comp.id}
				className={b('zkt-card', {finished: isFinished, ongoing: isOngoing})}
				onMouseEnter={() => prefetchZktCompetitionDetail(comp.slug || comp.id)}
				onClick={() => history.push(`/zkt-competitions/${comp.slug || comp.id}`)}
			>
				<span className={b('zkt-card-rail')} aria-hidden="true" />
				<div className={b('zkt-card-main')}>
					<div className={b('zkt-card-top')}>
						<span className={b('zkt-card-mark')}>ZKT</span>
						{comp.country_iso2 && (
							<span className={b('zkt-card-flag')}>{comp.country_iso2}</span>
						)}
						{statusKey && (
							<span className={b('zkt-status', {[statusKey]: true})}>
								{t(`zkt_comp.status_${statusKey}`)}
							</span>
						)}
					</div>
					<span className={b('zkt-card-title')}>{comp.name}</span>
					<span className={b('zkt-card-meta')}>
						{formatDateRange(comp.start_date, comp.end_date, locale)}
						{comp.city && ` · ${comp.city}`}
					</span>
					{events.length > 0 && (
						<div className={b('zkt-card-events')}>
							{events.slice(0, 10).map((e: any) => (
								<span key={e.id} className={`cubing-icon event-${e.event_id}`} />
							))}
						</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className={b('content')}>
			<h1 className="sr-only">{t('seo.wca_competitions_title')}</h1>
			{/* WCA banner — show only when WCA is not linked */}
			{!compSearch.trim() && !me?.integrations?.some((i: any) => i.service_name === 'wca') && (
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
									redirect_uri: wcaRedirectUri(!me ? '/oauth/wca/login' : '/oauth/wca'),
									state: markNativeOAuthState('/competitions'),
								});
								openWcaAuthorize(`${service.authEndpoint}?${params.toString()}`);
							}}
						>
							{!me ? t('my_schedule.wca_login') : t('my_schedule.connect_wca_btn')}
						</button>
					</div>
				</div>
			)}

			{/* My Competitions — show only if WCA is linked */}
			{!compSearch.trim() && me?.integrations?.some((i: any) => i.service_name === 'wca') && (
				<div className={b('my-competitions')}>
					<h3 className={b('section-title')}>{t('my_schedule.my_competitions')}</h3>
					{!myComps ? (
						<p className={b('my-competitions-empty')}>{t('my_schedule.my_competitions_loading')}</p>
					) : myComps.length === 0 ? (
						<p className={b('my-competitions-empty')}>{t('my_schedule.my_competitions_empty')}</p>
					) : (
						<div className={b('comp-list')}>
							{myComps.map((comp: any) => renderCompCard(comp, {mine: true}))}
						</div>
					)}
				</div>
			)}

			{/* ZKT competitions — their OWN section (not WCA comps, avoid confusion),
			     reusing the WCA card style so the page stays consistent. */}
			{!compSearch.trim() && zktCards.length > 0 && (
				<div className={b('zkt-competitions')}>
					<h3 className={b('section-title')}>
						<Trophy weight="fill" style={{marginRight: 8, verticalAlign: 'text-bottom', color: 'rgb(var(--primary-color))'}} />
						{t('my_schedule.zkt_competitions')}
					</h3>
					<div className={b('comp-list')}>
						{zktCards.map((comp: any) => renderZktCard(comp))}
					</div>
				</div>
			)}


			{/* Search */}
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
