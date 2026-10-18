/**
 * Pure helpers of useBattleCube. The hook's own imports (BLE manager, modals, Redux
 * actions) are mocked: only the wire-format functions run here.
 */
jest.mock('../../../../util/smart_cube/connection_manager', () => ({getSmartCubeManager: () => null}));
jest.mock('../../../../util/smart_cube', () => ({SmartSolveEngine: class {}}));
jest.mock('../../../../util/smart_cube/telemetry', () => ({recordEngineEvent: () => undefined}));
jest.mock('../../../../util/smart_scramble', () => ({}));
jest.mock('../../../../util/hooks/useSettings', () => ({useSettings: () => null}));
jest.mock('../../../timer/helpers/params', () => ({setTimerParams: () => undefined}));
jest.mock('../../../../actions/general', () => ({openModal: () => null, closeModal: () => null}));
jest.mock('../../../timer/smart_cube/ble_scanning_modal/BleScanningModal', () => () => null);
jest.mock('../../../timer/common/BluetoothErrorMessage', () => () => null);
jest.mock('../../../../util/platform', () => ({isNative: () => false}));
jest.mock('../../../../util/toast', () => ({toastError: () => undefined}));

import {lastScrambleStamps, newProgressSteps, toBattleMoves} from '../useBattleCube';
import type {BattleProgressStep} from '../../../../../shared/battle/events';

describe('toBattleMoves', () => {
	it('keeps missing cube stamps as null so the server can count gaps', () => {
		const moves = toBattleMoves([
			{turn: 'R', cubeTimestamp: 100, localTimestamp: 5000} as any,
			{turn: "U'", localTimestamp: 5100} as any,
			{turn: 'F'} as any,
		]);
		expect(moves).toEqual([
			{t: 'R', c: 100, l: 5000},
			{t: "U'", c: null, l: 5100},
			{t: 'F', c: null, l: null},
		]);
	});
});

describe('lastScrambleStamps', () => {
	const log = [
		{turn: 'R', completedAt: 1000, cubeTimestamp: 10},
		{turn: 'U', completedAt: 1100, cubeTimestamp: 20},
		{turn: 'F', completedAt: 1200, cubeTimestamp: null},
		{turn: 'L', completedAt: 5000, cubeTimestamp: 400},
	];

	it('uses the last two moves before the solve started', () => {
		expect(lastScrambleStamps(log, 5000)).toEqual([20, null]);
	});

	it('uses the last two logged moves before the solve', () => {
		expect(lastScrambleStamps(log, null)).toEqual([null, 400]);
	});

	it('returns nulls for a short log', () => {
		expect(lastScrambleStamps([], null)).toEqual([null, null]);
		expect(lastScrambleStamps(log.slice(0, 1), null)).toEqual([null, 10]);
	});
});

describe('newProgressSteps', () => {
	const scramble = 'R U';
	// U' R' solves it: every CFOP step completes on the last move.
	const moves = [
		{t: "U'", c: 1000, l: 1000},
		{t: "R'", c: 1400, l: 1400},
	];

	it('reports each completed step once', () => {
		const sent = new Set<BattleProgressStep>();
		const first = newProgressSteps(scramble, moves, sent);
		expect(first.map((p) => p.step)).toEqual(['cross', 'f2l_1', 'f2l_2', 'f2l_3', 'f2l_4', 'oll', 'pll']);
		for (const p of first) sent.add(p.step);
		expect(newProgressSteps(scramble, moves, sent)).toEqual([]);
	});

	it('reports nothing without moves', () => {
		expect(newProgressSteps(scramble, [], new Set())).toEqual([]);
	});
});
