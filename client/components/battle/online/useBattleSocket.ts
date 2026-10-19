import {useCallback, useEffect, useReducer, useRef} from 'react';
import {socketClient} from '../../../util/socket/socketio';
import {TIME_SYNC_SAMPLES, BATTLE_PUZZLE} from '../../../../shared/battle/config';
import {
	BattleClientEvent,
	BattleServerEvent,
	type BattleCubeInfo,
	type ChallengeAcceptPayload,
	type ChallengeCreatePayload,
	type ChallengeStatePayload,
	type ProgressPayload,
	type QueueJoinPayload,
	type ScrambleDonePayload,
	type SolveDonePayload,
	type SolveStartPayload,
	type TimeSyncAck,
} from '../../../../shared/battle/events';
import {initialOnlineBattleState, onlineBattleReducer, OnlineBattleAction, pendingChallengeCode} from './battle_state';

/** How long one time sync sample may take before it is given up. */
const TIME_SYNC_TIMEOUT_MS = 2000;

/**
 * Pick the clock offset from round trip samples: the shortest trip carries the least
 * asymmetry, so its midpoint is the best guess of when the server read its clock.
 * Returns serverNow - localNow, or null without samples.
 */
export function offsetFromSamples(samples: {sentAt: number; receivedAt: number; serverNow: number}[]): number | null {
	let best: {rtt: number; offset: number} | null = null;
	for (const s of samples) {
		const rtt = s.receivedAt - s.sentAt;
		if (!Number.isFinite(rtt) || rtt < 0) continue;
		const offset = s.serverNow - (s.sentAt + s.receivedAt) / 2;
		if (!best || rtt < best.rtt) best = {rtt, offset};
	}
	return best ? Math.round(best.offset) : null;
}

/** Server events and the reducer action each one becomes. */
const SERVER_EVENTS: [BattleServerEvent, OnlineBattleAction['type']][] = [
	[BattleServerEvent.QUEUE_STATE, 'queue_state'],
	[BattleServerEvent.MATCHED, 'matched'],
	[BattleServerEvent.ROUND_START, 'round_start'],
	[BattleServerEvent.OPPONENT_STATE, 'opponent_state'],
	[BattleServerEvent.ROUND_RESULT, 'round_result'],
	[BattleServerEvent.MATCH_RESULT, 'match_result'],
	[BattleServerEvent.REMATCH_STATE, 'rematch_state'],
	[BattleServerEvent.OPPONENT_CONNECTION, 'opponent_connection'],
	[BattleServerEvent.MATCH_STATE, 'match_state'],
	[BattleServerEvent.CANCELLED, 'cancelled'],
	[BattleServerEvent.ERROR, 'error'],
	[BattleServerEvent.CHALLENGE_STATE, 'challenge_state'],
];

/**
 * The Online Battle socket session (design 4.11).
 *
 * Folds the server's events into one view (battle_state.ts) and exposes one function per
 * client event. Also keeps the clock offset to the server (design 4.8): every deadline
 * arrives in server time and `toLocal` turns it into this device's clock.
 *
 * Reconnects: on every (re)connect the hook asks the server to resume. During a match that
 * returns the full match state; with nothing to resume the server answers `not_found`,
 * which the reducer ignores outside a match. A search that the drop cut off (the server
 * drops a disconnected socket from the queue, design 4.6) is restarted, and an open duel
 * invite is taken back by the new socket (the server keeps it CHALLENGE_HOST_GRACE_SEC).
 */
