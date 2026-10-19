import type {
	BattleCancelReason,
	BattleErrorPayload,
	CancelledPayload,
	ChallengeStatePayload,
	MatchedPayload,
	MatchResultPayload,
	MatchStatePayload,
	OpponentConnectionPayload,
	OpponentStatePayload,
	QueueStatePayload,
	RematchStatePayload,
	RoundResultPayload,
	RoundSolveView,
	RoundStartPayload,
} from '../../../../shared/battle/events';
import type {BattleSide, BattleWinner} from '../../../../shared/battle/types';

/**
 * What the Online Battle screen shows, rebuilt from the server's events (design 4.1).
 *
 * The server owns every transition; this reducer only folds its events into one view.
 * The player's own cube progress (scrambling, inspecting, solving) is not here: it comes
 * from the device's engine in useBattleCube and is drawn next to this state.
 *
 * Pure on purpose, so the whole flow is testable without a socket.
 */

export type OnlineStage =
	/** Queue screen, not searching. */
	| 'idle'
	| 'searching'
	/** From battle:matched until battle:match_result. */
	| 'match'
	| 'result'
	| 'cancelled'
	/** The inviter waits on a duel invite (challenge null while it is being opened). */
	| 'challenge'
	/** A duel invite was accepted on this screen; the server is starting the duel. */
	| 'accepting';

export interface OnlineMatchView {
	matchId: string;
	matched: MatchedPayload;
	/** The round being played, 0 before the first round_start. */
	round: number;
	current: RoundStartPayload | null;
	score: {a: number; b: number};
	rounds: RoundResultPayload[];
	opponent: OpponentStatePayload | null;
	opponentConnected: boolean;
	/** Server clock: the opponent loses the round if not back by then. */
	opponentGraceUntil: number | null;
	/** Result of the round just played, shown until the next round starts. */
	lastRoundResult: RoundResultPayload | null;
}

export interface OnlineBattleState {
	stage: OnlineStage;
	queue: QueueStatePayload | null;
	match: OnlineMatchView | null;
	result: MatchResultPayload | null;
	rematch: RematchStatePayload | null;
	cancelReason: BattleCancelReason | null;
	error: BattleErrorPayload | null;
	/** The inviter's own invite while stage is 'challenge'; kept with its end status once it ends. */
	challenge: ChallengeStatePayload | null;
}

export const initialOnlineBattleState: OnlineBattleState = {
	stage: 'idle',
	queue: null,
	match: null,
	result: null,
	rematch: null,
	cancelReason: null,
	error: null,
	challenge: null,
};

export type OnlineBattleAction =
	| {type: 'queue_join_sent'}
	| {type: 'queue_left'}
	| {type: 'queue_state'; payload: QueueStatePayload}
	| {type: 'matched'; payload: MatchedPayload}
	| {type: 'round_start'; payload: RoundStartPayload}
	| {type: 'opponent_state'; payload: OpponentStatePayload}
	| {type: 'round_result'; payload: RoundResultPayload}
	| {type: 'match_result'; payload: MatchResultPayload}
	| {type: 'rematch_state'; payload: RematchStatePayload}
	| {type: 'opponent_connection'; payload: OpponentConnectionPayload}
	| {type: 'match_state'; payload: MatchStatePayload}
	| {type: 'cancelled'; payload: CancelledPayload}
	| {type: 'error'; payload: BattleErrorPayload}
	| {type: 'clear_error'}
	| {type: 'challenge_create_sent'}
	| {type: 'challenge_state'; payload: ChallengeStatePayload}
	/** The inviter closed the invite screen (cancel, or back after it ended). */
	| {type: 'challenge_left'}
	| {type: 'challenge_accept_sent'}
	/** Leave a cancelled match or a result screen, back to the queue screen. */
	| {type: 'dismiss'};

function newMatchView(matched: MatchedPayload): OnlineMatchView {
	return {
		matchId: matched.matchId,
		matched,
		round: 0,
		current: null,
		score: {a: 0, b: 0},
		rounds: [],
		opponent: null,
		opponentConnected: true,
		opponentGraceUntil: null,
		lastRoundResult: null,
	};
}

/** Events of another match (a late packet after a rematch, say) are dropped. */
function isCurrentMatch(state: OnlineBattleState, matchId: string | undefined): boolean {
	return !!state.match && (!matchId || state.match.matchId === matchId);
}

