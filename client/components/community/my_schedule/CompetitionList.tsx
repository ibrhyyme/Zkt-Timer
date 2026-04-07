import React, {useEffect, useState, useMemo, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {gqlQueryTyped} from '../../api';
import {WcaCompetitionsDocument, WcaSearchCompetitionsDocument, MyWcaCompetitionsDocument} from '../../../@types/generated/graphql';
import {useMe} from '../../../util/hooks/useMe';
import {MagnifyingGlass} from 'phosphor-react';
import {resourceUri} from '../../../util/storage';
import {LINKED_SERVICES} from '../../../../shared/integration';
import {b, I18N_LOCALE_MAP, formatDateRange} from './shared';
import {isPremium} from '../../../lib/pro';
import {prefetchCompetitionDetail} from './CompetitionLoader';

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

	const filteredCompetitions = useMemo(() => {
		if (!competitions) return [];
		if (!compSearch.trim()) return competitions;
		const q = compSearch.toLowerCase();
		return competitions.filter(
			(c: any) => c.name.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q)
		);
	}, [competitions, compSearch]);

	useEffect(() => {
		if (!getListCache()) fetchCompetitions();
	}, []);

	const userIsPremium = me && isPremium(me);

	useEffect(() => {
		if (me && userIsPremium && !getMyCache()) fetchMyCompetitions();
	}, [me, userIsPremium]);

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
		} catch {
			setMyComps([]);
		}
	}

	async function fetchCompetitions() {
		try {
			const res = await gqlQueryTyped(WcaCompetitionsDocument, {filter: {}}, {fetchPolicy: 'no-cache'});
			const data = res.data?.wcaCompetitions || [];
			cachedCompetitions = {data, ts: Date.now()};
			setCompetitions(data);
		} catch {
			setCompetitions([]);
		}
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

	return (
		<div className={b('content')}>
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
			{!compSearch.trim() && userIsPremium && myComps && myComps.length > 0 && (
				<div className={b('my-competitions')}>
					<h3 className={b('section-title')}>{t('my_schedule.my_competitions')}</h3>
					<div className={b('comp-list')}>
						{myComps.map((comp: any) => (
							<div
								key={comp.id}
								className={b('comp-card', {mine: true})}
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
							</div>
						))}
					</div>
				</div>
			)}

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

			{competitions === null && !searching && (
				<div className={b('edge-loading')}>
					<div className={b('edge-runner', {top: true})} />
					<div className={b('edge-runner', {right: true})} />
					<div className={b('edge-runner', {bottom: true})} />
					<div className={b('edge-runner', {left: true})} />
				</div>
			)}

			{!searching && displayList.length === 0 && competitions !== null && (
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
						{displayList.map((comp: any) => {
							const now = new Date();
							const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
							const isFinished = comp.end_date < today;
							const isOngoing = comp.start_date <= today && comp.end_date >= today;

							return (
								<div
									key={comp.id}
									className={b('comp-card', {finished: isFinished, ongoing: isOngoing})}
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
						})}
					</div>
				</>
			)}
		</div>
	);
}
