import { useEffect, useState } from 'react';

/**
 * The hold-to-stop press in progress, for the progress bar under the digits. Outside Redux
 * on purpose: a TimerContext change re-renders the whole timer, and this only has to reach
 * one small component (same reasoning as status_store.ts).
 */
export interface HoldStopPress {
	/** Distinct per press, so the bar restarts its fill for a new one. */
	id: number;
	/** Epoch ms of the touchstart. */
	pressedAt: number;
}

let current: HoldStopPress | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
	listeners.forEach((listener) => listener());
}

export function getHoldStopPress(): HoldStopPress | null {
	return current;
}

export function beginHoldStopPress(pressedAt: number): HoldStopPress {
	current = { id: nextId++, pressedAt };
	emit();
	return current;
}

export function clearHoldStopPress(): void {
	if (!current) return;
	current = null;
	emit();
}

export function subscribeHoldStopPress(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function useHoldStopPress(): HoldStopPress | null {
	const [value, setValue] = useState(getHoldStopPress);
	useEffect(() => {
		setValue(getHoldStopPress());
		return subscribeHoldStopPress(() => setValue(getHoldStopPress()));
	}, []);
	return value;
}
