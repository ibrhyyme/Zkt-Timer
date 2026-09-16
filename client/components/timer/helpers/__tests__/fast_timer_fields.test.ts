import { shallowEqual } from 'react-redux';
import timer from '../../../../reducers/timer';
import smartCube from '../../../../reducers/smart_cube';
import {
	setSmartCubeParamsAction,
	setTimerParamsAction,
	smartCubeFaceletsAction,
	turnSmartCube,
	turnSmartCubeBatch,
} from '../../../../actions/timer';
import { FAST_TIMER_FIELDS, selectStableTimerStore } from '../fast_timer_fields';

/**
 * Timer hands the timer slice to the whole page through TimerContext and re-renders only
 * when selectStableTimerStore's result stops comparing shallow-equal. A smart cube move
 * or an inspection tick must not get that far; every other change still has to.
 */

const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
// The reducer only compares facelet strings, so any string other than SOLVED will do.
const SCRAMBLED = 'DUUUUUUUURRRRRRRRRFFFFFFFFFUDDDDDDDDLLLLLLLLLBBBBBBBBB';

const FAST: readonly string[] = FAST_TIMER_FIELDS;

const initial = () => timer(undefined, { type: '@@INIT' });
const initialSmart = () => smartCube(undefined, { type: '@@INIT' });
const running = () => timer(initial(), setTimerParamsAction({ timeStartedAt: new Date(1000), solving: true }));

/** Mirrors Timer: useSelector(selectStableTimerStore, shallowEqual). */
function rerendersTimer(prev: any, next: any): boolean {
	return !shallowEqual(selectStableTimerStore({ timer: prev }), selectStableTimerStore({ timer: next }));
}

/** Fields an action changed that are not fast. Names them, so a failure says which. */
function stableFieldsChanged(prev: any, next: any): string[] {
	return Object.keys(next).filter((key) => next[key] !== prev[key] && !FAST.includes(key));
}

function moves(turns: string[], at: number) {
	return turns.map((turn, i) => ({ turn, completedAt: at + i }));
}

describe('selectStableTimerStore', () => {
	it('drops every fast field and passes everything else through untouched', () => {
		const slice = initial();
		const stable = selectStableTimerStore({ timer: slice });

		for (const key of FAST) {
			expect(stable).not.toHaveProperty(key);
		}
		for (const key of Object.keys(slice).filter((k) => !FAST.includes(k))) {
			expect(stable[key]).toBe(slice[key]);
		}
	});

	it('copes with a store that has no timer slice', () => {
		expect(selectStableTimerStore({})).toEqual({});
		expect(selectStableTimerStore(undefined)).toEqual({});
	});
});

describe('a smart cube move does not re-render Timer', () => {
	it('while scrambling', () => {
		const prev = initial();
		const next = timer(prev, turnSmartCubeBatch(moves(['R', 'U'], 1000), SCRAMBLED));

		// The action did change the slice, so Timer comparing equal is not a no-op.
		expect(next.smartTurns).toHaveLength(2);
		expect(stableFieldsChanged(prev, next)).toEqual([]);
		expect(rerendersTimer(prev, next)).toBe(false);

		// The facelets half of the same action lands in the connection slice, which Timer
		// never reads at all.
		const smartPrev = initialSmart();
		const smartNext = smartCube(smartPrev, turnSmartCubeBatch(moves(['R', 'U'], 1000), SCRAMBLED));
		expect(smartNext.smartCurrentState).toBe(SCRAMBLED);
		expect(smartNext.smartStateSeq).toBe(smartPrev.smartStateSeq + 1);
	});

	it('during a solve, where it also stamps the pick-up and last-move times', () => {
		const prev = running();
		const next = timer(prev, turnSmartCubeBatch(moves(['R'], 1500), SCRAMBLED));

		expect(next.smartPickUpTime).toBeGreaterThan(0);
		expect(next.lastSmartMoveTime).toBe(1500);
		expect(stableFieldsChanged(prev, next)).toEqual([]);
		expect(rerendersTimer(prev, next)).toBe(false);
	});

	it('on the move that solves the cube', () => {
		const prev = timer(running(), turnSmartCubeBatch(moves(['R'], 1500), SCRAMBLED));
		const next = timer(prev, turnSmartCubeBatch(moves(["R'"], 2500), SOLVED));

		const smartSolved = smartCube(initialSmart(), turnSmartCubeBatch(moves(["R'"], 2500), SOLVED));
		expect(smartSolved.smartPhysicallySolved).toBe(true);
		expect(stableFieldsChanged(prev, next)).toEqual([]);
		expect(rerendersTimer(prev, next)).toBe(false);
	});

	it('from a driver that reports moves one at a time', () => {
		const prev = running();
		const next = timer(prev, turnSmartCube('R', 1500));

		expect(next.smartTurns).toHaveLength(1);
		expect(stableFieldsChanged(prev, next)).toEqual([]);
		expect(rerendersTimer(prev, next)).toBe(false);
	});
});

