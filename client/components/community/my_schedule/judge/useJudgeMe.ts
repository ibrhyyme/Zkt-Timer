import {useCallback, useEffect, useRef, useState} from 'react';
import {fetchJudgeMe, JudgeCallError, toJudgeError} from '../../../../util/judge-api';
import {peekJudgeMe, rememberJudgeMe} from '../../../../util/judge-session';
import {markHydrated} from '../../competition-cache';
import {getJudgeOutbox} from '../../../../util/judge-outbox-device';
import {OutboxSnapshot} from '../../../../util/judge-outbox';
import {JudgeMe} from '../../../../../shared/zkt_judge';

interface Options {
	/** Ask again this often while the page is visible; 0 asks once. */
	pollMs?: number;
	/** The QR on screen: the answer says whether it was decided. */
	jti?: string | null;
	/** No request at all (anonymous viewer, not a ZKT competition). */
	skip?: boolean;
}

/**
 * The member's judging at one competition. Draws the copy kept on the device
 * first, so a reopened app shows the card at once and keeps showing it while
 * the hall Wi-Fi is down; a failed request never replaces what is on screen.
 */
export function useJudgeMe(competitionId: string, userId: string | null | undefined, options: Options = {}) {
	const {pollMs = 0, jti = null, skip = false} = options;
	const [me, setMe] = useState<JudgeMe | null>(() => (skip ? null : peekJudgeMe(competitionId)));
	const [error, setError] = useState<JudgeCallError | null>(null);
	const [loaded, setLoaded] = useState(false);
	const jtiRef = useRef(jti);
	jtiRef.current = jti;
	const running = useRef(false);
	const alive = useRef(true);

	const refresh = useCallback(async (): Promise<JudgeMe | null> => {
		if (skip || !userId || running.current) return null;
		running.current = true;
		try {
			const fresh = await fetchJudgeMe(competitionId, jtiRef.current);
			rememberJudgeMe(competitionId, userId, fresh);
			if (alive.current) {
				setMe(fresh);
				setError(null);
			}
			return fresh;
		} catch (e) {
			if (alive.current) setError(toJudgeError(e));
			return null;
		} finally {
			running.current = false;
			if (alive.current) setLoaded(true);
		}
	}, [competitionId, userId, skip]);

	useEffect(() => {
		alive.current = true;
		markHydrated();
		if (skip || !userId) return;
		// The server render knows nothing of the device copy; pick it up now.
		setMe((current) => current || peekJudgeMe(competitionId));
		void refresh();
		if (!pollMs) return;
		const timer = setInterval(() => {
			if (typeof document !== 'undefined' && document.hidden) return;
			void refresh();
		}, pollMs);
		const onVisible = () => {
			if (!document.hidden) void refresh();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			alive.current = false;
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	}, [competitionId, userId, skip, pollMs, refresh]);

	return {me, setMe, error, loaded, refresh};
}

/** The outbox as React state. */
export function useJudgeOutbox(): OutboxSnapshot {
	const [snapshot, setSnapshot] = useState<OutboxSnapshot>(() => getJudgeOutbox().getSnapshot());
	useEffect(() => {
		const outbox = getJudgeOutbox();
		void outbox.load();
		setSnapshot(outbox.getSnapshot());
		return outbox.subscribe(() => setSnapshot(outbox.getSnapshot()));
	}, []);
	return snapshot;
}
