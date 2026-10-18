import {
	getMagnetHoldHintSeen,
	legacyMagnetNoticeDue,
	markMagnetHoldHintSeen,
	takeLegacyMagnetEnabled,
} from '../settings';

// Jest runs in the node environment: give the module a window with a working localStorage.
function installStorage(initial: Record<string, string> = {}) {
	const data = new Map<string, string>(Object.entries(initial));
	const storage = {
		getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
		setItem: (k: string, v: string) => void data.set(k, String(v)),
		removeItem: (k: string) => void data.delete(k),
	};
	(global as any).window = {
		localStorage: storage,
		dispatchEvent: () => true,
	};
	(global as any).CustomEvent = class {
		constructor(public type: string) {}
	};
	return data;
}

afterEach(() => {
	delete (global as any).window;
});

describe('takeLegacyMagnetEnabled (one-time migration read of zkt_magnet_enabled)', () => {
	it('answers true once when the old switch was on, then retires the key', () => {
		const data = installStorage({ zkt_magnet_enabled: 'true' });
		expect(takeLegacyMagnetEnabled()).toBe(true);
		expect(data.has('zkt_magnet_enabled')).toBe(false);
		expect(takeLegacyMagnetEnabled()).toBeNull();
	});

	it('retires a switch that was off without reporting it on', () => {
		const data = installStorage({ zkt_magnet_enabled: 'false' });
		expect(takeLegacyMagnetEnabled()).toBe(false);
		expect(data.has('zkt_magnet_enabled')).toBe(false);
	});

	it('is null when the key was never set', () => {
		installStorage();
		expect(takeLegacyMagnetEnabled()).toBeNull();
	});

	it('is null on the server', () => {
		expect(takeLegacyMagnetEnabled()).toBeNull();
	});

	it('is null when storage throws (private mode)', () => {
		(global as any).window = {
			localStorage: {
				getItem: () => {
					throw new Error('blocked');
				},
			},
		};
		expect(takeLegacyMagnetEnabled()).toBeNull();
	});
});

describe('legacyMagnetNoticeDue', () => {
	it('is due when the switch was on and the Magnet Timer is not chosen yet', () => {
		expect(legacyMagnetNoticeDue(true, 'keyboard')).toBe(true);
		expect(legacyMagnetNoticeDue(true, undefined)).toBe(true);
	});

	it('is not due for someone who already picked the Magnet Timer', () => {
		expect(legacyMagnetNoticeDue(true, 'magnet')).toBe(false);
	});

	it('is not due when the switch was off or never set', () => {
		expect(legacyMagnetNoticeDue(false, 'keyboard')).toBe(false);
		expect(legacyMagnetNoticeDue(null, 'keyboard')).toBe(false);
	});
});

describe('hold to stop hint flag', () => {
	it('is unseen until marked, then stays seen', () => {
		installStorage();
		expect(getMagnetHoldHintSeen()).toBe(false);
		markMagnetHoldHintSeen();
		expect(getMagnetHoldHintSeen()).toBe(true);
	});
});
