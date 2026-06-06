import {getStore} from '../components/store';
import {isPro, isProEnabled} from './pro';

/**
 * READ gating: can the current user pull full solve data (history/stats) from the server?
 * Pro-only when Pro is enabled — Basic users keep solves local-only on the READ side,
 * so Pro's value (cross-device history, stats, replay) is preserved.
 * Also controls offline-hash sync, which is a read-cache invalidation mechanism.
 */
export function canReadSync(): boolean {
	if (!isProEnabled()) return true;
	const me = getStore()?.getState()?.account?.me;
	return isPro(me);
}

/**
 * WRITE gating: can the current user push solves/sessions to the server?
 * Full-sync: every logged-in user writes. Server solve/session WRITE mutations are
 * gated [LOGGED_IN]. This enables admin visibility, data-loss prevention, and recovery,
 * without exposing data back to Basic users in-app (READ stays Pro).
 */
export function canWriteSync(): boolean {
	const me = getStore()?.getState()?.account?.me;
	return !!me;
}
