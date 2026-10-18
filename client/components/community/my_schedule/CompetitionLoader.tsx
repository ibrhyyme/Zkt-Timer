import React, {createContext, useContext, useState, useEffect, useCallback, useRef} from 'react';
import {useHistory} from 'react-router-dom';
import {gqlQueryTyped} from '../../api';
import {
	WcaCompetitionDetailDocument,
	MyCompetitionFollowsDocument,
} from '../../../@types/generated/graphql';
import {b} from './shared';
import {resourceUri} from '../../../util/storage';
import AccountRequired from '../../common/account_required/AccountRequired';
import {Info, ArrowLeft} from 'phosphor-react';
import {useTranslation} from 'react-i18next';
import {prefetchWcaLiveOverview} from './useLiveResults';
import {useMe} from '../../../util/hooks/useMe';
import {useZktBadge} from '../../../util/hooks/useZktBadge';
import {isPro} from '../../../lib/pro';
import {classifyFetchError, retryDelayMs} from './fetch-error';
import {peekCached, loadCached, storeCached, isOlderThan, markHydrated} from '../competition-cache';

interface FollowEntry {
	id: string;
	followed_registrant_id: number;
	followed_wca_id?: string | null;
	followed_name: string;
}

interface CompetitionData {
	detail: any;
	loading: boolean;
	error: string | null;
	follows: FollowEntry[];
	followedIds: Set<number>;
	refetchFollows: () => Promise<void>;
	isFinished: boolean;
}

