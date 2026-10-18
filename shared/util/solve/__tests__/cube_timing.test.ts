import { cubeTimestampLinearFit, fillMissingTimestamps, TimestampedMove } from '../cube_timing';
import * as clientTiming from '../../../../client/util/smart_cube_timing';

const move = (turn: string, cube: number | null, local: number | null, completedAt = local ?? 0): TimestampedMove => ({
	turn,
	cubeTimestamp: cube,
	localTimestamp: local,
	completedAt,
});

describe('cubeTimestampLinearFit', () => {
	it('returns an empty result for no moves', () => {
		expect(cubeTimestampLinearFit([], 0)).toEqual({ correctedMoves: [], finalTimeMs: 0 });
	});

	it('maps the cube clock onto the phone clock and removes packet jitter', () => {
		// Cube clock runs exactly 1:1, phone stamps jitter by up to 40 ms.
		const moves = [
			move('R', 1000, 50_000),
			move('U', 1300, 50_340),
			move("R'", 1650, 50_640),
			move("U'", 2000, 51_020),
		];
		const { finalTimeMs, correctedMoves } = cubeTimestampLinearFit(moves, 50_000);
		expect(Math.abs(finalTimeMs - 1000)).toBeLessThan(25);
		expect(correctedMoves).toHaveLength(4);
		expect(correctedMoves[0].turn).toBe('R');
	});

	it('follows a drifting cube clock', () => {
		// Cube clock 0.5% fast: 10 s of cube time is 9.95 s on the phone.
		const moves = [0, 2500, 5000, 7500, 10000].map((c, i) => move(`R${i}`, c, Math.round(c / 1.005)));
		expect(Math.round(cubeTimestampLinearFit(moves).finalTimeMs)).toBe(Math.round(10000 / 1.005));
	});

	it('fills a missing cube timestamp from its neighbour', () => {
		const moves = [move('R', 1000, 10_000), move('U', null, 10_200), move('F', 1400, 10_400)];
		const { correctedMoves } = cubeTimestampLinearFit(moves);
		expect(correctedMoves[1].cubeTimestamp).toBe(1350);
	});

	it('falls back to completedAt with fewer than two usable pairs', () => {
		const moves = [move('R', null, null, 500), move('U', null, null, 1700)];
		expect(cubeTimestampLinearFit(moves).finalTimeMs).toBe(1200);
	});
});

describe('fillMissingTimestamps', () => {
	it('walks backwards with -50 then forwards with +50', () => {
		expect(fillMissingTimestamps([null, 100, null, null])).toEqual([50, 100, 150, 200]);
		expect(fillMissingTimestamps([null, null])).toEqual([null, null]);
	});
});

describe('client re-export', () => {
	it('is the same function, so existing callers run the shared code', () => {
		expect(clientTiming.cubeTimestampLinearFit).toBe(cubeTimestampLinearFit);
	});
});
