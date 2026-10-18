/**
 * What a stored timer_type means on the current device (feedback 1.5.1-c, S-1, S-2).
 * The read side falls back, the sync blob keeps the stored value, so a phone never rewrites
 * the desktop's wired timer and mobile web never rewrites the app's Magnet Timer.
 */

import Loki from 'lokijs';
import type { DeviceProfile } from '../../../util/device-profile';

let mockCollection: Collection<any>;
let mockProfile: DeviceProfile;

jest.mock('../init', () => ({ getSettingsDb: () => mockCollection }));
jest.mock('../../../util/device-profile', () => ({ getDeviceProfile: () => mockProfile }));

import { collectPlatformPrefs, getSetting, getSettings } from '../query';

const DESKTOP_WEB: DeviceProfile = { native: false, touchFirst: false };
const PHONE_WEB: DeviceProfile = { native: false, touchFirst: true };
const APP: DeviceProfile = { native: true, touchFirst: true };

function store(id: string, value: any) {
	mockCollection.insert({ id, value });
}

beforeEach(() => {
	const db = new Loki('timer-type-read.db');
	mockCollection = db.addCollection('settings', { unique: ['id'] });
	mockProfile = DESKTOP_WEB;
});

describe('timer_type read on each device', () => {
	it('runs a synced wired timer as the touch timer on a phone, without rewriting it', () => {
		store('timer_type', 'stackmat');
		mockProfile = PHONE_WEB;

		expect(getSetting('timer_type')).toBe('keyboard');
		expect(getSettings().timer_type).toBe('keyboard');
		expect(collectPlatformPrefs().timer_type).toBe('stackmat');
		expect(mockCollection.findOne({ id: 'timer_type' }).value).toBe('stackmat');
	});

	it('keeps the wired timer on desktop web', () => {
		store('timer_type', 'stackmat');
		expect(getSetting('timer_type')).toBe('stackmat');
		expect(getSettings().timer_type).toBe('stackmat');
	});

	it('runs the app Magnet Timer as touch in a phone browser, and keeps it in the sync blob', () => {
		store('timer_type', 'magnet');
		mockProfile = PHONE_WEB;
		expect(getSetting('timer_type')).toBe('keyboard');
		expect(collectPlatformPrefs().timer_type).toBe('magnet');

		mockProfile = APP;
		expect(getSetting('timer_type')).toBe('magnet');
		expect(getSettings().timer_type).toBe('magnet');
	});

	it('reads a legacy QiYi wired value as the StackMat engine with the QiYi brand', () => {
		store('timer_type', 'qiyiwired');
		expect(getSetting('timer_type')).toBe('stackmat');
		expect(getSetting('wired_timer_brand')).toBe('qiyi');
		const all = getSettings();
		expect(all.timer_type).toBe('stackmat');
		expect(all.wired_timer_brand).toBe('qiyi');
	});

	it('reads a legacy QiYi wired value as touch on a phone', () => {
		store('timer_type', 'qiyiwired');
		mockProfile = PHONE_WEB;
		expect(getSetting('timer_type')).toBe('keyboard');
		expect(getSettings().timer_type).toBe('keyboard');
	});

	it('keeps an explicit brand over the legacy value', () => {
		store('timer_type', 'qiyiwired');
		store('wired_timer_brand', 'stackmat');
		expect(getSetting('wired_timer_brand')).toBe('stackmat');
		expect(getSettings().wired_timer_brand).toBe('stackmat');
	});

	it('leaves inputs every device runs alone', () => {
		for (const t of ['keyboard', 'smart', 'virtual', 'gantimer', 'qiyitimer']) {
			mockCollection.clear();
			store('timer_type', t);
			for (const p of [DESKTOP_WEB, PHONE_WEB, APP]) {
				mockProfile = p;
				expect(getSetting('timer_type')).toBe(t);
			}
		}
	});
});