describe('what the solve engine and inspection write per move or tick', () => {
	it.each([
		['scramble progress', { smartMatchStatus: ['perfect', 'pending'] }],
		['an undo hint', { smartUndoMoves: ["R'"] }],
		['the abort button hiding again', { smartAbortVisible: false }],
		// The tick re-sends addTwoToSolve every time; it only matters once it flips (below).
		['an inspection tick', { inspectionTimer: 14.9, addTwoToSolve: false }],
	])('%s does not re-render Timer', (_, params) => {
		const prev = initial();
		const next = timer(prev, setTimerParamsAction(params as any));

		expect(next).not.toBe(prev);
		expect(rerendersTimer(prev, next)).toBe(false);
	});
});

describe('connection state is out of reach of Timer entirely', () => {
	it.each([
		['a facelets report', smartCubeFaceletsAction(SCRAMBLED)],
		['the cube connecting', setSmartCubeParamsAction({ smartCubeConnected: true, smartDeviceId: 'x' })],
	])('%s changes the smart cube slice and leaves the timer slice untouched', (_, action) => {
		const prevTimer = initial();
		const prevSmart = initialSmart();

		// Same dispatch, both reducers: combineReducers runs them together.
		expect(smartCube(prevSmart, action as any)).not.toBe(prevSmart);
		expect(timer(prevTimer, action as any)).toBe(prevTimer);
	});

	it('survives RESET_TIMER_PARAMS, which is the whole reason it moved', () => {
		const connected = smartCube(
			initialSmart(),
			setSmartCubeParamsAction({ smartCubeConnected: true, smartDeviceId: 'cube-1' })
		);
		const afterReset = smartCube(connected, { type: 'RESET_TIMER_PARAMS' });

		expect(afterReset.smartCubeConnected).toBe(true);
		expect(afterReset.smartDeviceId).toBe('cube-1');
	});
});

describe('every other change still re-renders Timer', () => {
	it.each([
		['the timer starting', { timeStartedAt: new Date(1000), solving: true }],
		['inspection starting', { inInspection: true }],
		['inspection reaching the +2 zone', { inspectionTimer: 1.9, addTwoToSolve: true }],
		['the scramble being done', { smartCanStart: true }],
		['a new scramble', { scramble: 'R U F' }],
		['the abort button appearing', { smartAbortVisible: true }],
		['the cube needing a reset', { smartNeedsCubeReset: true }],
		['the cube going out of sync', { smartOutOfSync: true }],
		['a finished solve reporting its stats', { lastSmartSolveStats: { turns: 40, tps: 4 } }],
	])('%s', (_, params) => {
		const prev = initial();
		const next = timer(prev, setTimerParamsAction(params as any));

		expect(rerendersTimer(prev, next)).toBe(true);
	});
});
