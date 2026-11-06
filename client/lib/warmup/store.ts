import { useEffect, useState } from 'react';
import type { Solve } from '../../../server/schemas/Solve.schema';

/**
 * Warm-up mode: while it is on, the timer's solves are written nowhere. The state lives in this
 * module on purpose. Nothing here reaches localStorage, LokiJS or the server, so every app open
 * starts with the mode off, and a timer unmount (RESET_TIMER_PARAMS) does not end it.
 *
 * A module store, not a Redux slice: a slice would need SSR initial state in server/router.tsx,
 * and the server never has anything to say about this. Pattern of lib/cubes/store.ts.
 */

/** With no solve for this long the mode ends: a phone can keep the app alive for days. */
export const WARMUP_IDLE_MS = 30 * 60 * 1000;

export interface WarmupState {
	active: boolean;
	/** Solves thrown away since the mode was turned on. */
	count: number;
	/** The newest of them, held in memory only until the next solve or the end of the mode. */
	last: Solve | null;
	/** The newest solve was saved with the Save button. */
	lastSaved: boolean;
	lastActivityAt: number;
}

const OFF: WarmupState = Object.freeze({
	active: false,
	count: 0,
	last: null,
	lastSaved: false,
	lastActivityAt: 0,
});

let state: WarmupState = OFF;
const listeners = new Set<() => void>();

function setState(next: WarmupState) {
	state = next;
	listeners.forEach((listener) => listener());
}

export function getWarmupState(): WarmupState {
	return state;
}

export function isWarmupActive(): boolean {
	return state.active;
}

/** Rooms, battles and modals have their own solve flow, so the mode never touches them. */
export function warmupAppliesTo(context: { onSolve?: unknown; inModal?: unknown; matchMode?: unknown }): boolean {
	return !context.onSolve && !context.inModal && !context.matchMode;
}

export function startWarmup(now: number = Date.now()) {
	setState({ ...OFF, active: true, lastActivityAt: now });
}

export function stopWarmup() {
	setState(OFF);
}

export function noteWarmupSolve(solve: Solve, now: number = Date.now()) {
	setState({ ...state, count: state.count + 1, last: solve, lastSaved: false, lastActivityAt: now });
}

/** Hands the newest solve over once, so a double press cannot save it twice. */
export function takeLastWarmupSolve(): Solve | null {
	const { last } = state;
	if (!last) return null;
	setState({ ...state, last: null, lastSaved: true });
	return last;
}

export function warmupIdleExpired(now: number = Date.now()): boolean {
	return state.active && now - state.lastActivityAt >= WARMUP_IDLE_MS;
}

export function subscribeWarmup(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function useWarmup(): WarmupState {
	const [value, setValue] = useState<WarmupState>(state);

	useEffect(() => {
		// The store may have changed between the first render and this effect.
		setValue(state);
		return subscribeWarmup(() => setValue(state));
	}, []);

	return value;
}
