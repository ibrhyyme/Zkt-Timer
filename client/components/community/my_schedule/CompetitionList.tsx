import React, {useEffect, useState, useMemo, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {gql} from '@apollo/client';
import {gqlQueryTyped, gqlMutate} from '../../api';
import {WcaCompetitionsDocument, WcaSearchCompetitionsDocument, MyWcaCompetitionsDocument} from '../../../@types/generated/graphql';
import {useMe} from '../../../util/hooks/useMe';
import {useTheme} from '../../../util/hooks/useTheme';
import {useZktBadge} from '../../../util/hooks/useZktBadge';
import {MagnifyingGlass, Trophy, Bell, CaretRight} from 'phosphor-react';
import {resourceUri} from '../../../util/storage';
import {LINKED_SERVICES} from '../../../../shared/integration';
import {oauthRedirectUri, openOAuthAuthorize, markNativeOAuthState} from '../../../util/oauth-native';
import {b, I18N_LOCALE_MAP, formatDateRange} from './shared';
import {isPastCompetition, localTodayStr} from './competition-past';
import CompEventFilter from './CompEventFilter';
import {getEventFilter, setEventFilter} from './eventFilterStorage';
import {prefetchCompetitionDetail} from './CompetitionLoader';
import {retryDelayMs} from './fetch-error';
import {peekCached, storeCached, isOlderThan, userScoped, markHydrated} from '../competition-cache';

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

// Every list on this page is drawn from the copy kept on the device and refreshed
// behind it. A competitor opening the app must see their own competition in the
// first frame, not after two requests (one per federation) come back and the
// ZKT card pops in a second later.
const ZKT_LIST_KEY = 'list:zkt';
const WCA_LIST_KEY = 'list:wca';
const myZktKey = () => userScoped('list:my-zkt');
const myWcaKey = () => userScoped('list:my-wca');
// How old a copy may be and still be drawn while the fresh one loads.
const MAX_SHOWN_AGE = 7 * 24 * 60 * 60 * 1000;

function shownList(key: string): any[] | null {
	const entry = peekCached<any[]>(key);
	return entry && !isOlderThan(entry, MAX_SHOWN_AGE) ? entry.data : null;
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

// The WCA lists change slowly: a copy younger than this is not asked for again
// on a visit (the ZKT lists always are, behind the copy on screen).
const LIST_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export default function CompetitionList() {
	const {t, i18n} = useTranslation();
	const me = useMe();
	const history = useHistory();
	const locale = I18N_LOCALE_MAP[i18n.language] || i18n.language;
	// The card watermark is a fixed piece of artwork, so how visible it is
	// depends on what is behind it. The theme is only a set of colour variables
	// in CSS — there is no "light mode" selector — so the decision is made here.
	const isDarkTheme = useTheme('module_color')?.isDark !== false;
	const zktBadge = useZktBadge();

	const [competitions, setCompetitions] = useState<any[] | null>(() => shownList(WCA_LIST_KEY));
	const [compSearch, setCompSearch] = useState('');
	const [searchResults, setSearchResults] = useState<any[] | null>(null);
	const [searching, setSearching] = useState(false);
	const [myComps, setMyComps] = useState<any[] | null>(() => shownList(myWcaKey()));
	const [zktComps, setZktComps] = useState<any[] | null>(() => shownList(ZKT_LIST_KEY));
	const [myZktComps, setMyZktComps] = useState<any[] | null>(() => shownList(myZktKey()));
	const [loadError, setLoadError] = useState<string | null>(null);
	// The ZKT list failed and there is nothing cached to show in its place.
	const [zktError, setZktError] = useState(false);
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

	const todayStr = useMemo(() => localTodayStr(), []);

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
		// The WCA feed starts at the first of the current month, so early in a
		// month it carries competitions that are already over. This section is
		// headed "upcoming", so they have no place in it.
		list = list.filter((c: any) => !isPastCompetition(c, todayStr));
		// Display ongoing competitions first, then others
		const ongoing = list.filter((c: any) => c.start_date <= todayStr && c.end_date >= todayStr);
		const rest = list.filter((c: any) => !(c.start_date <= todayStr && c.end_date >= todayStr));
		return [...ongoing, ...rest];
	}, [competitions, compSearch, eventFilter, todayStr]);

	// "My competitions" is one list across both federations: a WCA registration
	// and a ZKT registration are the same thing to the person reading it. Sorted
	// by start date so the next competition is on top regardless of who runs it.
	// Declared here because the prefetch effect below depends on it.
	//
	// Finished competitions drop out on both sides. The WCA query already filters
	// server-side, but the federation returns a member's whole history, so a comp
	// from months ago sat at the top of this list — sorted first precisely because
	// it was the oldest. Past competitions stay reachable through search.
	const myAllComps = useMemo(() => {
		const zkt = (myZktComps || []).map(normalizeZktComp);
		if (!myComps && zkt.length === 0) return null;
		return [...(myComps || []), ...zkt]
			.filter((c: any) => !isPastCompetition(c, todayStr))
			.sort((a: any, b: any) => (a.start_date || '').localeCompare(b.start_date || ''));
	}, [myComps, myZktComps, todayStr]);

	const mountedRef = useRef(true);
	// Quiet retries for the two ZKT lists. A failed fetch used to replace the
	// list with [], so on competition day, while the federation was refusing
	// us, the ZKT section and the viewer's own registration vanished until
	// they came back a minute or two later.
	const zktRetryRef = useRef<{timer: ReturnType<typeof setTimeout> | null; attempt: number}>({timer: null, attempt: 0});
	const myZktRetryRef = useRef<{timer: ReturnType<typeof setTimeout> | null; attempt: number}>({timer: null, attempt: 0});
	useEffect(() => () => {
		mountedRef.current = false;
		if (zktRetryRef.current.timer) clearTimeout(zktRetryRef.current.timer);
		if (myZktRetryRef.current.timer) clearTimeout(myZktRetryRef.current.timer);
	}, []);

	function scheduleRetry(
		ref: React.MutableRefObject<{timer: ReturnType<typeof setTimeout> | null; attempt: number}>,
		run: () => void
	) {
		if (!mountedRef.current) return;
		if (ref.current.timer) clearTimeout(ref.current.timer);
		const delay = retryDelayMs(ref.current.attempt);
		ref.current.attempt += 1;
		ref.current.timer = setTimeout(() => {
			ref.current.timer = null;
			if (mountedRef.current) run();
		}, delay);
	}

	useEffect(() => {
		// On the web the first render matched the server markup, which has none of
		// the device copies; draw them now.
		markHydrated();
		setCompetitions((prev) => prev ?? shownList(WCA_LIST_KEY));
		setZktComps((prev) => prev ?? shownList(ZKT_LIST_KEY));
		if (isOlderThan(peekCached(WCA_LIST_KEY), LIST_CACHE_TTL)) fetchCompetitions();
		// ZKT competitions are published/updated often, and an empty cache (from a
		// visit before any comp existed, or a transient error) would otherwise stay
		// stuck for 30 min and hide the section. Always refetch on mount — the
		// cached value still renders instantly while fresh data lands (SWR).
		fetchZktCompetitions();
	}, []);

	useEffect(() => {
		if (me) {
			setMyComps((prev) => prev ?? shownList(myWcaKey()));
			setMyZktComps((prev) => prev ?? shownList(myZktKey()));
		}
		if (me && isOlderThan(peekCached(myWcaKey()), LIST_CACHE_TTL)) fetchMyCompetitions();
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
			storeCached(ZKT_LIST_KEY, data, 'local');
			zktRetryRef.current.attempt = 0;
			if (mountedRef.current) {
				setZktComps(data);
				setZktError(false);
			}
		} catch (err) {
			// Keep whatever is on screen (the module cache outlives its TTL here on
			// purpose) and ask again shortly. Only an empty screen gets a notice.
			const fallback = peekCached<any[]>(ZKT_LIST_KEY)?.data || null;
			if (mountedRef.current) {
				if (fallback) setZktComps(fallback);
				setZktError(!fallback);
			}
			scheduleRetry(zktRetryRef, fetchZktCompetitions);
		}
	}

	async function fetchMyZktCompetitions() {
		try {
			const res = await gqlMutate(ZKT_MY_COMPETITIONS_QUERY, {});
			const data = res?.data?.zktPublicMyCompetitions || [];
			storeCached(myZktKey(), data, 'local');
			myZktRetryRef.current.attempt = 0;
			if (mountedRef.current) setMyZktComps(data);
		} catch (err) {
			// No ZKT link is not an error (the server answers []), so this is a real
			// failure: keep the last known registrations and retry.
			const fallback = peekCached<any[]>(myZktKey())?.data || null;
			if (mountedRef.current && fallback) setMyZktComps(fallback);
			scheduleRetry(myZktRetryRef, fetchMyZktCompetitions);
		}
	}

	// App resume / tab focus: silently refresh in background — so users see new competitions
	// without manually refreshing
	useEffect(() => {
		const silentRefresh = () => {
			if (document.visibilityState !== 'visible') return;
			// If last fetch was older than 2 minutes, refetch (avoid excessive requests)
			const RESUME_REFRESH_MS = 2 * 60 * 1000;
			if (isOlderThan(peekCached(WCA_LIST_KEY), RESUME_REFRESH_MS)) fetchCompetitions();
			if (me) {
				if (isOlderThan(peekCached(myWcaKey()), RESUME_REFRESH_MS)) fetchMyCompetitions();
				if (isOlderThan(peekCached(myZktKey()), RESUME_REFRESH_MS)) fetchMyZktCompetitions();
			}
			if (isOlderThan(peekCached(ZKT_LIST_KEY), RESUME_REFRESH_MS)) fetchZktCompetitions();
		};
		window.addEventListener('focus', silentRefresh);
		window.addEventListener('online', silentRefresh);
		document.addEventListener('visibilitychange', silentRefresh);
		return () => {
			window.removeEventListener('focus', silentRefresh);
			window.removeEventListener('online', silentRefresh);
			document.removeEventListener('visibilitychange', silentRefresh);
		};
	}, [me]);

	// Prefetch: user's competitions + next 3 upcoming competitions.
	// Keyed on the ids, not on the arrays: every list response is a new array
	// with the same competitions, and re-running on each one fired the same
	// prefetches three times per visit. prefetchCompetitionDetail also skips
	// anything fetched in the last minute or already in flight.
	const myPrefetchKey = (myAllComps || [])
		.slice(0, 3)
		.map((c: any) => (c.__zkt ? `zkt-${c.slug || c.id}` : c.competitionId || c.id))
		.join('|');
	useEffect(() => {
		if (!myPrefetchKey) return;
		const timers = myPrefetchKey.split('|').map((id, i) =>
			setTimeout(() => prefetchCompetitionDetail(id), 500 + i * 200)
		);
		return () => timers.forEach(clearTimeout);
	}, [myPrefetchKey]);

	const listPrefetchKey = (competitions || [])
		.slice(0, 3)
		.map((c: any) => c.id)
		.join('|');
	useEffect(() => {
		if (!listPrefetchKey) return;
		// Prefetch first 3 from general list (usually the nearest upcoming)
		const timers = listPrefetchKey.split('|').map((id, i) =>
			setTimeout(() => prefetchCompetitionDetail(id), 1500 + i * 300)
		);
		return () => timers.forEach(clearTimeout);
	}, [listPrefetchKey]);

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
			storeCached(myWcaKey(), data, 'local');
			if (mountedRef.current) setMyComps(data);
		} catch (err) {
			console.warn('[CompetitionList] myWcaCompetitions fetch failed:', err);
			// Keep the last known registrations rather than blanking them, the
			// same rule the ZKT lists follow.
			// With no connection and nothing on the device, "no registrations" would
			// be a false answer; keep the section loading until the connection is back.
			const known = peekCached<any[]>(myWcaKey())?.data;
			const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
			if (mountedRef.current) setMyComps(known || (offline ? null : []));
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
				storeCached(WCA_LIST_KEY, data, 'local');
			} else {
				console.warn('[CompetitionList] wcaCompetitions returned empty array — cache not written');
			}
			if (mountedRef.current) setCompetitions(data);
		} catch (err: any) {
			console.warn('[CompetitionList] wcaCompetitions fetch failed:', err);
			// A failed refresh keeps the list that is already on screen; the error
			// box is only for an empty page.
			const fallback = peekCached<any[]>(WCA_LIST_KEY)?.data || null;
			if (mountedRef.current) {
				if (fallback) {
					setCompetitions(fallback);
				} else {
					setLoadError(err?.message || 'network_error');
					setCompetitions(null);
				}
			}
		}
	}

	function handleRetry() {
		setCompetitions(null);
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
				.filter((c: any) => !isPastCompetition(c, todayStr))
				// Soonest first — the next competition is the one people look for.
				.sort((a: any, b: any) => (a.start_date || '').localeCompare(b.start_date || ''))
		);
	}, [showSearchResults, zktComps, myZktComps, todayStr]);

	// Compact row for the long discovery lists (upcoming + search results), where
	// dozens of competitions have to stay scannable. Cards the viewer has a stake
	// in use renderShowcaseCard below instead.
	function renderCompCard(comp: any) {
		// Only search results reach this in a finished state — the lists above are
		// filtered — but the card still has to show it as over when they do.
		const isFinished = isPastCompetition(comp, todayStr);
		const isOngoing = !isFinished && comp.start_date <= todayStr && comp.end_date >= todayStr;
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
		const isFinished = isPastCompetition(comp, todayStr);
		const isOngoing = !isFinished && comp.start_date <= todayStr && comp.end_date >= todayStr;
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
					src={isZkt ? zktBadge : resourceUri('/images/logos/wca_logo.svg')}
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
		// The federation's own badge, not the product logo: these competitions are run
		// by Zeka Küpü Türkiye, and `zkt-logo.png` is the Zkt Timer mark. Its lettering
		// follows the theme (useZktBadge); the WCA crest serves both themes as one file.
		const logo = isZktService ? zktBadge : resourceUri('/images/logos/wca_logo.svg');
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
				<img src={logo} alt="" aria-hidden="true" className={b('connect-row-logo')} />
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
			     see the section too, whichever way that match was made. Counted on
			     the filtered list: a competitor whose only ZKT registration is in the
			     past has nothing upcoming, so the section would just say "none". */}
			{!compSearch.trim() && (hasWcaLink || (myAllComps?.length ?? 0) > 0) && (
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
			{/* While the ZKT list has never loaded (first visit, or the federation
			     was unreachable with nothing cached), say so in place instead of
			     leaving the section out: an absent section reads as "no ZKT
			     competitions", which on competition day is the wrong message. */}
			{!compSearch.trim() && zktCards.length === 0 && (zktComps === null || zktError) && (
				<div className={b('zkt-competitions')}>
					<h3 className={b('section-title')}>
						<Trophy weight="fill" style={{marginRight: 8, verticalAlign: 'text-bottom', color: 'rgb(var(--primary-color))'}} />
						{t('my_schedule.zkt_competitions')}
					</h3>
					<p className={b('my-competitions-empty')}>
						{zktError ? t('my_schedule.zkt_list_unavailable') : t('my_schedule.loading_competitions')}
					</p>
				</div>
			)}

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
