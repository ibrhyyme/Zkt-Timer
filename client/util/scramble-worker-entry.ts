/**
 * Scramble Generator Web Worker entry point.
 * Built as a separate IIFE bundle by esbuild.
 *
 * Handles: scramble generation for heavy solver types (3x3 min2phase, 4x4, megaminx, etc.)
 * Light solver types (pyraminx, skewb, clock, 2x2) run on main thread — no worker needed.
 */

import { generateScramble, initScramblers } from '../../shared/scramble';
import type { ScrambleWorkerRequest, ScrambleWorkerResponse, ScrambleWorkerInitResponse } from '../../shared/scramble/types';

// Listen for messages from main thread
self.onmessage = (e: MessageEvent) => {
	const data = e.data;

	if (data.cmd === 'init') {
		const t = Date.now();
		initScramblers();
		const response: ScrambleWorkerInitResponse = {
			type: 'init',
			ready: true,
			elapsed: Date.now() - t,
		};
		(self as any).postMessage(response);
		return;
	}

	if (data.cmd === 'generate') {
		const req = data as ScrambleWorkerRequest & { cmd: string };
		try {
			const scramble = generateScramble(req.typeId, req.length, req.state);
			const response: ScrambleWorkerResponse & { cmd: string } = {
				cmd: 'generate',
				id: req.id,
				scramble,
			};
			(self as any).postMessage(response);
		} catch (err) {
			const response: ScrambleWorkerResponse & { cmd: string } = {
				cmd: 'generate',
				id: req.id,
				scramble: '',
				error: err instanceof Error ? err.message : String(err),
			};
			(self as any).postMessage(response);
		}
	}
};