// Is competition finished? Check if the last day of schedule is before today
function isCompetitionFinished(detail: any): boolean {
	if (!detail?.schedule || !Array.isArray(detail.schedule) || detail.schedule.length === 0) {
		return false; // If no data, saying "finished" would be wrong, allow it
	}
	const dates = detail.schedule
		.map((d: any) => d?.date)
		.filter((d: any) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
	if (dates.length === 0) return false;
	const lastDate = dates.sort()[dates.length - 1];
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const cutoff = new Date(lastDate + 'T00:00:00');
	cutoff.setDate(cutoff.getDate() + 1); // one day after last day at 00:00 — count as active until then
	return today >= cutoff;
}

// Is the competition happening today? Drives the periodic refresh: groups and
// assignments can move during the day, before and after it they do not.
function isCompetitionOngoing(detail: any): boolean {
	if (!Array.isArray(detail?.schedule)) return false;
	const dates: string[] = detail.schedule
		.map((d: any) => d?.date)
		.filter((d: any) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
		.sort();
	if (dates.length === 0) return false;
	const now = new Date();
	const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
	return dates[0] <= today && today <= dates[dates.length - 1];
}

const CompetitionDataContext = createContext<CompetitionData | null>(null);

export function useCompetitionData(): CompetitionData {
	const ctx = useContext(CompetitionDataContext);
	if (!ctx) throw new Error('useCompetitionData must be used within CompetitionLoader');
	return ctx;
}

// The detail is kept on the device (IndexedDB, see competition-cache) and drawn
// from there at once, the fresh copy replacing it in the background: a
// competitor reopening the app on competition day sees their groups straight
// away instead of a loading screen.
//
// FRESH_TTL used to be 0, which made every mount, every list visit and every
// prefetch a real request: the "already fresh" check in prefetch never passed,
// and one visit to the competition list fired about fifteen detail queries.
// Two round trips between the list and a competition were enough to hit the
// server's per-user limit on competition day ("Çok fazla istek"). Within a
// minute the cached copy is used as is; the server's own cache is fresher than
// that anyway.
const FRESH_TTL = 60 * 1000;
// How old a copy on the device may be and still be drawn while the fresh one
// loads. Groups and the programme rarely move within a week; results do, and the
// background refresh brings them.
const STALE_TTL = 7 * 24 * 60 * 60 * 1000;
// A device read normally takes a few milliseconds; past this the page stops
// waiting for it and goes to the network.
const DEVICE_READ_TIMEOUT_MS = 300;
// While the competition is on, groups and assignments can change; refresh this
// often while the page is visible. The server answers from its own cache, so
// this costs the federation nothing extra.
const ONGOING_REFRESH_MS = 2 * 60 * 1000;
const detailKey = (competitionId: string) => `detail:${competitionId}`;
// "No schedule published yet" answers, kept in memory only and only while fresh.
const noSchedule = new Map<string, number>();
// One request per competition at a time, however many callers (page, prefetch,
// resume refresh) ask for it.
const inflight = new Map<string, Promise<any>>();

function fetchDetail(competitionId: string): Promise<any> {
	const running = inflight.get(competitionId);
	if (running) return running;
	const request = gqlQueryTyped(WcaCompetitionDetailDocument, {input: {competitionId}}, {fetchPolicy: 'no-cache'})
		.then((res) => {
			const data = res.data?.wcaCompetitionDetail || null;
			// "No schedule published yet" is remembered too, for as long as an
			// answer counts as fresh. Not caching it made a competition whose
			// programme is not out yet cost a request on every visit and every list
			// prefetch, which is exactly what fills the per-user limit.
			if (data) {
				storeCached(detailKey(competitionId), data, 'idb');
				noSchedule.delete(competitionId);
			} else {
				noSchedule.set(competitionId, Date.now());
			}
			return data;
		})
		.finally(() => {
			inflight.delete(competitionId);
		});
	inflight.set(competitionId, request);
	return request;
}

type Cached = {data: any; isStale: boolean} | null;

function toCached(entry: {data: any; ts: number} | null): Cached {
	if (!entry || isOlderThan(entry, STALE_TTL)) return null;
	return {data: entry.data, isStale: isOlderThan(entry, FRESH_TTL)};
}

// A "not published" answer is only worth keeping while fresh: once the
// organizer publishes, the next visit after a minute has to ask again.
function freshNoSchedule(id: string): boolean {
	const seen = noSchedule.get(id);
	if (seen === undefined) return false;
	if (Date.now() - seen > FRESH_TTL) {
		noSchedule.delete(id);
		return false;
	}
	return true;
}

/** What is in memory right now. */
function getCached(id: string): Cached {
	if (freshNoSchedule(id)) return {data: null, isStale: false};
	return toCached(peekCached(detailKey(id)));
}

/** Memory, then the copy on the device; gives up after a short wait. */
async function getCachedFromDevice(id: string): Promise<Cached> {
	const hit = getCached(id);
	if (hit) return hit;
	const entry = await Promise.race([
		loadCached(detailKey(id)),
		new Promise<null>((resolve) => setTimeout(() => resolve(null), DEVICE_READ_TIMEOUT_MS)),
	]);
	return toCached(entry);
}

interface CompetitionLoaderProps {
	competitionId: string;
	children: React.ReactNode;
}

// Background prefetch helper — can be called externally (for list/hover prefetch).
// Checks the device copy first: on a cold start memory is empty, and asking the
// server for a competition opened a minute ago would only spend the per-user limit.
export function prefetchCompetitionDetail(competitionId: string): void {
	if (inflight.has(competitionId)) return;
	getCachedFromDevice(competitionId)
		.then((cached) => {
			if (cached && !cached.isStale) return; // fresh, no need
			if (inflight.has(competitionId)) return;
			fetchDetail(competitionId).catch(() => {});
		})
		.catch(() => {});
}

export default function CompetitionLoader({competitionId, children}: CompetitionLoaderProps) {
	const {t} = useTranslation();
	const me = useMe();
	const history = useHistory();
	// The ZKT loading mark ships in two versions because its lettering has to
	// invert with the surface behind it.
	const zktBadge = useZktBadge();
	const initialCached = getCached(competitionId);
	const [detail, setDetail] = useState<any>(initialCached?.data || null);
	const [loading, setLoading] = useState(!initialCached);
	// Looking for a copy on the device (a few ms). Nothing is drawn meanwhile, so a
	// competition that is on the device never flashes the loading screen.
	const [checkingDevice, setCheckingDevice] = useState(!initialCached);
	const [error, setError] = useState<string | null>(
		initialCached && initialCached.data === null ? 'my_schedule.no_wcif' : null
	);
	// The server's own sentence, kept alongside the generic key. "Program verisi
	// yüklenemedi" alone sends the organizer to a developer; the actual reason
	// (not signed in, federation unreachable, 500) lets them act on it.
	const [errorDetail, setErrorDetail] = useState<string | null>(null);
	const [follows, setFollows] = useState<FollowEntry[]>([]);
	// Automatic retry after a failed first load. Keyed by competition so moving
	// to another competition starts clean.
	const [retry, setRetry] = useState<{id: string; attempt: number}>({id: competitionId, attempt: 0});
	const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const errorRef = useRef<string | null>(null);
	errorRef.current = error;

	const retryNow = useCallback(() => {
		if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
		retryTimerRef.current = null;
		setRetry((prev) => ({id: competitionId, attempt: prev.id === competitionId ? prev.attempt + 1 : 1}));
	}, [competitionId]);

	// A retry still pending for the previous competition must not fire on this one.
	useEffect(() => () => {
		if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
		retryTimerRef.current = null;
	}, [competitionId]);

	const refetchFollows = useCallback(async () => {
		if (!me || !isPro(me)) {
			setFollows([]);
			return;
		}
		try {
			const res = await gqlQueryTyped(
				MyCompetitionFollowsDocument,
				{competitionId},
				{fetchPolicy: 'no-cache'},
			);
			const data = (res.data as any)?.myCompetitionFollows;
			setFollows(Array.isArray(data) ? data : []);
		} catch {
			// silently continue — empty list is OK for non-Pro users
		}
	}, [competitionId, me]);

	useEffect(() => {
		refetchFollows();
	}, [refetchFollows]);

	// WCA Live overview prefetch — silently load in background when detail is ready
	useEffect(() => {
		if (detail?.wcaLiveCompId) {
			prefetchWcaLiveOverview(competitionId).catch(() => {});
		}
	}, [detail?.wcaLiveCompId, competitionId]);

	useEffect(() => {
		let cancelled = false;
		const isRetry = retry.id === competitionId && retry.attempt > 0;
		markHydrated();
		const memoryHit = getCached(competitionId);
		if (memoryHit || isRetry) {
			settle(memoryHit);
		} else {
			setCheckingDevice(true);
			getCachedFromDevice(competitionId).then((cached) => {
				if (cancelled) return;
				settle(cached);
			});
		}
		return () => {
			cancelled = true;
		};

		function settle(cached: Cached) {
			setCheckingDevice(false);
			load(cached);
		}

		function load(cached: Cached) {
			// A fresh "not published yet" answer: say so without asking again.
			if (cached && cached.data === null) {
				setDetail(null);
				setLoading(false);
				setError('my_schedule.no_wcif');
				setErrorDetail(null);
				return;
			}

			// Data in cache (fresh or stale) → show immediately
			if (cached) {
				setDetail(cached.data);
				setLoading(false);
				setError(null);
				setErrorDetail(null);

				// If stale, silently refresh in background. A failure keeps what is shown.
				if (cached.isStale) {
					fetchDetail(competitionId)
						.then((data) => {
							if (!cancelled && data) setDetail(data);
						})
						.catch(() => {});
				}
				return;
			}

			// Not in cache → show loading, fetch. A retry keeps the message on screen
			// instead of flashing the loading screen every few seconds.
			if (!isRetry) {
				setLoading(true);
				setError(null);
				setErrorDetail(null);
				setDetail(null);
			}

			fetchDetail(competitionId)
				.then((data) => {
					if (cancelled) return;
					if (!data) {
						// The server answers null only when the federation or WCA has no
						// such public competition. Failures arrive as errors below.
						setError('my_schedule.no_wcif');
						setErrorDetail(null);
					} else {
						setDetail(data);
						setError(null);
						setErrorDetail(null);
					}
				})
				.catch((e: any) => {
					if (cancelled) return;
					const info = classifyFetchError(e);

					// A signed-out visitor is not a failure. The server refuses this query
					// with FORBIDDEN, and reporting that as "could not load, try again" was
					// both wrong and unactionable — it also leaked the raw server sentence
					// (in Turkish, on an English page) into a monospace box.
					if (info.kind === 'auth') {
						setError('auth_required');
						setErrorDetail(null);
						return;
					}

					// No connection at all: say that, not "could not load". The page
					// opens by itself once the connection is back (see the online
					// listener below).
					const offline = info.kind === 'network' && typeof navigator !== 'undefined' && navigator.onLine === false;
					setError(offline ? 'offline.page_description' : info.messageKey);
					setErrorDetail(offline ? null : info.detail);
					// Busy federation, rate limit, dropped connection: these pass on their
					// own, so the page asks again by itself instead of leaving a dead box.
					if (info.retryable) {
						const attempt = isRetry ? retry.attempt : 0;
						if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
						retryTimerRef.current = setTimeout(() => {
							retryTimerRef.current = null;
							setRetry({id: competitionId, attempt: attempt + 1});
						}, retryDelayMs(attempt));
					}
				})
				.finally(() => {
					if (!cancelled) setLoading(false);
				});
		}
	}, [competitionId, retry]);

	// Back online: ask at once instead of waiting out the retry delay.
	useEffect(() => {
		const onOnline = () => {
			if (errorRef.current && errorRef.current !== 'auth_required' && errorRef.current !== 'my_schedule.no_wcif') {
				retryNow();
			}
		};
		window.addEventListener('online', onOnline);
		return () => window.removeEventListener('online', onOnline);
	}, [retryNow]);

	// When user returns to app (resuming from background) refresh what is stale,
	// and retry at once if the page is still showing a failure.
	useEffect(() => {
		const handleVisibility = () => {
			if (document.visibilityState !== 'visible') return;
			const cached = getCached(competitionId);
			if (!cached) {
				if (errorRef.current && errorRef.current !== 'auth_required') retryNow();
				return;
			}
			if (!cached.isStale) return;
			fetchDetail(competitionId)
				.then((data) => {
					if (data) setDetail(data);
				})
				.catch(() => {});
		};
		document.addEventListener('visibilitychange', handleVisibility);
		return () => document.removeEventListener('visibilitychange', handleVisibility);
	}, [competitionId, retryNow]);

	// On competition day, keep groups and assignments current while the page is
	// open. Failures keep the data on screen.
	const ongoing = isCompetitionOngoing(detail);
	useEffect(() => {
		if (!ongoing) return;
		const id = setInterval(() => {
			if (document.visibilityState !== 'visible') return;
			fetchDetail(competitionId)
				.then((data) => {
					if (data) setDetail(data);
				})
				.catch(() => {});
		}, ONGOING_REFRESH_MS);
		return () => clearInterval(id);
	}, [competitionId, ongoing]);

	if (checkingDevice) return null;

	if (loading) {
		// The loading screen wears the badge of whichever federation owns the
		// competition being opened; a ZKT competition showing the WCA mark reads
		// as if the wrong page is loading.
		const loadingIsZkt = competitionId?.startsWith('zkt-');
		return (
			<div className={b('wca-loading')}>
				<img
					src={loadingIsZkt ? zktBadge : resourceUri('/images/logos/wca_logo.svg')}
					alt={loadingIsZkt ? 'ZKT' : 'WCA'}
					className={b('wca-loading-logo')}
				/>
				<div className={b('wca-loading-bar')}>
					<div className={b('wca-loading-bar-fill')} />
				</div>
				<span className={b('wca-loading-text')}>{t('my_schedule.loading')}</span>
			</div>
		);
	}

	if (error === 'auth_required') {
		return <AccountRequired descriptionKey="account_required.competition_detail" />;
	}

	// Only reached with nothing to show: any data already on screen stays there
	// when a later refresh fails. The way back to the list stays available,
	// since the page's own back button lives inside the content not rendered here.
	if (error && !detail) {
		const retrying = error !== 'my_schedule.no_wcif';
		return (
			<>
				<button className={b('back')} onClick={() => history.push('/competitions')}>
					<ArrowLeft size={18} />
					{t('my_schedule.back_to_list')}
				</button>
				<div className={b('info-banner', {error: retrying})}>
					<Info size={20} />
					<div className={b('info-banner-body')}>
						<span>{t(error)}</span>
						{errorDetail && <code className={b('info-banner-detail')}>{errorDetail}</code>}
						{retrying && (
							<button className={b('info-banner-retry')} onClick={retryNow}>
								{t('my_schedule.retry')}
							</button>
						)}
					</div>
				</div>
			</>
		);
	}

	const followedIds = new Set<number>(follows.map((f) => f.followed_registrant_id));
	const isFinished = isCompetitionFinished(detail);

	return (
		<CompetitionDataContext.Provider
			value={{detail, loading, error, follows, followedIds, refetchFollows, isFinished}}
		>
			{children}
		</CompetitionDataContext.Provider>
	);
}
