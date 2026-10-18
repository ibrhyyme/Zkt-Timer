import {
	initialOnlineBattleState,
	onlineBattleReducer,
	OnlineBattleAction,
	OnlineBattleState,
	otherSide,
	outcomeFor,
	sideScore,
	sideSolve,
} from '../battle_state';
import type {
	MatchedPayload,
	MatchResultPayload,
	MatchStatePayload,
	RoundResultPayload,
	RoundStartPayload,
} from '../../../../../shared/battle/events';

function matched(matchId = 'm1', side: 'A' | 'B' = 'A'): MatchedPayload {
	return {
		matchId,
		rated: true,
		isRematch: false,
		side,
		you: {rating: 1500, provisional: true, games: 0},
		opponent: {id: 'u2', username: 'ayse_k', avatar: null, rating: 1610, provisional: false},
		preview: {win: 15, draw: 2, loss: -12},
		startsAt: 1000,
	};
}

function roundStart(round: number, matchId = 'm1'): RoundStartPayload {
	return {matchId, round, scramble: "R U R' U'", goAt: 5000 + round, scrambleDeadline: 95000 + round};
}

function roundResult(round: number, winner: 'A' | 'B' | 'DRAW', score: {a: number; b: number}, matchId = 'm1'): RoundResultPayload {
	return {
		matchId,
		round,
		a: {timeMs: 12000, penalty: null},
		b: {timeMs: 13000, penalty: null},
		winner,
		score,
	};
}

function run(actions: OnlineBattleAction[], from: OnlineBattleState = initialOnlineBattleState): OnlineBattleState {
	return actions.reduce(onlineBattleReducer, from);
}

describe('onlineBattleReducer: queue', () => {
	it('join puts the screen in searching and clears an old error', () => {
		const s = run([{type: 'error', payload: {i18nKey: 'x'}}, {type: 'queue_join_sent'}]);
		expect(s.stage).toBe('searching');
		expect(s.error).toBeNull();
	});

	it('queue_state with searching false (still-here timeout) returns to idle', () => {
		const s = run([
			{type: 'queue_join_sent'},
			{type: 'queue_state', payload: {searching: true, waitedSec: 3, searchingCount: 2}},
			{type: 'queue_state', payload: {searching: false, waitedSec: 0, searchingCount: 1}},
		]);
		expect(s.stage).toBe('idle');
	});

	it('a late queue_state does not pull a running match back to the queue', () => {
		const s = run([
			{type: 'queue_join_sent'},
			{type: 'matched', payload: matched()},
			{type: 'queue_state', payload: {searching: true, waitedSec: 9, searchingCount: 2}},
		]);
		expect(s.stage).toBe('match');
	});

	it('a refused join (battle:error while searching) goes back to idle with the error', () => {
		const s = run([
			{type: 'queue_join_sent'},
			{type: 'error', payload: {i18nKey: 'online_battle.errors.queue_cooldown', params: {seconds: 60}}},
		]);
		expect(s.stage).toBe('idle');
		expect(s.error?.i18nKey).toBe('online_battle.errors.queue_cooldown');
		expect(onlineBattleReducer(s, {type: 'clear_error'}).error).toBeNull();
	});

	it('queue_left only acts while searching', () => {
		expect(run([{type: 'queue_left'}])).toBe(initialOnlineBattleState);
		expect(run([{type: 'queue_join_sent'}, {type: 'queue_left'}]).stage).toBe('idle');
	});
});

