// Per-device MAC address storage for cubes whose decryption key is derived from
// the MAC (GAN, MoYu32, QiYi).
//
// These drivers used to keep ONE MAC per brand in localStorage. With two cubes of
// the same brand the second one always read the first one's MAC, which decrypts to
// garbage: the handshake watchdog then timed out, reported `wrong_mac`, wiped the
// entry, and the user had to hit connect two or three times before being asked for
// the MAC by hand. Keying by device makes the right MAC available on the first try
// and keeps one cube's failure from erasing the other's entry.
//
// Storage shape: { [deviceId]: "AB:CD:EF:12:34:56" }. A plain string left over from
// the old single-value format is still honoured as a suggestion (see readAnyMac) so
// single-cube users are not asked again after upgrading.

function readStore(storageKey) {
	try {
		const raw = localStorage.getItem(storageKey);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch (e) {
		// Legacy single-value format (a bare MAC string) or corrupt JSON.
		return {};
	}
}

/**
 * The identity to store a cube's MAC under. The web adapter mints `deviceId` per
 * requestDevice() call, so keying on it means the same cube never finds its own
 * entry; `persistentId` (BluetoothDevice.id on web, MAC/UUID on native) survives
 * across connections.
 */
export function cubeStorageId(device) {
	if (!device) return null;
	return device.persistentId || device.deviceId || null;
}

function writeStore(storageKey, store) {
	try {
		localStorage.setItem(storageKey, JSON.stringify(store));
	} catch (e) {
		// Storage full or blocked — the cube still works, it just asks again later.
	}
}

/** MAC remembered for this specific device, or null. */
export function readCachedMac(storageKey, deviceId) {
	if (!deviceId) return null;
	return readStore(storageKey)[deviceId] || null;
}

/**
 * Any MAC we have seen for this brand. Only for pre-filling the manual entry modal:
 * a MAC from another cube is a starting point for the user, never something to
 * connect with.
 */
export function readAnyMac(storageKey) {
	try {
		const raw = localStorage.getItem(storageKey);
		if (!raw) return null;
		if (raw.indexOf('{') !== 0) return raw; // legacy single-value entry
		const values = Object.values(readStore(storageKey));
		return values.length ? values[values.length - 1] : null;
	} catch (e) {
		return null;
	}
}

export function writeCachedMac(storageKey, deviceId, mac) {
	if (!deviceId || !mac) return;
	const store = readStore(storageKey);
	// Drop entries written under the old per-call web ids (`web_0`, `web_1`, ...):
	// they can never be matched again and would grow without bound.
	for (const key of Object.keys(store)) {
		if (/^web_\d+$/.test(key)) delete store[key];
	}
	store[deviceId] = mac;
	writeStore(storageKey, store);
}

/** Forget this device only; other cubes keep their entries. */
export function clearCachedMac(storageKey, deviceId) {
	if (!deviceId) return;
	const store = readStore(storageKey);
	if (store[deviceId]) {
		delete store[deviceId];
		writeStore(storageKey, store);
	}
}
