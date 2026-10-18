import { useEffect, useState } from 'react';
import { isMagnetDetectorPlatform, peekMagnetProbe, probeMagnetDetector } from './plugin';
import type { MagnetCapabilities } from './types';

function usable(result: MagnetCapabilities | null): MagnetCapabilities | null {
	return result && result.available ? result : null;
}

/**
 * undefined while the probe runs, null on web / old binaries / no uncalibrated sensor /
 * `shouldProbe` false, otherwise the native capabilities. The probe is cached per session
 * and only asks whether the sensor exists (no stream starts). Callers decide who triggers
 * it: the timer hook only for members with the feature on, the quick settings row for
 * anyone on the touch timer, so the locked Pro row only appears where it would work.
 */
export function useMagnetAvailability(shouldProbe: boolean): MagnetCapabilities | null | undefined {
	const [caps, setCaps] = useState<MagnetCapabilities | null | undefined>(() => {
		if (!shouldProbe || !isMagnetDetectorPlatform()) return null;
		const settled = peekMagnetProbe();
		return settled === undefined ? undefined : usable(settled);
	});

	useEffect(() => {
		if (!shouldProbe || !isMagnetDetectorPlatform()) {
			setCaps(null);
			return;
		}
		let alive = true;
		probeMagnetDetector().then((result) => {
			if (alive) setCaps(usable(result));
		});
		return () => {
			alive = false;
		};
	}, [shouldProbe]);

	return caps;
}

/**
 * Starts the session's probe early (the timer page), so the mobile grid has the answer when
 * the drawer first opens and does not grow from 7 to 8 cells under the user's finger. Asks
 * only whether the sensor exists, the same call the grid makes for every app user anyway.
 */
export function usePrefetchMagnetProbe(enabled: boolean): void {
	useEffect(() => {
		if (enabled && isMagnetDetectorPlatform()) probeMagnetDetector();
	}, [enabled]);
}
