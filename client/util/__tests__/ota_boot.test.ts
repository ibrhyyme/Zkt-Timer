/**
 * OTA guard ordering.
 *
 * This path only runs inside the native shell, so it cannot be exercised in a browser
 * test. The behaviour worth pinning is the ordering: an interrupted download must be
 * retried on the next launch, a bundle that was handed to the plugin must not.
 */
// The suite runs in the node environment, which has no localStorage. The guard under
// test is entirely about what does and does not get written to it, so a minimal
// in-memory stand-in is enough and keeps the test free of a DOM.
const memory = new Map<string, string>();
(global as any).localStorage = {
	getItem: (k: string) => (memory.has(k) ? memory.get(k) : null),
	setItem: (k: string, v: string) => void memory.set(k, String(v)),
	removeItem: (k: string) => void memory.delete(k),
	clear: () => memory.clear(),
};

import {armLatestBundle} from '../native-shell-boot';

const ATTEMPT_KEY = 'zkt_ota_attempted_version';

function makeUpdater(overrides: any = {}) {
	return {
		current: jest.fn().mockResolvedValue({bundle: {version: '1.0.1'}}),
		getLatest: jest.fn().mockResolvedValue({version: '1.0.2', url: 'https://x/b.zip'}),
		download: jest.fn().mockResolvedValue({id: 'bundle-id'}),
		set: jest.fn().mockResolvedValue(undefined),
		reload: jest.fn().mockResolvedValue(undefined),
		...overrides,
	} as any;
}

describe('armLatestBundle', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('applies a newer bundle and marks it once downloaded', async () => {
		const updater = makeUpdater();
		await armLatestBundle(updater);

		expect(updater.download).toHaveBeenCalled();
		expect(updater.set).toHaveBeenCalledWith({id: 'bundle-id'});
		expect(updater.reload).toHaveBeenCalled();
		expect(localStorage.getItem(ATTEMPT_KEY)).toBe('1.0.2');
	});

	it('leaves no marker when the download is interrupted, so it retries', async () => {
		const updater = makeUpdater({download: jest.fn().mockRejectedValue(new Error('app closed'))});

		await expect(armLatestBundle(updater)).rejects.toThrow('app closed');
		// Nothing recorded, so the next launch tries this version again.
		expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
		expect(updater.set).not.toHaveBeenCalled();
	});

	it('does not retry a version that was already handed to the plugin', async () => {
		localStorage.setItem(ATTEMPT_KEY, '1.0.2');
		const updater = makeUpdater();

		await armLatestBundle(updater);

		expect(updater.download).not.toHaveBeenCalled();
		expect(updater.set).not.toHaveBeenCalled();
	});

	it('clears the marker once the newest bundle is the running one', async () => {
		localStorage.setItem(ATTEMPT_KEY, '1.0.2');
		const updater = makeUpdater({
			current: jest.fn().mockResolvedValue({bundle: {version: '1.0.2'}}),
		});

		await armLatestBundle(updater);

		expect(localStorage.getItem(ATTEMPT_KEY)).toBeNull();
		expect(updater.download).not.toHaveBeenCalled();
	});

	it('does nothing when the server reports no usable bundle', async () => {
		const updater = makeUpdater({getLatest: jest.fn().mockResolvedValue({error: 'no bundle available'})});

		await armLatestBundle(updater);

		expect(updater.download).not.toHaveBeenCalled();
	});
});
