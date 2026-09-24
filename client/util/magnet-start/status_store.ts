import { useEffect, useState } from 'react';
import type { MagnetStage } from './controller';
import type { DetectorPhase, MagnetHint } from './types';

/**
 * Discrete magnet state for the UI. Nothing per-batch goes here (the live field value
 * has its own channel in the service): a TimerContext or Redux change re-renders the
 * whole timer, and this store only notifies when a field actually changes.
 */
export interface MagnetStatus {
	/** The native stream is running. */
	active: boolean;
	stage: MagnetStage;
	green: boolean;
	orange: boolean;
	phase: DetectorPhase;
	hint: MagnetHint;
}

const INITIAL: MagnetStatus = {
	active: false,
	stage: 'off',
	green: false,
	orange: false,
	phase: 'unknown',
	hint: 'none',
};

let status: MagnetStatus = INITIAL;
const listeners = new Set<() => void>();

export function getMagnetStatus(): MagnetStatus {
	return status;
}

export function setMagnetStatus(partial: Partial<MagnetStatus>): void {
	let changed = false;
	for (const key of Object.keys(partial) as (keyof MagnetStatus)[]) {
		if (status[key] !== partial[key]) {
			changed = true;
			break;
		}
	}
	if (!changed) return;
	status = { ...status, ...partial };
	listeners.forEach((listener) => listener());
}

export function resetMagnetStatus(): void {
	setMagnetStatus(INITIAL);
}

export function subscribeMagnetStatus(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function useMagnetStatus(): MagnetStatus {
	const [value, setValue] = useState(getMagnetStatus);
	useEffect(() => {
		// The store may have changed between render and subscription.
		setValue(getMagnetStatus());
		return subscribeMagnetStatus(() => setValue(getMagnetStatus()));
	}, []);
	return value;
}
