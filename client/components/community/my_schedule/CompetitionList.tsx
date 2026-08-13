import React, {useEffect, useState, useMemo, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {gql} from '@apollo/client';
import {gqlQueryTyped, gqlMutate} from '../../api';
import {WcaCompetitionsDocument, WcaSearchCompetitionsDocument, MyWcaCompetitionsDocument} from '../../../@types/generated/graphql';
import {useMe} from '../../../util/hooks/useMe';
import {useTheme} from '../../../util/hooks/useTheme';
import {MagnifyingGlass, Trophy, Bell, CaretRight} from 'phosphor-react';
import {resourceUri} from '../../../util/storage';
import {LINKED_SERVICES} from '../../../../shared/integration';
import {oauthRedirectUri, openOAuthAuthorize, markNativeOAuthState} from '../../../util/oauth-native';
import {b, I18N_LOCALE_MAP, formatDateRange} from './shared';
import CompEventFilter from './CompEventFilter';
import {getEventFilter, setEventFilter} from './eventFilterStorage';
import {prefetchCompetitionDetail} from './CompetitionLoader';

// ZKT competitions are owned by the Zeka Kupu Turkiye federation; Zkt-Timer reads
// them (view-only) through the federation public API proxied by ZktPublic.resolver.
const ZKT_COMPETITIONS_QUERY = gql`
	query ZktPublicCompetitionsForList($page: Int!, $pageSize: Int!, $q: String) {
		zktPublicCompetitions(page: $page, pageSize: $pageSize, q: $q) {
			items {
				id
				slug
				name
				startDate
				endDate
				location
				status
				country
				eventIds
			}
		}
	}
`;

// The viewer's own ZKT registrations. Matched on the linked WCA account server
// side, so it only returns something once WCA is connected — same precondition
// as the WCA "my competitions" list it sits next to.
const ZKT_MY_COMPETITIONS_QUERY = gql`
	query ZktPublicMyCompetitionsForList {
		zktPublicMyCompetitions {
			id
			slug
			name
			startDate
			endDate
			location
			status
			country
			eventIds
			registrationStatus
			dayLabel
			dayDate
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

let cachedMyZktComps: {data: any[]; ts: number} | null = null;
function getMyZktCache(): any[] | null {
	if (!cachedMyZktComps) return null;
	if (Date.now() - cachedMyZktComps.ts > 30 * 60 * 1000) {
		cachedMyZktComps = null;
		return null;
	}
	return cachedMyZktComps.data;
}

// Federation list item → the field names the WCA competition card reads.
// Federation dates are full ISO; the card's date math compares against a
// YYYY-MM-DD "today", so normalize to a plain date string.
function normalizeZktComp(c: any): any {
	return {
		id: c.id,
		slug: c.slug,
		name: c.name,
		start_date: (c.startDate || '').slice(0, 10),
		end_date: (c.endDate || '').slice(0, 10),
		city: c.location,
		country_iso2: c.country || 'TR',
		status: c.status,
		registration_status: c.registrationStatus,
		// Day-split competition: the day this viewer was accepted onto. Their own
		// list is the one place they will actually look for it.
		zkt_day_label: c.dayLabel || null,
		zkt_day_date: c.dayDate || null,
		events: (c.eventIds || []).map((id: string) => ({id, event_id: id})),
		event_ids: c.eventIds || [],
		__zkt: true,
	};
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
	// The card watermark is a fixed piece of artwork, so how visible it is
	// depends on what is behind it. The theme is only a set of colour variables
	// in CSS — there is no "light mode" selector — so the decision is made here.
	const isDarkTheme = useTheme('module_color')?.isDark !== false;

	const [competitions, setCompetitions] = useState<any[] | null>(getListCache());
	const [compSearch, setCompSearch] = useState('');
	const [searchResults, setSearchResults] = useState<any[] | null>(null);
	const [searching, setSearching] = useState(false);
	const [myComps, setMyComps] = useState<any[] | null>(getMyCache());
	const [zktComps, setZktComps] = useState<any[] | null>(getZktCache());
	const [myZktComps, setMyZktComps] = useState<any[] | null>(getMyZktCache());
	const [loadError, setLoadError] = useState<string | null>(null);
	const [eventFilter, setEventFilterState] = useState<string[]>(() => getEventFilter());

	// Union match: a comp passes when it holds at least one of the selected events.
	// Empty selection means no filtering.
	function matchesEventFilter(comp: any): boolean {
		if (eventFilter.length === 0) return true;
		const ids: string[] = comp.event_ids || [];
		return ids.some((id) => eventFilter.includes(id));
	}

	function toggleEventFilter(code: string) {
		setEventFilterState((prev) => {
			const next = prev.includes(code) ? prev.filter((e) => e !== code) : [...prev, code];
			setEventFilter(next);
			return next;
		});
	}

	function clearEventFilter() {
		setEventFilterState([]);
		setEventFilter([]);
	}

	const filteredCompetitions = useMemo(() => {
		if (!competitions) return [];
		let list = competitions;
		if (compSearch.trim()) {
			const q = compSearch.toLowerCase();
			list = list.filter(
				(c: any) => c.name.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q)
			);
		}
		if (eventFilter.length > 0) {
			list = list.filter(matchesEventFilter);
		}
		// Display ongoing competitions first, then others
		const now = new Date();
		const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
		const ongoing = list.filter((c: any) => c.start_date <= today && c.end_date >= today);
		const rest = list.filter((c: any) => !(c.start_date <= today && c.end_date >= today));
		return [...ongoing, ...rest];
	}, [competitions, compSearch, eventFilter]);

	// "My competitions" is one list across both federations: a WCA registration
	// and a ZKT registration are the same thing to the person reading it. Sorted
	// by start date so the next competition is on top regardless of who runs it.
	// Declared here because the prefetch effect below depends on it.
	const myAllComps = useMemo(() => {
		const zkt = (myZktComps || []).map(normalizeZktComp);
		if (zkt.length === 0) return myComps;
		return [...(myComps || []), ...zkt].sort((a: any, b: any) =>
			(a.start_date || '').localeCompare(b.start_date || '')
		);
	}, [myComps, myZktComps]);

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

	useEffect(() => {
		if (me && !getMyCache()) fetchMyCompetitions();
		// Same SWR reasoning as the ZKT list: a registration made minutes ago must
		// not be hidden behind a 30-minute cache.
		if (me) fetchMyZktCompetitions();
	}, [me]);

	async function fetchZktCompetitions() {
		try {
			const res = await gqlMutate(ZKT_COMPETITIONS_QUERY, {
				page: 0,
				pageSize: 50,
			});
			const data = res?.data?.zktPublicCompetitions?.items || [];
			cachedZktComps = {data, ts: Date.now()};
			if (mountedRef.current) setZktComps(data);
		} catch (err) {
			// silent — if no ZKT competitions or not logged in, empty list will be shown anyway
			if (mountedRef.current) setZktComps([]);
		}
	}

	async function fetchMyZktCompetitions() {
		try {
			const res = await gqlMutate(ZKT_MY_COMPETITIONS_QUERY, {});
			const data = res?.data?.zktPublicMyCompetitions || [];
			cachedMyZktComps = {data, ts: Date.now()};
			if (mountedRef.current) setMyZktComps(data);
		} catch (err) {
			// Silent: no WCA link (or no ZKT registration) is the normal empty case.
			if (mountedRef.current) setMyZktComps([]);
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
		if (!myAllComps || myAllComps.length === 0) return;
		// Once user competitions load, prefetch first 3
		const targets = myAllComps.slice(0, 3);
		targets.forEach((c: any, i: number) => {
			const id = c.__zkt ? `zkt-${c.slug || c.id}` : c.competitionId || c.id;
			setTimeout(() => prefetchCompetitionDetail(id), 500 + i * 200);
		});
	}, [myAllComps]);

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
				const q = value.trim();
				// Search both federations at once. Typing a query used to hide the ZKT
				// section entirely, so a ZKT competition was unfindable by name — the
				// one place a user is most likely to look for it.
				const [wcaRes, zktRes] = await Promise.all([
					gqlQueryTyped(WcaSearchCompetitionsDocument, {query: q}, {fetchPolicy: 'no-cache'})
						.then((r) => r.data?.wcaSearchCompetitions || [])
						.catch(() => []),
					gqlMutate(ZKT_COMPETITIONS_QUERY, {page: 0, pageSize: 30, q})
						.then((r: any) => r?.data?.zktPublicCompetitions?.items || [])
						.catch(() => []),
				]);
				// ZKT results lead: a Turkish user searching in Zkt-Timer is far more
				// likely to mean the ZKT competition than a same-named WCA one.
				setSearchResults([...zktRes.map(normalizeZktComp), ...wcaRes]);
				setSearching(false);
			}, 300);
		}
	}

	function handleSelectCompetition(compId: string) {
		history.push(`/competitions/${compId}`);
	}

	const showSearchResults = compSearch.trim().length >= 3 && searchResults;
	const displayList = showSearchResults
		? (eventFilter.length > 0 ? searchResults.filter(matchesEventFilter) : searchResults)
		: filteredCompetitions;

	const todayStr = useMemo(() => {
		const n = new Date();
		return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
	}, []);

	// ZKT competitions live in their OWN section below — they're not WCA comps,
	// so keep them separate to avoid confusion. Reuse the WCA card shape so the
	// page stays visually consistent. Normalize to the WCA card fields here.
	const zktCards = useMemo(() => {
		if (showSearchResults) return [];
		// A competition the viewer is registered for already has its own card in My
		// Competitions above, with their day and countdown on it. Repeating it here
		// as a plain "discover this" card is pure noise now that both sections draw
		// the same shape.
		const registeredIds = new Set((myZktComps || []).map((c: any) => c.id));
		return (
			(zktComps || [])
				.filter((c: any) => !registeredIds.has(c.id))
				.map(normalizeZktComp)
				// Finished competitions drop out, the same rule the WCA section above
				// follows: this list is what is still ahead, not an archive. A comp
				// stays until the day after it ends, so results are still one tap away
				// on the last day. Past ZKT competitions remain reachable by search
				// and from the federation site.
				.filter((c: any) => !c.end_date || c.end_date >= todayStr)
				// Soonest first — the next competition is the one people look for.
				.sort((a: any, b: any) => (a.start_date || '').localeCompare(b.start_date || ''))
		);
	}, [showSearchResults, zktComps, myZktComps, todayStr]);

	// Compact row for the long discovery lists (upcoming + search results), where
	// dozens of competitions have to stay scannable. Cards the viewer has a stake
	// in use renderShowcaseCard below instead.
	function renderCompCard(comp: any) {
		const isFinished = comp.end_date < todayStr;
		const isOngoing = comp.start_date <= todayStr && comp.end_date >= todayStr;
		return (
			<div
				key={comp.id}
				className={b('comp-card', {finished: isFinished, ongoing: isOngoing})}
				onClick={() =>
					comp.__zkt
						? handleSelectCompetition(`zkt-${comp.slug || comp.id}`)
						: handleSelectCompetition(comp.id)
				}
				onMouseEnter={() => !comp.__zkt && handleHoverPrefetch(comp.id)}
				onMouseLeave={handleHoverLeave}
			>
				{comp.country_iso2 && (
					<span className={b('country-code')}>{comp.country_iso2}</span>
				)}
				<div className={b('comp-info')}>
					{comp.__zkt && <span className={b('zkt-badge')}>ZKT</span>}
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

	// The showcase card: one shape for every competition the viewer has a stake
	// in — their own registrations (WCA or ZKT alike) and the ZKT section below.
	// The federation only swaps the rail colour and the monogram; `mine` adds the
	// registered pill, the attending-day line and the countdown. Keeping both
	// sections on one component is what stops the two designs drifting apart.
	function renderShowcaseCard(comp: any, opts: {mine?: boolean} = {}) {
		const isZkt = !!comp.__zkt;
		const isFinished = !!comp.end_date && comp.end_date < todayStr;
		const isOngoing = comp.start_date <= todayStr && comp.end_date >= todayStr;
		// WCA competitions carry no lifecycle status, and on a "mine" card the
		// registered pill already owns that slot.
		const statusKey = isZkt && !opts.mine ? (comp.status || '').toLowerCase() : '';
		// WCA payloads carry event_ids; the federation normalizer also builds
		// `events`. Accept either so both sources render the icon strip.
		const eventIds: string[] = (
			comp.event_ids?.length
				? comp.event_ids
				: (comp.events || []).map((e: any) => e.event_id || e.id)
		).filter(Boolean);
		const detailId = isZkt ? `zkt-${comp.slug || comp.id}` : comp.id;
		const daysUntil = (() => {
			if (!opts.mine || isOngoing || isFinished || !comp.start_date) return null;
			const start = new Date(comp.start_date + 'T00:00:00');
			const today = new Date(todayStr + 'T00:00:00');
			return Math.round((start.getTime() - today.getTime()) / (24 * 3600 * 1000));
		})();
		const showAside = !!opts.mine && (isOngoing || (daysUntil !== null && daysUntil >= 0));

		return (
			<div
				key={`${isZkt ? 'zkt' : 'wca'}-${comp.id}`}
				className={b('zkt-card', {
					finished: isFinished,
					ongoing: isOngoing,
					mine: opts.mine,
					wca: !isZkt,
				})}
				onMouseEnter={() => handleHoverPrefetch(detailId)}
				onMouseLeave={handleHoverLeave}
				onClick={() => handleSelectCompetition(detailId)}
			>
				<span className={b('zkt-card-rail')} aria-hidden="true" />
				{/* Federation watermark instead of a text badge: the logo says the
				    same thing without spending a line of the card on it.
				    The ZKT artwork carries lettering, so it ships as two files and the
				    theme picks one — the same pair `Logo.tsx` uses for the header.
				    (A CSS mask was tried first and flattened both logos into a grey
				    blob: a mask keeps the shape and throws the colours away.) The WCA
				    mark is just the coloured cube, so one file serves every theme.
				    Decorative, so hidden from screen readers. */}
				<img
					src={resourceUri(
						isZkt
							? isDarkTheme
								? '/images/zkt-logo.png'
								: '/images/zkt-logo-white.png'
							: '/images/logos/wca_logo.svg'
					)}
					alt=""
					aria-hidden="true"
					className={b('zkt-card-watermark', {light: !isDarkTheme})}
				/>
				<div className={b('zkt-card-main')}>
					<div className={b('zkt-card-top')}>
						{comp.country_iso2 && (
							<span className={b('zkt-card-flag')}>{comp.country_iso2}</span>
						)}
						{opts.mine && (
							<span className={b('zkt-card-mine-tag')}>
								<Trophy weight="fill" size={11} style={{marginRight: 4}} />
								{t('my_schedule.registered')}
							</span>
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
					{/* A day-split competition runs over two days but this viewer attends
					    exactly one of them. The card shows the whole date range, so
					    without this line their own day is nowhere on the screen. */}
					{comp.zkt_day_label && (
						<span className={b('zkt-card-day')}>
							{t('zkt_comp.attending_day')}: {comp.zkt_day_label}
							{comp.zkt_day_date
								? ` (${new Date(comp.zkt_day_date).toLocaleDateString(locale, {
										day: 'numeric',
										month: 'long',
									})})`
								: ''}
						</span>
					)}
					{eventIds.length > 0 && (
						<div className={b('zkt-card-events')}>
							{eventIds.slice(0, 10).map((id: string) => (
								<span key={id} className={`cubing-icon event-${id}`} />
							))}
						</div>
					)}
				</div>
				{showAside && (
					<div className={b('zkt-card-aside')}>
						{isOngoing ? (
							<span className={b('ongoing-badge')}>{t('my_schedule.ongoing')}</span>
						) : (
							<span className={b('countdown-badge', {imminent: daysUntil <= 3})}>
								<span className={b('countdown-num')}>
									{daysUntil === 0 ? t('my_schedule.starts_today') : daysUntil}
								</span>
								{daysUntil > 0 && (
									<span className={b('countdown-label')}>
										{t('my_schedule.days_left', {count: daysUntil})}
									</span>
								)}
							</span>
						)}
					</div>
				)}
			</div>
		);
	}

	const hasWcaLink = !!me?.integrations?.some((i: any) => i.service_name === 'wca');
	const hasZktLink = !!me?.integrations?.some((i: any) => i.service_name === 'zkt');

	/**
	 * "Connect your account" row for one federation. Deliberately two lines —
	 * a title and one sentence with the action inline — because two of these can
	 * be on screen at once and the page's job is to show competitions.
	 */
	function renderConnectBanner(service: 'zkt' | 'wca') {
		const isZktService = service === 'zkt';
		const logo = isZktService
			? isDarkTheme
				? '/images/zkt-logo.png'
				: '/images/zkt-logo-white.png'
			: '/images/logos/wca_logo.svg';
		const label = !me
			? t(isZktService ? 'my_schedule.zkt_login' : 'my_schedule.wca_login')
			: t(isZktService ? 'my_schedule.connect_zkt_btn' : 'my_schedule.connect_wca_btn');
		const desc = !me
			? t('my_schedule.login_description')
			: t(isZktService ? 'my_schedule.connect_zkt_description' : 'my_schedule.connect_wca_description');

		function start() {
			const oauth = isZktService ? LINKED_SERVICES.zkt : LINKED_SERVICES.wca;
			const loginPath = isZktService ? '/oauth/zkt/login' : '/oauth/wca/login';
			const linkPath = isZktService ? '/oauth/zkt' : '/oauth/wca';
			const params = new URLSearchParams({
				client_id: oauth.clientId,
				response_type: oauth.responseType,
				scope: oauth.scope.join(' '),
				redirect_uri: oauthRedirectUri(!me ? loginPath : linkPath),
				state: markNativeOAuthState('/competitions'),
			});
			openOAuthAuthorize(`${oauth.authEndpoint}?${params.toString()}`);
		}

		return (
			<button
				key={service}
				className={b('connect-row', {[service]: true})}
				onClick={start}
			>
				<img src={resourceUri(logo)} alt="" aria-hidden="true" className={b('connect-row-logo')} />
				<span className={b('connect-row-body')}>
					<span className={b('connect-row-title')}>{label}</span>
					<span className={b('connect-row-desc')}>{desc}</span>
				</span>
				<CaretRight size={15} weight="bold" className={b('connect-row-caret')} />
			</button>
		);
	}

	return (
		<div className={b('content')}>
			<h1 className="sr-only">{t('seo.wca_competitions_title')}</h1>

			{/* Record radar entry */}
			<button
				className={b('radar-entry')}
				onClick={() => history.push('/competitions/records')}
			>
				<Bell size={20} weight="fill" className={b('radar-entry-icon')} />
				<span className={b('radar-entry-body')}>
					<span className={b('radar-entry-title')}>{t('my_schedule.radar_entry_title')}</span>
					<span className={b('radar-entry-sub')}>{t('my_schedule.radar_entry_sub')}</span>
				</span>
				<CaretRight size={16} weight="bold" />
			</button>

			{/* Connect prompts, one per federation, ZKT first: a Turkish competitor's
			    results hang off their ZKT account now. Both are one compact row —
			    two full-size cards stacked would push the actual competition list
			    below the fold. */}
			{!compSearch.trim() && !hasZktLink && renderConnectBanner('zkt')}
			{!compSearch.trim() && !hasWcaLink && renderConnectBanner('wca')}

			{/* My Competitions — needs a linked federation account to hold anything.
			     WCA link is the usual gate, but a viewer with ZKT registrations must
			     see the section too, whichever way that match was made. */}
			{!compSearch.trim() && (hasWcaLink || (myZktComps?.length ?? 0) > 0) && (
				<div className={b('my-competitions')}>
					<h3 className={b('section-title')}>{t('my_schedule.my_competitions')}</h3>
					{!myAllComps ? (
						<p className={b('my-competitions-empty')}>{t('my_schedule.my_competitions_loading')}</p>
					) : myAllComps.length === 0 ? (
						<p className={b('my-competitions-empty')}>{t('my_schedule.my_competitions_empty')}</p>
					) : (
						<div className={b('comp-list')}>
							{myAllComps.map((comp: any) => renderShowcaseCard(comp, {mine: true}))}
						</div>
					)}
				</div>
			)}

			{/* ZKT competitions — their OWN section (not WCA comps, avoid confusion),
			     on the same showcase card as My Competitions above. */}
			{!compSearch.trim() && zktCards.length > 0 && (
				<div className={b('zkt-competitions')}>
					<h3 className={b('section-title')}>
						<Trophy weight="fill" style={{marginRight: 8, verticalAlign: 'text-bottom', color: 'rgb(var(--primary-color))'}} />
						{t('my_schedule.zkt_competitions')}
					</h3>
					<div className={b('comp-list')}>
						{zktCards.map((comp: any) => renderShowcaseCard(comp))}
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

			{/* Event filter — discovery tool for the WCA list + search results.
			    My Competitions / ZKT sections above are intentionally NOT filtered:
			    they are curated/personal lists that should stay visible. */}
			<CompEventFilter
				selected={eventFilter}
				onToggle={toggleEventFilter}
				onClear={clearEventFilter}
			/>

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
