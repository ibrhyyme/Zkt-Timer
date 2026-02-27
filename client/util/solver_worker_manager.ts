/**
 * Manages a Web Worker running the cubejs Kociemba solver.
 * Provides a Promise-based `solveAsync()` API so the main thread is never blocked.
 *
 * Falls back to synchronous solve when Worker is unavailable (SSR, old browsers).
 */
import Cube from 'cubejs';

interface CubeJSON {
	center: number[];
	cp: number[];
	co: number[];
	ep: number[];
	eo: number[];
}

let worker: Worker | null = null;
let requestId = 0;
const pendingRequests = new Map<number, {resolve: (s: string) => void; reject: (e: Error) => void}>();
let initPromise: Promise<void> | null = null;
let workerFailed = false;

function getWorker(): Worker | null {
	if (worker) return worker;
	if (workerFailed) return null;
	if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;

	try {
		worker = new Worker('/dist/solver-worker.js');

		worker.onmessage = (e: MessageEvent) => {
			const data = e.data;
			if (data.cmd === 'solve') {
				const pending = pendingRequests.get(data.id);
				if (pending) {
					pendingRequests.delete(data.id);
					pending.resolve(data.solution || '');
				}
			}
		};

		worker.onerror = () => {
			workerFailed = true;
			for (const [, p] of pendingRequests) {
				p.reject(new Error('Worker error'));
			}
			pendingRequests.clear();
			worker = null;
		};

		return worker;
	} catch {
		workerFailed = true;
		return null;
	}
}

/**
 * Initialize the solver worker in the background.
 * Safe to call multiple times — only runs once.
 */
export function initSolverWorker(): Promise<void> {
	if (initPromise) return initPromise;

	const w = getWorker();
	if (!w) {
		// No worker support — resolve immediately, solveAsync will use sync fallback
		initPromise = Promise.resolve();
		return initPromise;
	}

	initPromise = new Promise((resolve) => {
		const handler = (e: MessageEvent) => {
			if (e.data.cmd === 'init' && e.data.status === 'ok') {
				w.removeEventListener('message', handler);
				resolve();
			}
		};
		w.addEventListener('message', handler);
		w.postMessage({cmd: 'init'});
	});

	return initPromise;
}

/**
 * Solve a cube state asynchronously via Web Worker.
 * Falls back to synchronous solve if worker is not available.
 */
export async function solveAsync(cubeJSON: CubeJSON): Promise<string> {
	await initSolverWorker();

	const w = getWorker();
	if (!w) {
		// Sync fallback
		const cube = new Cube(cubeJSON);
		return cube.solve() || '';
	}

	const id = ++requestId;
	return new Promise((resolve, reject) => {
		pendingRequests.set(id, {resolve, reject});
		w.postMessage({cmd: 'solve', id, cube: cubeJSON});
	});
}

/**
 * Check if the worker is available and initialized.
 */
export function isWorkerReady(): boolean {
	return worker !== null && initPromise !== null;
}
