jest.mock('../../../../util/socket/socketio', () => ({socketClient: () => null}));
jest.mock('../../../common/button/Button', () => ({__esModule: true, default: () => null, CommonType: {}}));

import {offsetFromSamples} from '../useBattleSocket';
import {endReasonKey, finalScore, rematchButtonState} from '../ResultScreen';
import {formatBattleTime, avatarSrc} from '../OpponentBar';
import type {MatchResultPayload, RematchStatePayload} from '../../../../../shared/battle/events';

describe('offsetFromSamples', () => {
	it('takes the midpoint of the shortest round trip', () => {
		const offset = offsetFromSamples([
			{sentAt: 0, receivedAt: 400, serverNow: 1300},
			{sentAt: 1000, receivedAt: 1040, serverNow: 2020},
			{sentAt: 2000, receivedAt: 2200, serverNow: 3000},
		]);
		// Shortest trip: 40 ms, midpoint 1020, server read 2020.
		expect(offset).toBe(1000);
	});

	it('ignores broken samples and returns null without any', () => {
		expect(offsetFromSamples([])).toBeNull();
		expect(offsetFromSamples([{sentAt: 10, receivedAt: 5, serverNow: 100}])).toBeNull();
		expect(offsetFromSamples([{sentAt: 0, receivedAt: NaN, serverNow: 100}])).toBeNull();
	});
});

function result(partial: Partial<MatchResultPayload>): MatchResultPayload {
	return {
		matchId: 'm',
		winner: 'A',
		endReason: 'NORMAL',
		rated: true,
		ratingBefore: 1500,
		ratingAfter: 1515,
		delta: 15,
		provisional: false,
		games: 12,
		rounds: [],
		...partial,
	};
}

describe('ResultScreen helpers', () => {
	it('final score comes from the last round', () => {
		expect(finalScore(result({}))).toEqual({a: 0, b: 0});
		const rounds = [
			{matchId: 'm', round: 1, a: {timeMs: 1, penalty: null}, b: {timeMs: 2, penalty: null}, winner: 'A' as const, score: {a: 1, b: 0}},
			{matchId: 'm', round: 2, a: {timeMs: 3, penalty: null}, b: {timeMs: 2, penalty: null}, winner: 'B' as const, score: {a: 1, b: 1}},
		];
		expect(finalScore(result({rounds}))).toEqual({a: 1, b: 1});
	});

	it('end reason line names who ended the match', () => {
		expect(endReasonKey('NORMAL', 'won')).toBeNull();
		expect(endReasonKey('FORFEIT', 'lost')).toBe('online_battle.end.you_gave_up');
		expect(endReasonKey('FORFEIT', 'won')).toBe('online_battle.end.opponent_gave_up');
		expect(endReasonKey('DISCONNECT', 'lost')).toBe('online_battle.end.you_disconnected');
		expect(endReasonKey('ABANDON', 'won')).toBe('online_battle.end.opponent_left');
		expect(endReasonKey('SERVER_RESTART', 'draw')).toBe('online_battle.cancelled.server_restart');
	});

	it('rematch button state (design 5.5)', () => {
		const rs = (you: boolean, opponent: boolean | 'left'): RematchStatePayload => ({
			matchId: 'm',
			you,
			opponent,
			deadline: 0,
			rated: true,
		});
		expect(rematchButtonState(null, false)).toBe('open');
		expect(rematchButtonState(null, true)).toBe('gone');
		expect(rematchButtonState(rs(true, false), false)).toBe('waiting');
		expect(rematchButtonState(rs(false, true), false)).toBe('asked');
		expect(rematchButtonState(rs(true, 'left'), false)).toBe('gone');
		expect(rematchButtonState(rs(false, 'left'), false)).toBe('gone');
		// Both pressed: the new match is on its way, the button stays pressed.
		expect(rematchButtonState(rs(true, true), true)).toBe('waiting');
	});
});

describe('OpponentBar helpers', () => {
	it('formats battle times', () => {
		expect(formatBattleTime(null, null)).toBe('DNF');
		expect(formatBattleTime(12840, 'DNF')).toBe('DNF');
		expect(formatBattleTime(12840, null)).toBe('12.84');
		expect(formatBattleTime(12840, 'PLUS_TWO')).toBe('14.84+');
		expect(formatBattleTime(12840, 'PLUS_FOUR')).toBe('16.84++');
	});

	it('passes full avatar URLs through', () => {
		expect(avatarSrc(null)).toBeNull();
		expect(avatarSrc('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
	});
});
