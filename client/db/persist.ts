import { createPersistScheduler, PersistScheduler } from './persist-scheduler';
import { saveLokiDb, updateOfflineHash } from '../components/layout/offline';
import { canReadSync } from '../lib/sync-gate';
import { getStore } from '../components/store';
import { onVisibilityChange } from '../util/app-visibility';

// The one way a data change gets written to IndexedDB (and, for Pro, announced to other
// devices through the offline hash). Timing rules and the reasons for them are in
// persist-scheduler.ts.

let scheduler: PersistScheduler | null = null;
let lifecycleBound = false;

function runIdle(fn: () => void) {
	const ric = typeof window !== 'undefined' ? (window as any).requestIdleCallback : undefined;
	if (typeof ric === 'function') {
		ric(fn, {timeout: 1000});
	} else {
		setTimeout(fn, 0);
	}
}

function getScheduler(): PersistScheduler {
	if (!scheduler) {
		scheduler = createPersistScheduler({
			save: () => saveLokiDb(),
			saveAndHash: () => updateOfflineHash(),
			wantsHash: () => canReadSync(),
			isSolving: () => {
				try {
					return Boolean(getStore()?.getState()?.timer?.solving);
				} catch {
					return false;
				}
			},
			now: () => Date.now(),
			setTimer: (fn, ms) => setTimeout(fn, ms),
			clearTimer: (handle) => clearTimeout(handle),
			runIdle,
		});
	}
	return scheduler;
}

/**
 * Leaving the page is the moment everything pending has to go out: on mobile the app may
 * be killed from the background without another chance.
 */
function bindLifecycle() {
	if (lifecycleBound || typeof window === 'undefined') return;
	lifecycleBound = true;

	onVisibilityChange((visible) => {
		if (!visible) void flushPersist();
	});
	window.addEventListener('pagehide', () => {
		void flushPersist();
	});
}

/** A change was made to local data. `destructive` for deletions and merges. */
export function requestPersist(opts: {destructive?: boolean} = {}): Promise<void> {
	if (typeof window === 'undefined') {
		return Promise.resolve();
	}
	bindLifecycle();
	return getScheduler().request(opts);
}

/** Write whatever is pending now (before a reload, when the page is hidden). */
export function flushPersist(): Promise<void> {
	if (!scheduler) {
		return Promise.resolve();
	}
	return scheduler.flush();
}

/**
 * Drop whatever is pending. Logout and account deletion wipe the database next; a save
 * still queued would write the previous account's data back into it.
 */
export function cancelPersist(): void {
	scheduler?.cancel();
}
