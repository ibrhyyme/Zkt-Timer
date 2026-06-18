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
// threshold = easier to trigger.
//
// Non-linear (quadratic) curve. FiveTimer's linear (100-s)/20 left most of the
// "Ultra" zone above the 0.3 deadband, so Ultra felt like FiveTimer's "High".
// Squaring drops the whole upper range below the deadband fast: the entire
// Ultra zone (s≥~75) reaches the effective floor (0.3 = FiveTimer Ultra), while
// the low zone still demands a hard slam.
// e.g. s=0 → 4.0, s=25 → 2.25, s=50 → 1.0, s=75 → 0.25 (<deadband → ~0.3), s=100 → 0.
const MAX_THRESHOLD = 4; // m/s² at sensitivity 0 — tunable on-device
export function sensitivityToThreshold(sensitivity: number): number {
	const s = Math.min(100, Math.max(0, sensitivity));
	const t = (100 - s) / 100;
	return MAX_THRESHOLD * t * t;
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
