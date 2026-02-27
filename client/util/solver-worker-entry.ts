/**
 * Web Worker entry point for cubejs Kociemba solver.
 * Runs Cube.initSolver() and Cube.solve() off the main thread
 * to prevent UI freezing during scramble correction.
 *
 * Built as a separate esbuild entry → dist/solver-worker.js (iife).
 */
import Cube from 'cubejs';
import 'cubejs/lib/solve';

let initialized = false;

self.onmessage = function (event: MessageEvent) {
	const {cmd, id, cube} = event.data;

	switch (cmd) {
		case 'init': {
			if (!initialized) {
				Cube.initSolver();
				initialized = true;
			}
			(self as unknown as Worker).postMessage({cmd: 'init', status: 'ok'});
			break;
		}

		case 'solve': {
			if (!initialized) {
				(self as unknown as Worker).postMessage({cmd: 'solve', id, solution: ''});
				return;
			}
			try {
				const c = new Cube(cube);
				const solution = c.solve();
				(self as unknown as Worker).postMessage({cmd: 'solve', id, solution: solution || ''});
			} catch (e) {
				(self as unknown as Worker).postMessage({cmd: 'solve', id, solution: '', error: String(e)});
			}
			break;
		}
	}
};
