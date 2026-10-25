import { useEffect, useState } from 'react';
import { useSettings } from './useSettings';
import { useSessionDb } from './useSessionDb';
import { resolveActiveSessionId, subscribeTimerSession } from '../../db/sessions/active';

/**
 * The session the timer is solving in: the timer header's temporary pick, or the main
 * session when there is none (db/sessions/active.ts). Everything on the timer that reads
 * or writes "the current session" goes through this; the Sessions page keeps reading
 * `session_id`, which is the main session.
 */
export function useActiveSessionId(): string | null {
	const mainSessionId = useSettings('session_id') as string | null;
	// A deleted session drops back to the main one.
	useSessionDb();
	const [, setVersion] = useState(0);

	useEffect(() => subscribeTimerSession(() => setVersion((v) => v + 1)), []);

	return resolveActiveSessionId(mainSessionId);
}
