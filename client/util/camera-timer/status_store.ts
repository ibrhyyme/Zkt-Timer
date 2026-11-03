import { useEffect, useState } from 'react';

/**
 * Discrete Kamera Timer state for the rest of the timer page. Like the magnet's store, the
 * green state lives here, not in canStart: KeyWatcher relies on canStart never being true
 * without a live Space or touch hold.
 */
export interface CameraTimerStatus {
	/** The camera is open and the brain runs (CameraTimer mounted and started). */
	engaged: boolean;
	/** Both hands rest on the pads: lifting one starts (digits green, like a StackMat). */
	green: boolean;
}

const INITIAL: CameraTimerStatus = { engaged: false, green: false };

let status: CameraTimerStatus = INITIAL;
const listeners = new Set<() => void>();

export function getCameraTimerStatus(): CameraTimerStatus {
	return status;
}

export function setCameraTimerStatus(partial: Partial<CameraTimerStatus>): void {
	let changed = false;
	for (const key of Object.keys(partial) as (keyof CameraTimerStatus)[]) {
		if (status[key] !== partial[key]) {
			changed = true;
			break;
		}
	}
	if (!changed) return;
	status = { ...status, ...partial };
	listeners.forEach((listener) => listener());
}

export function resetCameraTimerStatus(): void {
	setCameraTimerStatus(INITIAL);
	pendingStopEpoch = null;
}

export function useCameraTimerStatus(): CameraTimerStatus {
	const [value, setValue] = useState(getCameraTimerStatus);
	useEffect(() => {
		const update = () => setValue(getCameraTimerStatus());
		listeners.add(update);
		update();
		return () => {
			listeners.delete(update);
		};
	}, []);
	return value;
}

// The wall-clock time the running solve will stop at, while the hands sit in the stop pose and
// the brain waits out its confirmation (pad timer pendingStopT). The display freezes there at
// once instead of running on and jumping back ~0.4 s when the stop lands (owner, 2026-11-02).
// A plain variable, read by TimeDisplay's 33 ms tick: it changes on every frame.
let pendingStopEpoch: number | null = null;

export function getCameraPendingStop(): number | null {
	return pendingStopEpoch;
}

export function setCameraPendingStop(epoch: number | null): void {
	pendingStopEpoch = epoch;
}
