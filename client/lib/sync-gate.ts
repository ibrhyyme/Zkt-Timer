import {getStore} from '../components/store';
import {isPro, isProEnabled} from './pro';

/**
 * Returns true if the current user is allowed to sync solves/sessions to the server.
 * When Pro system is disabled globally, everyone syncs.
 * When Pro is enabled, only Pro/Premium users sync.
 */
export function canSync(): boolean {
	if (!isProEnabled()) return true;
	const me = getStore()?.getState()?.account?.me;
	return isPro(me);
}
