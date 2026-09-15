/**
 * What saveSolve records for a smart cube time that already includes the "İlave süre"
 * offset (endTimer adds it before calling saveSolve). The offset is part of the solve
 * time, not a penalty: raw_time carries it, +2 goes on top of it, and a DNF stays a DNF
 * whose raw_time still holds the offset time, as for any other DNF'd solve.
 */

jest.mock('../../../../db/solves/update', () => ({ createSolveDb: jest.fn() }));
jest.mock('../../../../util/event_handler', () => ({ emitEvent: jest.fn() }));
jest.mock('../params', () => ({ setTimerParam: jest.fn() }));
jest.mock('../../../../util/native-plugins', () => ({ requestInAppReview: jest.fn() }));
jest.mock('../../../../db/settings/query', () => ({ getSetting: () => undefined }));

import { saveSolve } from '../save';
import { applySmartCubeTimeOffset } from '../smart_time_offset';

function context(overrides: Record<string, any> = {}): any {
	return {
		onSolve: jest.fn(),
		addTwoToSolve: false,
		dnfTime: false,
		cubeType: '333',
		scrambleSubset: null,
		solvesFilter: { from_timer: true },
		sessionSolveCount: 0,
		...overrides,
	};
}

function savedSolve(ctx: any) {
	expect(ctx.onSolve).toHaveBeenCalledTimes(1);
	return ctx.onSolve.mock.calls[0][0];
}

// A 10.00 s smart cube solve with a 0.35 s offset, as endTimer hands it over
const OFFSET_TIME_MS = applySmartCubeTimeOffset(10_000, 0.35);

describe('saveSolve with an offset smart cube time', () => {
	it('records the offset time as both time and raw_time', () => {
		const ctx = context();
		saveSolve(ctx, OFFSET_TIME_MS, 'R U', 1_000, 11_350, false, false, { is_smart_cube: true });

		const solve = savedSolve(ctx);
		expect(solve.time).toBeCloseTo(10.35, 10);
		expect(solve.raw_time).toBeCloseTo(10.35, 10);
		expect(solve.plus_two).toBe(false);
		expect(solve.dnf).toBe(false);
	});

	it('puts +2 on top of the offset time and keeps raw_time without it', () => {
		const ctx = context();
		saveSolve(ctx, OFFSET_TIME_MS, 'R U', 1_000, 11_350, false, true, { is_smart_cube: true });

		const solve = savedSolve(ctx);
		expect(solve.time).toBeCloseTo(12.35, 10);
		expect(solve.raw_time).toBeCloseTo(10.35, 10);
		expect(solve.plus_two).toBe(true);
	});

	it('keeps a DNF a DNF, with the offset time in raw_time', () => {
		const ctx = context();
		saveSolve(ctx, OFFSET_TIME_MS, 'R U', 1_000, 11_350, true, false, { is_smart_cube: true });

		const solve = savedSolve(ctx);
		expect(solve.time).toBe(-1);
		expect(solve.dnf).toBe(true);
		expect(solve.raw_time).toBeCloseTo(10.35, 10);
	});

	it('leaves the aborted-solve DNF at a raw_time of 0, which is what locks it', () => {
		const ctx = context();
		saveSolve(ctx, applySmartCubeTimeOffset(0, 0.35), 'R U', 1_000, 11_350, true, false, { is_smart_cube: true });

		const solve = savedSolve(ctx);
		expect(solve.time).toBe(-1);
		expect(solve.raw_time).toBe(0);
	});
});
