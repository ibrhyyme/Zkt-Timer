import { useEffect, useState } from 'react';
import { isMagnetDetectorPlatform, probeMagnetDetector } from './plugin';
import type { MagnetCapabilities } from './types';

/**
 * undefined while the probe runs, null on web / old binaries / no uncalibrated sensor /
 * `shouldProbe` false, otherwise the native capabilities. The probe is cached per session
 * and only asks whether the sensor exists (no stream starts). Callers decide who triggers
 * it: the timer hook only for members with the feature on, the quick settings row for
 * anyone on the touch timer, so the locked Pro row only appears where it would work.
 */
export function useMagnetAvailability(shouldProbe: boolean): MagnetCapabilities | null | undefined {
	const [caps, setCaps] = useState<MagnetCapabilities | null | undefined>(() =>
		shouldProbe && isMagnetDetectorPlatform() ? undefined : null
	);

	useEffect(() => {
		if (!shouldProbe || !isMagnetDetectorPlatform()) {
			setCaps(null);
			return;
		}
		let alive = true;
		probeMagnetDetector().then((result) => {
			if (alive) setCaps(result && result.available ? result : null);
		});
		return () => {
			alive = false;
		};
	}, [shouldProbe]);

	return caps;
}
