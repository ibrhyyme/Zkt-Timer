// Duel helpers (owner decision 2026-10-20): invite codes, the status an invite has at a moment,
// and the head-to-head score from either player's side.

import {
	CHALLENGE_CODE_LENGTH,
	challengeCodeFromBytes,
	challengePath,
	challengeStatusAt,
	headToHeadFrom,
	isChallengeCode,
} from '../challenge';

describe('invite codes', () => {
	it('builds a 10 character code from the unambiguous alphabet', () => {
		const bytes = Array.from({length: 32}, (_, i) => i * 7);
		const code = challengeCodeFromBytes(bytes) as string;
		expect(code).toHaveLength(CHALLENGE_CODE_LENGTH);
		expect(isChallengeCode(code)).toBe(true);
		expect(code).not.toMatch(/[01ilo]/);
	});

	it('skips bytes that would bias the alphabet and says when it ran out', () => {
		// 248 and above are skipped (248 = 8 * 31).
		expect(challengeCodeFromBytes([255, 250, 248, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe('abcdefghjk');
		expect(challengeCodeFromBytes([0, 1, 2])).toBeNull();
	});

	it('accepts only well formed codes', () => {
		expect(isChallengeCode('k7m2xq9pza')).toBe(true);
		expect(isChallengeCode('K7M2XQ9PZA')).toBe(false);
		expect(isChallengeCode('k7m2xq9pz')).toBe(false);
		expect(isChallengeCode('k7m2xq9pzo')).toBe(false);
		expect(isChallengeCode('../../etc1')).toBe(false);
		expect(isChallengeCode(null)).toBe(false);
		expect(challengePath('k7m2xq9pza')).toBe('/duel/k7m2xq9pza');
	});
});

describe('challengeStatusAt', () => {
	const at = Date.UTC(2026, 9, 20, 12, 0, 0);

	it('reads a PENDING invite past its time as EXPIRED', () => {
		expect(challengeStatusAt({status: 'PENDING', expires_at: new Date(at + 1)}, at)).toBe('PENDING');
		expect(challengeStatusAt({status: 'PENDING', expires_at: new Date(at)}, at)).toBe('EXPIRED');
		expect(challengeStatusAt({status: 'PENDING', expires_at: new Date(at).toISOString()}, at + 5)).toBe('EXPIRED');
	});

	it('keeps an ended status as it is', () => {
		expect(challengeStatusAt({status: 'ACCEPTED', expires_at: new Date(at - 1)}, at)).toBe('ACCEPTED');
		expect(challengeStatusAt({status: 'CANCELLED', expires_at: new Date(at + 1)}, at)).toBe('CANCELLED');
		expect(challengeStatusAt({status: 'EXPIRED', expires_at: new Date(at + 1)}, at)).toBe('EXPIRED');
	});
});

describe('head-to-head', () => {
	it('counts wins, losses and draws from the asking player side, either of them A', () => {
		const rows = [
			{player_a_id: 'ahmet', winner: 'A', count: 3},
			{player_a_id: 'ahmet', winner: 'B', count: 1},
			{player_a_id: 'mert', winner: 'A', count: 3},
			{player_a_id: 'mert', winner: 'B', count: 4},
			{player_a_id: 'mert', winner: 'DRAW', count: 1},
			{player_a_id: 'mert', winner: null, count: 2},
		];
		expect(headToHeadFrom(rows, 'ahmet')).toEqual({wins: 7, losses: 4, draws: 1});
		expect(headToHeadFrom(rows, 'mert')).toEqual({wins: 4, losses: 7, draws: 1});
		expect(headToHeadFrom([], 'ahmet')).toEqual({wins: 0, losses: 0, draws: 0});
	});
});
