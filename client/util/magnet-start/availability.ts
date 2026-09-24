import { useEffect, useState } from 'react';
import { isMagnetDetectorPlatform, probeMagnetDetector } from './plugin';
import type { MagnetCapabilities } from './types';

/**
 * undefined while the probe runs, null on web / old binaries / no uncalibrated sensor /
 * `shouldProbe` false, otherwise the native capabilities. The probe is cached per session
 * and is only made for users who may use the feature, so nobody else ever touches the
 * native plugin.
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
