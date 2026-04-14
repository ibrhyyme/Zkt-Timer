/**
 * Manages the scramble generator Web Worker.
 * Promise-based API for async scramble generation (heavy solvers).
 *
 * Usage:
 *   import { generateScrambleAsync } from './scramble-worker-manager';
 *   const scramble = await generateScrambleAsync('333');
 */

let worker: Worker | null = null;
let requestId = 0;
const pendingRequests = new Map<number, { resolve: (s: string) => void; reject: (e: Error) => void }>();
let initPromise: Promise<void> | null = null;
let workerFailed = false;

function getWorker(): Worker | null {
	if (worker) return worker;
	if (workerFailed) return null;
	if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;

	try {
		console.log('[scramble-worker] Loading worker...');
		worker = new Worker('/dist/scramble-worker.js');

		worker.onmessage = (e: MessageEvent) => {
			const data = e.data;
			if (data.cmd === 'generate') {
				const pending = pendingRequests.get(data.id);
				if (pending) {
					pendingRequests.delete(data.id);
					if (data.error) {
						pending.reject(new Error(data.error));
					} else {
						pending.resolve(data.scramble || '');
					}
				}
			}
		};

		worker.onerror = (e) => {
			console.error('[scramble-worker] Worker failed:', e);
			workerFailed = true;
			for (const [, p] of pendingRequests) {
				p.reject(new Error('Scramble worker error'));
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
 * Initialize the scramble worker (builds pruning tables in background).
 * Safe to call multiple times — only runs once.
 */
export function initScrambleWorker(): Promise<void> {
	if (initPromise) return initPromise;

	const w = getWorker();
	if (!w) {
		initPromise = Promise.resolve();
		return initPromise;
	}

	initPromise = new Promise((resolve) => {
		const handler = (e: MessageEvent) => {
			if (e.data.type === 'init' && e.data.ready) {
				console.log('[scramble-worker] Worker ready');
				w.removeEventListener('message', handler);
				resolve();
			}
		};
		w.addEventListener('message', handler);
		w.postMessage({ cmd: 'init' });
	});

	return initPromise;
}

/**
 * Generate a scramble asynchronously via Web Worker.
 * Her istek kendi sonucuyla resolve olur — iptal mantigi caller'da.
 */
export async function generateScrambleAsync(typeId: string, length?: number, state?: number): Promise<string> {
	await initScrambleWorker();

	const w = getWorker();
	if (!w) {
		const { generateScramble } = await import('../../shared/scramble');
		return generateScramble(typeId, length, state);
	}

	const id = ++requestId;

	return new Promise((resolve, reject) => {
		pendingRequests.set(id, { resolve, reject });
		w.postMessage({ cmd: 'generate', id, typeId, length, state });
	});
}

/**
 * Check if the scramble worker is available and ready.
 */
export function isScrambleWorkerReady(): boolean {
	return initPromise !== null && !workerFailed;
}