export function useBattleSocket(enabled: boolean) {
	const [state, dispatch] = useReducer(onlineBattleReducer, initialOnlineBattleState);
	const offsetRef = useRef(0);
	const stateRef = useRef(state);
	stateRef.current = state;
	/** The last queue_join payload, for re-joining after a reconnect. */
	const joinRef = useRef<QueueJoinPayload | null>(null);
	const syncRunRef = useRef(0);
	/** An invite was asked for and its code has not arrived yet. */
	const creatingRef = useRef(false);

	const emit = useCallback((event: BattleClientEvent, payload?: unknown, ack?: (res: any) => void) => {
		const socket = socketClient();
		if (!socket) return;
		if (ack) socket.emit(event, payload ?? {}, ack);
		else socket.emit(event, payload ?? {});
	}, []);

	const syncClock = useCallback(async () => {
		const socket = socketClient();
		if (!socket) return;
		const run = ++syncRunRef.current;
		const samples: {sentAt: number; receivedAt: number; serverNow: number}[] = [];
		for (let i = 0; i < TIME_SYNC_SAMPLES; i++) {
			const sample = await new Promise<{sentAt: number; receivedAt: number; serverNow: number} | null>((resolve) => {
				const sentAt = Date.now();
				const timer = setTimeout(() => resolve(null), TIME_SYNC_TIMEOUT_MS);
				emit(BattleClientEvent.TIME_SYNC, {}, (ack: TimeSyncAck) => {
					clearTimeout(timer);
					const serverNow = Number(ack?.serverNow);
					resolve(Number.isFinite(serverNow) ? {sentAt, receivedAt: Date.now(), serverNow} : null);
				});
			});
			// A newer sync started (a reconnect in the middle): let that one finish.
			if (run !== syncRunRef.current) return;
			if (sample) samples.push(sample);
		}
		const offset = offsetFromSamples(samples);
		if (offset != null) offsetRef.current = offset;
	}, [emit]);

	useEffect(() => {
		if (!enabled) return;
		const socket = socketClient();
		if (!socket) return;

		const handlers = SERVER_EVENTS.map(([event, type]) => {
			const handler = (payload: any) => {
				if (type === 'challenge_state') {
					creatingRef.current = false;
					// An invite this screen no longer waits on (cancelled while it was being opened).
					const c = payload as ChallengeStatePayload;
					if (c?.status === 'PENDING' && stateRef.current.stage !== 'challenge') {
						socket.emit(BattleClientEvent.CHALLENGE_CANCEL, {code: c.code});
						return;
					}
				}
				if (type === 'error' || type === 'matched') creatingRef.current = false;
				dispatch({type, payload} as OnlineBattleAction);
				if (type === 'matched' || type === 'match_state') void syncClock();
			};
			socket.on(event, handler);
			return [event, handler] as const;
		});

		const onConnect = () => {
			const current = stateRef.current;
			if (current.stage === 'searching' && joinRef.current) {
				socket.emit(BattleClientEvent.QUEUE_JOIN, joinRef.current);
				return;
			}
			const code = pendingChallengeCode(current);
			if (code) {
				// The invite comes back to this socket; an accept that raced the drop is a match
				// by now, which the plain RESUME brings back.
				socket.emit(BattleClientEvent.CHALLENGE_RESUME, {code});
				socket.emit(BattleClientEvent.RESUME, {});
				return;
			}
			const matchId = current.stage === 'match' || current.stage === 'result' ? current.match?.matchId : undefined;
			socket.emit(BattleClientEvent.RESUME, matchId ? {matchId} : {});
		};
		socket.on('connect', onConnect);
		if (socket.connected) onConnect();

		return () => {
			for (const [event, handler] of handlers) socket.off(event, handler);
			socket.off('connect', onConnect);
		};
	}, [enabled, syncClock]);

	const joinQueue = useCallback(
		(cube: BattleCubeInfo) => {
			const payload: QueueJoinPayload = {puzzle: BATTLE_PUZZLE, cube};
			joinRef.current = payload;
			dispatch({type: 'queue_join_sent'});
			emit(BattleClientEvent.QUEUE_JOIN, payload);
		},
		[emit]
	);

	const leaveQueue = useCallback(() => {
		joinRef.current = null;
		dispatch({type: 'queue_left'});
		emit(BattleClientEvent.QUEUE_LEAVE);
	}, [emit]);

	/** Page unmount: tell the server, without touching state that is going away. */
	const leaveQueueOnExit = useCallback(() => {
		if (!joinRef.current) return;
		joinRef.current = null;
		emit(BattleClientEvent.QUEUE_LEAVE);
	}, [emit]);

	const createChallenge = useCallback(
		(cube: BattleCubeInfo, toUsername?: string | null) => {
			const payload: ChallengeCreatePayload = {puzzle: BATTLE_PUZZLE, cube};
			if (toUsername) payload.toUsername = toUsername;
			creatingRef.current = true;
			dispatch({type: 'challenge_create_sent'});
			emit(BattleClientEvent.CHALLENGE_CREATE, payload);
		},
		[emit]
	);

	/** Closes the invite screen; an open invite dies with it. */
	const leaveChallenge = useCallback(() => {
		const code = pendingChallengeCode(stateRef.current);
		dispatch({type: 'challenge_left'});
		if (code) emit(BattleClientEvent.CHALLENGE_CANCEL, {code});
	}, [emit]);

	/**
	 * Page unmount: the inviter left, so the invite dies (owner decision). One still being
	 * opened is cancelled as soon as its code arrives, since this screen's listener is gone.
	 */
	const leaveChallengeOnExit = useCallback(() => {
		const code = pendingChallengeCode(stateRef.current);
		if (code) {
			emit(BattleClientEvent.CHALLENGE_CANCEL, {code});
			return;
		}
		const socket = socketClient();
		if (!creatingRef.current || !socket) return;
		creatingRef.current = false;
		const once = (c: ChallengeStatePayload) => {
			socket.off(BattleServerEvent.CHALLENGE_STATE, once);
			if (c?.status === 'PENDING') socket.emit(BattleClientEvent.CHALLENGE_CANCEL, {code: c.code});
		};
		socket.on(BattleServerEvent.CHALLENGE_STATE, once);
		setTimeout(() => socket.off(BattleServerEvent.CHALLENGE_STATE, once), 15000);
	}, [emit]);

	const acceptChallenge = useCallback(
		(code: string, cube: BattleCubeInfo) => {
			const payload: ChallengeAcceptPayload = {code, puzzle: BATTLE_PUZZLE, cube};
			dispatch({type: 'challenge_accept_sent'});
			emit(BattleClientEvent.CHALLENGE_ACCEPT, payload);
		},
		[emit]
	);

	const actions = {
		joinQueue,
		leaveQueue,
		leaveQueueOnExit,
		createChallenge,
		leaveChallenge,
		leaveChallengeOnExit,
		acceptChallenge,
		stillHere: useCallback(() => emit(BattleClientEvent.QUEUE_STILL_HERE), [emit]),
		scrambleDone: useCallback((p: ScrambleDonePayload) => emit(BattleClientEvent.SCRAMBLE_DONE, p), [emit]),
		solveStart: useCallback((p: SolveStartPayload) => emit(BattleClientEvent.SOLVE_START, p), [emit]),
		progress: useCallback((p: ProgressPayload) => emit(BattleClientEvent.PROGRESS, p), [emit]),
		solveDone: useCallback((p: SolveDonePayload) => emit(BattleClientEvent.SOLVE_DONE, p), [emit]),
		giveUp: useCallback((matchId: string) => emit(BattleClientEvent.GIVE_UP, {matchId}), [emit]),
		rematch: useCallback((matchId: string, accept: boolean) => emit(BattleClientEvent.REMATCH, {matchId, accept}), [emit]),
		report: useCallback((matchId: string, reason: string) => emit(BattleClientEvent.REPORT, {matchId, reason}), [emit]),
		clearError: useCallback(() => dispatch({type: 'clear_error'}), []),
		dismiss: useCallback(() => {
			joinRef.current = null;
			dispatch({type: 'dismiss'});
		}, []),
	};

	/** Server clock to this device's clock. */
	const toLocal = useCallback((serverMs: number) => serverMs - offsetRef.current, []);

	return {state, actions, toLocal};
}
