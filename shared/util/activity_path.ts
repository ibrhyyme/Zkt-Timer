// Maps a raw URL pathname to a stable, low-cardinality page category used by the
// admin daily-activity breakdown. The client sends its raw `window.location.pathname`
// and the SERVER normalizes here before persisting — a single source of truth keeps
// client/server from drifting and strips IDs (usernames, share codes) from storage.
//
// Categories mirror the route groups in client/components/layout/Routes.ts.

export const ACTIVITY_CATEGORIES = [
	'timer',
	'trainer',
	'solves',
	'solve_detail',
	'sessions',
	'stats',
	'competitions',
	'zkt_competitions',
	'rooms',
	'battle',
	'rankings',
	'pro',
	'account',
	'settings',
	'admin',
	'organizer',
	'profile',
	'landing',
	'other',
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export function normalizeActivityPath(pathname: string): ActivityCategory {
	if (!pathname || typeof pathname !== 'string') return 'other';

	// Drop query/hash, lowercase, take the first non-empty path segment.
	const clean = pathname.split('?')[0].split('#')[0].toLowerCase();
	const first = clean.split('/').filter(Boolean)[0] || '';

	switch (first) {
		case '':
			return 'landing'; // root "/"
		case 'timer':
			return 'timer';
		case 'trainer':
			return 'trainer'; // all sub-modes (standard/smart/recognition/efficiency/ollcp) collapse here
		case 'solves':
			return 'solves';
		case 'solve':
			return 'solve_detail'; // /solve/:shareCode
		case 'sessions':
			return 'sessions';
		case 'stats':
			return 'stats';
		case 'competitions':
			return 'competitions'; // WCA competitions
		case 'zkt-competitions':
		case 'zkt-records':
		case 'zkt-rankings':
			return 'zkt_competitions';
		case 'rooms':
			return 'rooms';
		case 'battle':
			return 'battle';
		case 'ranks':
			return 'rankings';
		case 'pro':
			return 'pro';
		case 'account':
			return 'account';
		case 'settings':
			return 'settings';
		case 'admin':
			return 'admin';
		case 'organizer':
			return 'organizer';
		case 'user':
			return 'profile'; // /user/:username
		case 'welcome':
		case 'terms':
		case 'privacy':
		case 'credits':
			return 'landing';
		default:
			return 'other';
	}
}
