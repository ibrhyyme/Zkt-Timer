/**
 * Web Worker entry point for all puzzle solvers.
 * Ported from cstimer's IDA* and gSolver algorithms.
 * Built as a separate esbuild entry -> dist/cross-solver-worker.js (iife).
 */
import {initCross, solveCross, solveXCross, getEasyCross, getEasyXCross, fullInit} from './cross-solver';
import {initEOLine, solveEOLine, solveEOCross} from './eoline-solver';
import {initRoux1, solveRoux1} from './roux1-solver';
import {
	solve222Face,
	solve333CF,
	solve333Roux,
	solve333Petrus,
	solve333ZZ,
	solve333Block222,
	solve333EODR,
	solveSQ1,
	solvePyraminx,
	solveSkewb,
} from './gsolver';
import {SolverResult, SolverType} from './types';

let initialized = false;

function initAll(): void {
	if (initialized) return;
	initCross();
	initEOLine();
	initRoux1();
	// Full pruning tablosunu (getEasyCross/getEasyXCross) init'te pre-warm et —
	// yoksa ilk rare-length scramble isteginde ~100-300ms senkron blok olusur.
	fullInit();
	initialized = true;
}

function solve(scramble: string, solverType: SolverType, orientation?: string): SolverResult[] {
	// Coordinate-based solvers need init
	if (['cross', 'xcross', 'eoline', 'eocross', 'roux1'].includes(solverType)) {
		initAll();
	}
	switch (solverType) {
		case 'cross':
			return solveCross(scramble);
		case 'xcross':
			return Array.from({length: 6}, (_, i) => solveXCross(scramble, i, orientation !== undefined && orientation !== '' ? parseInt(orientation, 10) : undefined));
		case 'eoline':
			return solveEOLine(scramble);
		case 'eocross':
			return solveEOCross(scramble);
		case 'roux1':
			return solveRoux1(scramble);
		case '222face':
			return solve222Face(scramble);
		case '333cf':
			return solve333CF(scramble, orientation);
		case '333roux':
			return solve333Roux(scramble, orientation);
		case '333petrus':
			return solve333Petrus(scramble, orientation);
		case '333zz':
			return solve333ZZ(scramble, orientation);
		case '333222':
			return solve333Block222(scramble);
		case '333eodr':
			return solve333EODR(scramble, orientation);
		case 'sq1cs':
			return solveSQ1(scramble);
		case 'pyrv':
			return solvePyraminx(scramble);
		case 'skbl1':
			return solveSkewb(scramble);
		default:
			return [];
	}
}

self.onmessage = function (event: MessageEvent) {
	const {cmd, id, scramble, solverType, orientation, length} = event.data;

	switch (cmd) {
		case 'init': {
			try {
				initAll();
				(self as unknown as Worker).postMessage({cmd: 'init', status: 'ok'});
			} catch (e) {
				console.error('[cross-solver-worker] init error:', e);
				(self as unknown as Worker).postMessage({cmd: 'init', status: 'error', error: String(e)});
			}
			break;
		}

		case 'solve': {
			try {
				const results = solve(scramble, solverType, orientation);
				(self as unknown as Worker).postMessage({cmd: 'solve', id, results});
			} catch (e) {
				console.error('[cross-solver-worker] solve error:', solverType, e);
				(self as unknown as Worker).postMessage({cmd: 'solve', id, results: [], error: String(e)});
			}
			break;
		}

		case 'easy': {
			// Belirli uzunlukta cross/xcross pozisyonu uret → mask [ep,eo(,cp,co)]
			try {
				initAll();
				const mask = solverType === 'xcross' ? getEasyXCross(length) : getEasyCross(length);
				(self as unknown as Worker).postMessage({cmd: 'easy', id, mask});
			} catch (e) {
				console.error('[cross-solver-worker] easy error:', e);
				(self as unknown as Worker).postMessage({cmd: 'easy', id, mask: null, error: String(e)});
			}
			break;
		}
	}
};
