import { useEffect, useState } from 'react';
import type { Solve } from '../../../server/schemas/Solve.schema';
import type { WarmupAutoSaveReason } from './auto_save';

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
	/**
	 * The newest solve once it was saved, by the Save button or by auto-save. Kept so the
	 * last solve card can unlock +2 / DNF for it and auto-save can be undone. Cleared by
	 * the next solve.
	 */
	saved: Solve | null;
	/** Why auto-save saved `saved`; null when the button did. Set, the chip offers Undo. */
	autoSaved: WarmupAutoSaveReason | null;
	lastActivityAt: number;
}

const OFF: WarmupState = Object.freeze({
	active: false,
	count: 0,
	last: null,
	saved: null,
	autoSaved: null,
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

/**
 * Whether +2 / DNF / delete must stay off this saved solve. In warm-up mode the newest saved
 * solve is an older, real one, except right after a warm-up solve was saved (button or
 * auto-save): then it is that very solve and can be corrected.
 */
export function warmupLocksSolve(warmup: WarmupState, solveId: string | null | undefined): boolean {
	return warmup.active && (!solveId || solveId !== warmup.saved?.id);
}

export function startWarmup(now: number = Date.now()) {
	setState({ ...OFF, active: true, lastActivityAt: now });
}

export function stopWarmup() {
	setState(OFF);
}

export function noteWarmupSolve(solve: Solve, now: number = Date.now()) {
	setState({
		...state,
		count: state.count + 1,
		last: solve,
		saved: null,
		autoSaved: null,
		lastActivityAt: now,
	});
}

/** Hands the newest solve over once, so a double press cannot save it twice. */
export function takeLastWarmupSolve(auto: WarmupAutoSaveReason | null = null): Solve | null {
	const { last } = state;
	if (!last) return null;
	setState({ ...state, last: null, saved: last, autoSaved: auto });
	return last;
}

/** Hands an auto-saved solve back for Undo, once, and puts it under the Save button again. */
export function takeAutoSavedWarmupSolve(): Solve | null {
	const { saved, autoSaved } = state;
	if (!saved || !autoSaved) return null;
	setState({ ...state, last: saved, saved: null, autoSaved: null });
	return saved;
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
