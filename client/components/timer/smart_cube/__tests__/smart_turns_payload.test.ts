import { smartTurnsForSave } from '../smart_turns_payload';
import { parseSmartTurns } from '../../../../../shared/smart_cube/parse_turns';

const MOVES = [
	{ turn: 'R', completedAt: 1_700_000_001_000 },
	{ turn: "U'", completedAt: 1_700_000_001_250 },
	{ turn: 'F2', completedAt: 1_700_000_001_900 },
];

describe('smartTurnsForSave (normal stop and abort DNF share it, feedback E-2)', () => {
	it('sends nothing for a non-Pro user', () => {
		expect(smartTurnsForSave(MOVES, false)).toBeNull();
	});

	it('writes the compact format with the first move as 0 for Pro', () => {
		expect(smartTurnsForSave(MOVES, true)).toBe("R@0 U'@250 F2@900");
	});

	it('never writes the legacy JSON array', () => {
		expect(smartTurnsForSave(MOVES, true)!.charAt(0)).not.toBe('[');
	});

	it('round-trips through the server parser', () => {
		const parsed = parseSmartTurns(smartTurnsForSave(MOVES, true));
		expect(parsed.map((m) => m.turn)).toEqual(['R', "U'", 'F2']);
		expect(parsed.map((m) => m.completedAt)).toEqual([0, 250, 900]);
	});

	it('handles an abort before any move', () => {
		expect(smartTurnsForSave([], true)).toBe('');
	});
});
