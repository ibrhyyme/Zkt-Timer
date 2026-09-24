import { useEffect, useState } from 'react';
import type { MagnetPlatform, Vec3 } from './types';

// Device-local on purpose (never synced): the far baseline belongs to one physical phone,
// and the switch follows slam-to-stop, which is also per device.
const ENABLED_KEY = 'zkt_magnet_enabled';
const FAR_KEY = 'zkt_magnet_far';
const CHANGE_EVENT = 'magnetStartChanged';

interface StoredFar {
	v: 1;
	platform: MagnetPlatform;
	far: Vec3;
	savedAt: number;
}

function read(key: string): any {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.localStorage.getItem(key);
		return raw === null ? null : JSON.parse(raw);
	} catch (e) {
		return null;
	}
}

function write(key: string, value: unknown): void {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch (e) {
		// Quota or private mode: the feature keeps working for this session.
	}
}

export function getMagnetEnabled(): boolean {
	return read(ENABLED_KEY) === true;
}

export function setMagnetEnabled(enabled: boolean): void {
	write(ENABLED_KEY, enabled);
	if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function getStoredFar(platform: MagnetPlatform): Vec3 | null {
	const value = read(FAR_KEY) as StoredFar | null;
	if (!value || value.v !== 1 || value.platform !== platform || !Array.isArray(value.far) || value.far.length !== 3) {
		return null;
	}
	if (!value.far.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
	return [value.far[0], value.far[1], value.far[2]];
}

export function setStoredFar(platform: MagnetPlatform, far: Vec3): void {
	const value: StoredFar = { v: 1, platform, far: [far[0], far[1], far[2]], savedAt: Date.now() };
	write(FAR_KEY, value);
}

/** localStorage is not reactive; components listen to a custom event (as slam-to-stop does). */
export function useMagnetStartSettings() {
	const [enabled, setEnabledState] = useState(getMagnetEnabled);

	useEffect(() => {
		function sync() {
			setEnabledState(getMagnetEnabled());
		}
		window.addEventListener(CHANGE_EVENT, sync);
		return () => window.removeEventListener(CHANGE_EVENT, sync);
	}, []);

	return { enabled, setEnabled: setMagnetEnabled };
}
