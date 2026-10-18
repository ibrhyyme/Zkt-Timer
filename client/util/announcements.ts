import {gqlMutateTyped, gqlQueryTyped} from '../components/api';
import {Announcement, GetActiveAnnouncementsDocument, MarkAnnouncementAsViewedDocument} from '../@types/generated/graphql';

/**
 * Active, unseen announcements for the signed-in user, shared by the layout's carousel
 * and the inbox panel.
 *
 * App remounts on every route change (each route is its own <Route> key, map_route.tsx),
 * so both consumers used to refetch on every page switch. One answer per user and
 * language is kept for a minute and concurrent callers share one request.
 *
 * The server only returns announcements this user has not seen, so anything marked
 * viewed must leave the cache too, or the carousel would reopen on the next page.
 */
export const ANNOUNCEMENTS_MAX_AGE_MS = 60 * 1000;

let cached: {key: string; list: Announcement[]; ts: number} | null = null;
let inFlight: {key: string; promise: Promise<Announcement[] | null>} | null = null;

/**
 * `key` identifies whose answer this is (user id + language). `maxAgeMs` 0 asks for a
 * fresh answer, though it still joins a request that is already on its way. Resolves
 * null when the server could not be reached.
 */
export function fetchActiveAnnouncements(key: string, maxAgeMs = ANNOUNCEMENTS_MAX_AGE_MS): Promise<Announcement[] | null> {
	if (cached && cached.key === key && Date.now() - cached.ts < maxAgeMs) {
		return Promise.resolve(cached.list);
	}
	if (inFlight && inFlight.key === key) return inFlight.promise;

	const promise = gqlQueryTyped(GetActiveAnnouncementsDocument, {}, {fetchPolicy: 'no-cache'})
		.then((res) => {
			const list = (res?.data?.getActiveAnnouncements || []) as Announcement[];
			cached = {key, list, ts: Date.now()};
			return list;
		})
		.catch(() => null)
		.finally(() => {
			if (inFlight?.promise === promise) inFlight = null;
		});

	inFlight = {key, promise};
	return promise;
}

/** Marks one announcement seen on the server and drops it from the shared answer. */
export async function markAnnouncementViewed(announcementId: string): Promise<void> {
	await gqlMutateTyped(MarkAnnouncementAsViewedDocument, {announcementId});
	if (cached) {
		cached = {...cached, list: cached.list.filter((a) => a.id !== announcementId)};
	}
}
