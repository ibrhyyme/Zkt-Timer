// A smart cube solve is broken down once: at the stop (prepareLocalStepRows, for the finished
// ladder), and the save stores those same rows instead of running the analysis again.

import Cube from 'cubejs';
import { serializeSmartTurnsCompact } from '../../../../shared/smart_cube/parse_turns';

jest.mock('../init', () => ({ getSolveDb: () => null }));
jest.mock('../../../util/event_handler', () => ({ emitEvent: jest.fn() }));
jest.mock('../../persist', () => ({ requestPersist: jest.fn() }));
jest.mock('../../../util/offline-queue', () => ({ getAllQueued: jest.fn(async () => []) }));
jest.mock('../../../components/store', () => ({
	getStore: () => ({ getState: () => ({ account: { me: { id: 'u1', is_pro: true } } }) }),
}));

const mockStepRows = jest.fn();
jest.mock('../../../../shared/util/solve/solve_steps', () => {
	const actual = jest.requireActual('../../../../shared/util/solve/solve_steps');
	return {
		...actual,
		stepRowsForStoredSolve: (...args: any[]) => {
			mockStepRows(...args);
			return actual.stepRowsForStoredSolve(...args);
		},
	};
});

import { localStepRowsForNewSolve, prepareLocalStepRows } from '../local-analysis';

const mv = (a: string) => a.trim().split(/\s+/).filter(Boolean);
const inv = (a: string) =>
	mv(a).reverse().map((m) => (m.endsWith("'") ? m.slice(0, -1) : m.endsWith('2') ? m : m + "'")).join(' ');
const PHASES = [
	"F R U' D2 L", "R U R'", "L' U' L", "R' U' R", "L U L'",
	"R U R' U R U2 R'", "R U R' U' R' F R2 U' R' U' R U R' F'",
];

function solveInput(id: string) {
	const scramble = inv(PHASES.join(' '));
	const cube = new Cube();
	for (const m of mv(scramble)) cube.move(m);
	const turns: { turn: string; completedAt: number }[] = [];
	let t = 0;
	for (const phase of PHASES) {
		t += 700;
		for (const m of mv(phase)) {
			cube.move(m);
			turns.push({ turn: m, completedAt: t });
			t += 150;
		}
	}
	return { id, scramble, smart_turns: serializeSmartTurnsCompact(turns, 0), cube_type: 'wca', scramble_subset: '333' };
}

beforeEach(() => mockStepRows.mockClear());

describe('prepareLocalStepRows', () => {
	it('hands the save the rows it worked out, without a second analysis', () => {
		const input = solveInput('s1');
		const prepared = prepareLocalStepRows(input, 'auto');
		expect(prepared && prepared.length).toBeGreaterThan(0);
		expect(mockStepRows).toHaveBeenCalledTimes(1);

		const stored = localStepRowsForNewSolve({ ...input, is_smart_cube: true, dnf: false } as any, 'auto');
		expect(stored).toBe(prepared);
		expect(mockStepRows).toHaveBeenCalledTimes(1);
	});

	it('works the breakdown out again when the saved solve is not the one prepared', () => {
		const input = solveInput('s2');
		const prepared = prepareLocalStepRows(input, 'auto');

		// The save marked it DNF: a breakdown made for a completed solve does not apply.
		const stored = localStepRowsForNewSolve({ ...input, is_smart_cube: true, dnf: true } as any, 'auto');
		expect(stored).not.toBe(prepared);
		expect(mockStepRows).toHaveBeenCalledTimes(2);
	});

	it('stores nothing for a solve whose moves it may not analyse', () => {
		const input = { ...solveInput('s3'), cube_type: '222', scramble_subset: null };
		expect(prepareLocalStepRows(input as any, 'auto')).toBeNull();
	});
});
