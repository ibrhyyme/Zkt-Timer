/**
 * Manages the Cross/EOLine/Roux1 solver Web Worker.
 * Provides a Promise-based API for the main thread.
 */
import {SolverResult, SolverType, SolverWorkerResponse} from './types';

let worker: Worker | null = null;
let requestId = 0;
const pendingRequests = new Map<
	number,
	{resolve: (results: SolverResult[]) => void; reject: (e: Error) => void}
>();
let initPromise: Promise<void> | null = null;
let workerFailed = false;

function getWorker(): Worker | null {
	if (worker) return worker;
	if (workerFailed) return null;
	if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;

	try {
		worker = new Worker('/dist/cross-solver-worker.js');

		worker.onmessage = (e: MessageEvent<SolverWorkerResponse>) => {
			const data = e.data;
			if (data.cmd === 'solve' && data.id !== undefined) {
				const pending = pendingRequests.get(data.id);
				if (pending) {
					pendingRequests.delete(data.id);
					if (data.error) {
						pending.reject(new Error(data.error));
					} else {
						pending.resolve(data.results || []);
					}
				}
			}
		};

		worker.onerror = (ev) => {
			console.error('[cross-solver] worker error:', ev.message, ev.filename, ev.lineno);
			workerFailed = true;
			for (const [, p] of pendingRequests) {
				p.reject(new Error('Cross solver worker error: ' + (ev.message || 'unknown')));
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

export function initCrossSolverWorker(): Promise<void> {
	if (initPromise) return initPromise;

	const w = getWorker();
	if (!w) {
		initPromise = Promise.resolve();
		return initPromise;
	}

	initPromise = new Promise((resolve, reject) => {
		const handler = (e: MessageEvent<SolverWorkerResponse>) => {
			if (e.data.cmd === 'init') {
				w.removeEventListener('message', handler);
				if (e.data.status === 'ok') {
					resolve();
				} else {
					workerFailed = true;
					reject(new Error(e.data.error || 'Init failed'));
				}
			}
		};
		w.addEventListener('message', handler);
		w.postMessage({cmd: 'init'});
	});

	return initPromise;
}

export async function solveCrossAsync(
	scramble: string,
	solverType: SolverType,
	orientation?: string
): Promise<SolverResult[]> {
	await initCrossSolverWorker();

	const w = getWorker();
	if (!w) {
		return [];
	}

	const id = ++requestId;
	return new Promise((resolve, reject) => {
		pendingRequests.set(id, {resolve, reject});
		w.postMessage({cmd: 'solve', id, scramble, solverType, orientation});
	});
}

export function isCrossSolverAvailable(): boolean {
	return !workerFailed && (typeof window !== 'undefined' && typeof Worker !== 'undefined');
}
