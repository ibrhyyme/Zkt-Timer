import { useEffect, useState } from 'react';
import type { MagnetPlatform, Vec3 } from './types';

// Device-local on purpose (never synced): the far baseline belongs to one physical phone.
// The old lift-to-start switch of the touch timer (it became the Magnet Timer input on
// 2026-10-05). Read once by takeLegacyMagnetEnabled and removed, never written.
const LEGACY_ENABLED_KEY = 'zkt_magnet_enabled';
// The phone lies upside down on the table (see client/util/reversed-ui.ts).
const REVERSED_KEY = 'zkt_magnet_reversed';
const FAR_KEY = 'zkt_magnet_far';
// Set once the first solve has been started by lifting the cube (useMagnetStart).
const INTRO_KEY = 'zkt_magnet_intro_done';
// Set once the "hold to stop" line has been on screen after a Magnet solve (MagnetHint).
const HOLD_HINT_KEY = 'zkt_magnet_hold_hint_seen';
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

/**
 * One-time migration read of the old touch timer switch: whether it was on, and the key is
 * removed, so this answers true at most once per device. Null when there is no key (never
 * set, or already migrated) or storage cannot be read.
 */
export function takeLegacyMagnetEnabled(): boolean | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = window.localStorage.getItem(LEGACY_ENABLED_KEY);
		if (raw === null) return null;
		window.localStorage.removeItem(LEGACY_ENABLED_KEY);
		return raw === 'true';
	} catch (e) {
		return null;
	}
}

export function getMagnetReversed(): boolean {
	return read(REVERSED_KEY) === true;
}

export function setMagnetReversed(reversed: boolean): void {
	write(REVERSED_KEY, reversed);
	if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function getMagnetIntroDone(): boolean {
	return read(INTRO_KEY) === true;
}

export function markMagnetIntroDone(): void {
	if (getMagnetIntroDone()) return;
	write(INTRO_KEY, true);
	if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/**
 * Whether the one-time "lift to start moved" notice is due: the old switch was on and the
 * user has not already chosen the Magnet Timer. The timer type is never changed for them
 * (that input has no touch stop, so switching silently would surprise a touch user).
 */
export function legacyMagnetNoticeDue(wasEnabled: boolean | null, timerType: string | null | undefined): boolean {
	return wasEnabled === true && timerType !== 'magnet';
}

export function getMagnetHoldHintSeen(): boolean {
	return read(HOLD_HINT_KEY) === true;
}

export function markMagnetHoldHintSeen(): void {
	if (getMagnetHoldHintSeen()) return;
	write(HOLD_HINT_KEY, true);
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
	const [reversed, setReversedState] = useState(getMagnetReversed);
	const [introDone, setIntroDoneState] = useState(getMagnetIntroDone);
	const [holdHintSeen, setHoldHintSeenState] = useState(getMagnetHoldHintSeen);

	useEffect(() => {
		function sync() {
			setReversedState(getMagnetReversed());
			setIntroDoneState(getMagnetIntroDone());
			setHoldHintSeenState(getMagnetHoldHintSeen());
		}
		window.addEventListener(CHANGE_EVENT, sync);
		return () => window.removeEventListener(CHANGE_EVENT, sync);
	}, []);

	return { reversed, setReversed: setMagnetReversed, introDone, holdHintSeen };
}
