// The settled MagnetDetector probe must be readable synchronously, so a picker mounted after
// it settled starts with the Magnet tile decided (no 7 to 8 cell jump in the mobile grid).

const getCapabilities = jest.fn();
const addListener = jest.fn();

jest.mock('../../platform', () => ({ isNative: () => true }));
jest.mock('@capacitor/core', () => ({
	Capacitor: { getPlatform: () => 'android', isPluginAvailable: () => true },
	registerPlugin: () => ({ getCapabilities, addListener, start: jest.fn(), stop: jest.fn() }),
}));

const CAPS = { version: 1, available: true, uncalibrated: true };

describe('MagnetDetector probe cache', () => {
	beforeEach(() => {
		// The probe races the native call against a timeout that is never cleared; a real one
		// would keep the worker alive. The native answer settles first in every case here.
		jest.spyOn(global, 'setTimeout').mockImplementation((() => 0) as unknown as typeof setTimeout);
		jest.resetModules();
		getCapabilities.mockReset();
		addListener.mockReset();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('is undefined before the probe settles and holds the result after', async () => {
		getCapabilities.mockResolvedValue(CAPS);
		addListener.mockResolvedValue({ remove: jest.fn() });
		const plugin = require('../plugin');

		expect(plugin.peekMagnetProbe()).toBeUndefined();
		const pending = plugin.probeMagnetDetector();
		expect(plugin.peekMagnetProbe()).toBeUndefined();
		await pending;
		expect(plugin.peekMagnetProbe()).toEqual(CAPS);
	});

	it('caches a failed probe as null (old binary without the plugin)', async () => {
		getCapabilities.mockRejectedValue(new Error('not implemented'));
		const plugin = require('../plugin');

		await plugin.probeMagnetDetector();
		expect(plugin.peekMagnetProbe()).toBeNull();
	});

	it('asks the native side once per session', async () => {
		getCapabilities.mockResolvedValue(CAPS);
		addListener.mockResolvedValue({ remove: jest.fn() });
		const plugin = require('../plugin');

		await Promise.all([plugin.probeMagnetDetector(), plugin.probeMagnetDetector()]);
		await plugin.probeMagnetDetector();
		expect(getCapabilities).toHaveBeenCalledTimes(1);
	});
});