describe('onlineBattleReducer: match', () => {
	it('plays a full match: rounds, opponent state, result', () => {
		let s = run([{type: 'queue_join_sent'}, {type: 'matched', payload: matched()}]);
		expect(s.stage).toBe('match');
		expect(s.match?.round).toBe(0);

		s = run(
			[
				{type: 'round_start', payload: roundStart(1)},
				{type: 'opponent_state', payload: {matchId: 'm1', round: 1, phase: 'scrambling'}},
				{type: 'opponent_state', payload: {matchId: 'm1', round: 1, phase: 'solving', step: 'cross'}},
			],
			s
		);
		expect(s.match?.round).toBe(1);
		expect(s.match?.opponent?.phase).toBe('solving');
		expect(s.match?.opponent?.step).toBe('cross');

		s = run([{type: 'round_result', payload: roundResult(1, 'A', {a: 1, b: 0})}], s);
		expect(s.match?.score).toEqual({a: 1, b: 0});
		expect(s.match?.lastRoundResult?.round).toBe(1);

		// The next round clears the last result and the opponent's state.
		s = run([{type: 'round_start', payload: roundStart(2)}], s);
		expect(s.match?.lastRoundResult).toBeNull();
		expect(s.match?.opponent).toBeNull();

		const result: MatchResultPayload = {
			matchId: 'm1',
			winner: 'A',
			endReason: 'NORMAL',
			rated: true,
			ratingBefore: 1500,
			ratingAfter: 1547,
			delta: 47,
			provisional: true,
			games: 1,
			rounds: [roundResult(1, 'A', {a: 1, b: 0}), roundResult(2, 'A', {a: 2, b: 0})],
		};
		s = run([{type: 'match_result', payload: result}], s);
		expect(s.stage).toBe('result');
		expect(s.result?.delta).toBe(47);

		s = run([{type: 'dismiss'}], s);
		expect(s).toEqual(initialOnlineBattleState);
	});

	it('drops opponent_state of another round and events of another match', () => {
		let s = run([{type: 'matched', payload: matched()}, {type: 'round_start', payload: roundStart(2)}]);
		const before = s;
		s = run([{type: 'opponent_state', payload: {matchId: 'm1', round: 1, phase: 'finished'}}], s);
		expect(s).toBe(before);
		s = run([{type: 'round_result', payload: roundResult(2, 'B', {a: 0, b: 1}, 'other')}], s);
		expect(s).toBe(before);
	});

	it('replaces a re-sent round result instead of adding it twice', () => {
		const s = run([
			{type: 'matched', payload: matched()},
			{type: 'round_result', payload: roundResult(1, 'DRAW', {a: 0, b: 0})},
			{type: 'round_result', payload: roundResult(1, 'DRAW', {a: 0, b: 0})},
		]);
		expect(s.match?.rounds).toHaveLength(1);
	});

	it('tracks the opponent connection and its grace deadline', () => {
		let s = run([
			{type: 'matched', payload: matched()},
			{type: 'opponent_connection', payload: {matchId: 'm1', connected: false, graceUntil: 20000}},
		]);
		expect(s.match?.opponentConnected).toBe(false);
		expect(s.match?.opponentGraceUntil).toBe(20000);
		s = run([{type: 'opponent_connection', payload: {matchId: 'm1', connected: true}}], s);
		expect(s.match?.opponentConnected).toBe(true);
		expect(s.match?.opponentGraceUntil).toBeNull();
	});

	it('match_state (resume) rebuilds the match from scratch', () => {
		const snapshot: MatchStatePayload = {
			matchId: 'm9',
			matched: matched('m9', 'B'),
			round: 3,
			phase: 'round_result',
			current: roundStart(3, 'm9'),
			score: {a: 1, b: 2},
			rounds: [roundResult(1, 'A', {a: 1, b: 0}, 'm9'), roundResult(3, 'B', {a: 1, b: 2}, 'm9')],
			opponent: null,
			opponentConnected: true,
		};
		const s = run([{type: 'match_state', payload: snapshot}]);
		expect(s.stage).toBe('match');
		expect(s.match?.matched.side).toBe('B');
		expect(s.match?.lastRoundResult?.round).toBe(3);
		expect(sideScore(s.match!.score, 'B')).toBe(2);
	});
});

describe('onlineBattleReducer: cancel', () => {
	it('ignores not_found when no match is running (resume on page load)', () => {
		const s = run([{type: 'cancelled', payload: {reason: 'not_found'}}]);
		expect(s.stage).toBe('idle');
	});

	it('shows a cancel of the running match', () => {
		const s = run([
			{type: 'matched', payload: matched()},
			{type: 'cancelled', payload: {matchId: 'm1', reason: 'left_before_start'}},
		]);
		expect(s.stage).toBe('cancelled');
		expect(s.cancelReason).toBe('left_before_start');
	});

	it('ignores a cancel for another match', () => {
		const s = run([
			{type: 'matched', payload: matched()},
			{type: 'cancelled', payload: {matchId: 'old', reason: 'server_restart'}},
		]);
		expect(s.stage).toBe('match');
	});
});

describe('readers', () => {
	it('side helpers', () => {
		expect(otherSide('A')).toBe('B');
		expect(otherSide('B')).toBe('A');
		expect(outcomeFor('A', 'A')).toBe('won');
		expect(outcomeFor('A', 'B')).toBe('lost');
		expect(outcomeFor('DRAW', 'B')).toBe('draw');
		const r = roundResult(1, 'B', {a: 0, b: 1});
		expect(sideSolve(r, 'B').timeMs).toBe(13000);
	});
});
