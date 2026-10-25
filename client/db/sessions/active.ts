import { getSetting } from '../settings/query';
import { fetchSessionById } from './query';

/**
 * The session the timer is solving in, as opposed to the main session.
 *
 * `session_id` is the main session: a synced account setting that only the Sessions page
 * changes ("Make current"). Picking a session in the timer's header is for the solving at
 * hand, and used to overwrite `session_id`, so the Sessions page then showed whatever the
 * timer had last been switched to as the main one. The timer's pick now lives here instead:
 * in memory, for as long as the app is open (owner decision, 2026-10-26), never synced. A
 * reload or a new launch starts the timer on the main session again.
 *
 * Module state rather than a component's, because the layout remounts on every route
 * change (map_route.tsx) and the pick has to survive moving between pages.
 */

let timerSessionId: string | null = null;
const listeners = new Set<() => void>();

function notify(): void {
	listeners.forEach((listener) => listener());
}

/** The session the timer saves into and shows: its own pick while that still exists, else the main one. */
export function resolveActiveSessionId(mainSessionId: string | null): string | null {
	if (timerSessionId && timerSessionId !== mainSessionId && fetchSessionById(timerSessionId)) {
		return timerSessionId;
	}
	return mainSessionId;
}

export function getActiveSessionId(): string | null {
	return resolveActiveSessionId(getSetting('session_id') as string | null);
}

/** The timer header's pick. Picking the main session ends the temporary one. */
export function setTimerSession(id: string | null): void {
	const next = id && id !== getSetting('session_id') ? id : null;
	if (next === timerSessionId) return;
	timerSessionId = next;
	notify();
}

/** Back to the main session: the main one was just set on purpose (Sessions page). */
export function clearTimerSession(): void {
	if (timerSessionId === null) return;
	timerSessionId = null;
	notify();
}

export function subscribeTimerSession(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}