export function onlineBattleReducer(state: OnlineBattleState, action: OnlineBattleAction): OnlineBattleState {
	switch (action.type) {
		case 'queue_join_sent':
			return {...state, stage: 'searching', queue: null, error: null, cancelReason: null};

		case 'queue_left':
			if (state.stage !== 'searching') return state;
			return {...state, stage: 'idle', queue: null};

		case 'queue_state': {
			const q = action.payload;
			if (!q.searching) {
				// The server took us out of the queue (still-here timeout, a match elsewhere).
				return state.stage === 'searching' ? {...state, stage: 'idle', queue: q} : {...state, queue: q};
			}
			// A late queue_state must not pull a running match back to the queue screen.
			if (state.stage === 'match') return state;
			return {...state, stage: 'searching', queue: q};
		}

		case 'matched':
			return {
				...state,
				stage: 'match',
				queue: null,
				match: newMatchView(action.payload),
				result: null,
				rematch: null,
				cancelReason: null,
				error: null,
				challenge: null,
			};

		case 'round_start': {
			if (!isCurrentMatch(state, action.payload.matchId)) return state;
			const match = state.match as OnlineMatchView;
			return {
				...state,
				match: {
					...match,
					round: action.payload.round,
					current: action.payload,
					opponent: null,
					lastRoundResult: null,
				},
			};
		}

		case 'opponent_state': {
			if (!isCurrentMatch(state, action.payload.matchId)) return state;
			const match = state.match as OnlineMatchView;
			if (action.payload.round !== match.round) return state;
			return {...state, match: {...match, opponent: {...(match.opponent || {}), ...action.payload}}};
		}

		case 'round_result': {
			if (!isCurrentMatch(state, action.payload.matchId)) return state;
			const match = state.match as OnlineMatchView;
			const rounds = match.rounds.filter((r) => r.round !== action.payload.round).concat(action.payload);
			rounds.sort((x, y) => x.round - y.round);
			return {
				...state,
				match: {...match, score: action.payload.score, rounds, lastRoundResult: action.payload},
			};
		}

		case 'match_result': {
			if (!isCurrentMatch(state, action.payload.matchId)) return state;
			return {...state, stage: 'result', result: action.payload, rematch: null};
		}

		case 'rematch_state': {
			if (!isCurrentMatch(state, action.payload.matchId)) return state;
			return {...state, rematch: action.payload};
		}

		case 'opponent_connection': {
			if (!isCurrentMatch(state, action.payload.matchId)) return state;
			const match = state.match as OnlineMatchView;
			return {
				...state,
				match: {
					...match,
					opponentConnected: action.payload.connected,
					opponentGraceUntil: action.payload.connected ? null : action.payload.graceUntil ?? null,
				},
			};
		}

		case 'match_state': {
			const s = action.payload;
			const base = state.match && state.match.matchId === s.matchId ? state.match : newMatchView(s.matched);
			const last = s.phase === 'round_result' ? s.rounds[s.rounds.length - 1] || null : null;
			return {
				...state,
				stage: 'match',
				queue: null,
				result: null,
				cancelReason: null,
				challenge: null,
				match: {
					...base,
					matched: s.matched,
					round: s.round,
					current: s.current,
					score: s.score,
					rounds: s.rounds,
					opponent: s.opponent,
					opponentConnected: s.opponentConnected,
					opponentGraceUntil: s.opponentConnected ? null : base.opponentGraceUntil,
					lastRoundResult: last,
				},
			};
		}

		case 'cancelled': {
			const {reason, matchId} = action.payload;
			// The answer to a RESUME sent on page load when there was no match to resume.
			if (reason === 'not_found' && state.stage !== 'match') return state;
			if (matchId && state.match && state.match.matchId !== matchId) return state;
			return {...state, stage: 'cancelled', cancelReason: reason, queue: null, rematch: null};
		}

		case 'error':
			// Errors that refuse a queue join, an invite or an accept put the screen back where
			// the user can act. An invite that is already open stays open.
			if (state.stage === 'searching' || state.stage === 'accepting' || (state.stage === 'challenge' && !state.challenge)) {
				return {...state, stage: 'idle', queue: null, challenge: null, error: action.payload};
			}
			return {...state, error: action.payload};

		case 'clear_error':
			return state.error ? {...state, error: null} : state;

		case 'dismiss':
			if (state.stage === 'cancelled' || state.stage === 'result') {
				return {...initialOnlineBattleState};
			}
			return state;

		case 'challenge_create_sent':
			if (state.stage !== 'idle') return state;
			return {...state, stage: 'challenge', challenge: null, error: null, cancelReason: null};

		case 'challenge_state': {
			// Only the inviter's waiting screen listens. An ACCEPTED answer is followed by the
			// match itself (MATCHED, or MATCH_STATE after a reconnect), which moves the screen.
			if (state.stage !== 'challenge') return state;
			const c = action.payload;
			if (state.challenge && state.challenge.code !== c.code && c.status !== 'PENDING') return state;
			if (c.status === 'ACCEPTED') return state;
			return {...state, challenge: c};
		}

		case 'challenge_left':
			if (state.stage !== 'challenge') return state;
			return {...state, stage: 'idle', challenge: null};

		case 'challenge_accept_sent':
			if (state.stage !== 'idle') return state;
			return {...state, stage: 'accepting', error: null, cancelReason: null};
	}
	return state;
}

// ── Readers ──────────────────────────────────────────────────────────────────

export function otherSide(side: BattleSide): BattleSide {
	return side === 'A' ? 'B' : 'A';
}

export function sideScore(score: {a: number; b: number}, side: BattleSide): number {
	return side === 'A' ? score.a : score.b;
}

export function sideSolve(round: RoundResultPayload, side: BattleSide): RoundSolveView {
	return side === 'A' ? round.a : round.b;
}

/** The open invite the inviter is waiting on, or null. */
export function pendingChallengeCode(state: OnlineBattleState): string | null {
	return state.stage === 'challenge' && state.challenge?.status === 'PENDING' ? state.challenge.code : null;
}

export type RoundOutcome = 'won' | 'lost' | 'draw';

export function outcomeFor(winner: BattleWinner, side: BattleSide): RoundOutcome {
	if (winner === 'DRAW') return 'draw';
	return winner === side ? 'won' : 'lost';
}
