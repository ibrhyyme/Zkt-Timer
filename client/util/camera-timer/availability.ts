import { useEffect, useState } from 'react';

/**
 * The Kamera Timer's brain (a worker with MediaPipe's hand model and the pad timer) is not in
 * this repo. The server serves it to admins from data/camera-timer (server/api/camera_timer.ts);
 * manifest.json names the current worker file. No manifest (not allowed, or a server without
 * the upload) means the input is not offered at all.
 */

export const CAMERA_TIMER_BASE = '/api/camera-timer/';

export interface CameraTimerManifest {
	v: number;
	/** Worker file name, versioned by content: brain-<hash>.js */
	brain: string;
	/** MediaPipe version the brain loads, for the debug log. */
	mediapipe: string;
}

/** Validates a fetched manifest. Pure. */
export function parseCameraTimerManifest(raw: unknown): CameraTimerManifest | null {
	if (!raw || typeof raw !== 'object') return null;
	const m = raw as Record<string, unknown>;
	if (m.v !== 1) return null;
	// The worker URL is built from this name, so it has to be exactly a brain file.
	if (typeof m.brain !== 'string' || !/^brain-[0-9a-f]{6,64}\.js$/.test(m.brain)) return null;
	return { v: 1, brain: m.brain, mediapipe: typeof m.mediapipe === 'string' ? m.mediapipe : '' };
}

export function cameraBrainUrl(manifest: CameraTimerManifest): string {
	return CAMERA_TIMER_BASE + manifest.brain;
}

let probe: Promise<CameraTimerManifest | null> | null = null;
let settled: CameraTimerManifest | null | undefined;

/** Fetches the manifest once per page load. Never throws. */
export function probeCameraTimer(): Promise<CameraTimerManifest | null> {
	if (!probe) {
		probe = fetch(CAMERA_TIMER_BASE + 'manifest.json', { credentials: 'same-origin', cache: 'no-store' })
			.then((res) => (res.ok ? res.json() : null))
			.then(parseCameraTimerManifest)
			.catch(() => null)
			.then((manifest) => {
				settled = manifest;
				return manifest;
			});
	}
	return probe;
}

/**
 * undefined while the manifest loads, null when there is none or `shouldProbe` is false.
 * Callers pass whether the user may use the input at all, so nobody else ever asks.
 */
export function useCameraTimerAvailability(shouldProbe: boolean): CameraTimerManifest | null | undefined {
	const [manifest, setManifest] = useState<CameraTimerManifest | null | undefined>(() =>
		shouldProbe ? settled : null
	);

	useEffect(() => {
		if (!shouldProbe || typeof window === 'undefined') {
			setManifest(null);
			return;
		}
		let alive = true;
		probeCameraTimer().then((result) => {
			if (alive) setManifest(result);
		});
		return () => {
			alive = false;
		};
	}, [shouldProbe]);

	return manifest;
}
