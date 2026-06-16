import { useEffect, useState } from 'react';
import { getLocalStorage, setLocalStorage } from '../data/local_storage';

// Both values are intentionally device-local (NOT synced to the server):
// the right threshold depends on the physical device and the table it sits
// on, so carrying it across devices would produce wrong triggers.
const ENABLED_KEY = 'zkt_slam_enabled';
const SENSITIVITY_KEY = 'zkt_slam_sensitivity';
const CHANGE_EVENT = 'slamStopChanged';

export const DEFAULT_SENSITIVITY = 75; // FiveTimer reference default

export type SlamZone = 'low' | 'medium' | 'high' | 'ultra';

// Threshold in m/s² for the Z-axis sample delta; higher sensitivity = lower
// threshold = easier to trigger. Formula ported 1:1 from FiveTimer
// (com.thesixsides.cincotimer): (100 - sensitivity + 0.01) / 20.
// e.g. sensitivity 75 → 1.25 m/s², 0 → 5.0, 100 → ~0.0005.
export function sensitivityToThreshold(sensitivity: number): number {
	const s = Math.min(100, Math.max(0, sensitivity));
	return (100 - s + 0.01) / 20;
}

export function sensitivityZone(sensitivity: number): SlamZone {
	if (sensitivity < 25) return 'low';
	if (sensitivity < 50) return 'medium';
	if (sensitivity < 75) return 'high';
	return 'ultra';
}

export function getSlamEnabled(): boolean {
	if (typeof window === 'undefined') return false;
	return getLocalStorage(ENABLED_KEY) === true;
}

export function getSlamSensitivity(): number {
	if (typeof window === 'undefined') return DEFAULT_SENSITIVITY;
	const value = getLocalStorage(SENSITIVITY_KEY);
	return typeof value === 'number' && !isNaN(value) ? Math.min(100, Math.max(0, value)) : DEFAULT_SENSITIVITY;
}

export function setSlamEnabled(enabled: boolean): void {
	setLocalStorage(ENABLED_KEY, enabled as any);
	window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function setSlamSensitivity(sensitivity: number): void {
	setLocalStorage(SENSITIVITY_KEY, Math.min(100, Math.max(0, sensitivity)) as any);
	window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

// localStorage is not reactive — components subscribe to a custom event
// (same approach as the daily-goal storage layer).
export function useSlamStop() {
	const [enabled, setEnabledState] = useState(getSlamEnabled);
	const [sensitivity, setSensitivityState] = useState(getSlamSensitivity);

	useEffect(() => {
		function sync() {
			setEnabledState(getSlamEnabled());
			setSensitivityState(getSlamSensitivity());
		}

		window.addEventListener(CHANGE_EVENT, sync);
		return () => window.removeEventListener(CHANGE_EVENT, sync);
	}, []);

	return {
		enabled,
		sensitivity,
		setEnabled: setSlamEnabled,
		setSensitivity: setSlamSensitivity,
	};
}
