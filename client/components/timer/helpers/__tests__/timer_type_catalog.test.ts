import {
	activeChoice,
	choiceEngineType,
	effectiveTimerType,
	magnetTimerOwnsInput,
	timerChoices,
	TimerChoice,
} from '../timer_type_catalog';
import type { DeviceProfile } from '../../../../util/device-profile';

const DESKTOP_WEB: DeviceProfile = { native: false, touchFirst: false };
const PHONE_WEB: DeviceProfile = { native: false, touchFirst: true };
const APP: DeviceProfile = { native: true, touchFirst: true };

describe('timerChoices', () => {
	it('lists the desktop dropdown in the owner order, with both wired brands last', () => {
		expect(timerChoices({ device: DESKTOP_WEB, magnetAvailable: false, inRoom: false, layout: 'dropdown' })).toEqual([
			'keyboard',
			'smart',
			'manual',
			'virtual',
			'gantimer',
			'qiyitimer',
			'stackmat',
			'qiyiwired',
		]);
	});

	it('puts the Magnet Timer fourth in the app grid and never offers wired there', () => {
		const list = timerChoices({ device: APP, magnetAvailable: true, inRoom: false, layout: 'grid' });
		expect(list).toEqual(['keyboard', 'smart', 'manual', 'magnet', 'virtual', 'gantimer', 'qiyitimer']);
		// Seven inputs plus the Quick Settings cell: the 8-cell grid.
		expect(list.length).toBe(7);
	});

	it('hides the Magnet Timer when the probe failed, in rooms, and on the web', () => {
		expect(timerChoices({ device: APP, magnetAvailable: false, inRoom: false, layout: 'grid' })).not.toContain('magnet');
		expect(timerChoices({ device: APP, magnetAvailable: true, inRoom: true, layout: 'grid' })).not.toContain('magnet');
		// A phone browser never runs the native stream, whatever the flag says.
		expect(timerChoices({ device: PHONE_WEB, magnetAvailable: true, inRoom: false, layout: 'grid' })).not.toContain('magnet');
	});

	it('offers no wired timer on phones and tablets, even in the dropdown layout', () => {
		const tablet = timerChoices({ device: PHONE_WEB, magnetAvailable: false, inRoom: false, layout: 'dropdown' });
		expect(tablet).not.toContain('stackmat');
		expect(tablet).not.toContain('qiyiwired');
		const tabletApp = timerChoices({ device: APP, magnetAvailable: true, inRoom: false, layout: 'dropdown' });
		expect(tabletApp).toContain('magnet');
		expect(tabletApp).not.toContain('stackmat');
	});

	it('keeps one wired cell for a narrow desktop window that gets the grid', () => {
		const list = timerChoices({ device: DESKTOP_WEB, magnetAvailable: false, inRoom: false, layout: 'grid' });
		expect(list).toContain('stackmat');
		expect(list).not.toContain('qiyiwired');
		expect(list.length).toBeLessThanOrEqual(7);
	});
});

describe('effectiveTimerType', () => {
	it('reads an input the device cannot run as the touch/keyboard timer', () => {
		expect(effectiveTimerType('stackmat', PHONE_WEB)).toBe('keyboard');
		expect(effectiveTimerType('stackmat', APP)).toBe('keyboard');
		expect(effectiveTimerType('magnet', DESKTOP_WEB)).toBe('keyboard');
		expect(effectiveTimerType('magnet', PHONE_WEB)).toBe('keyboard');
	});

	it('keeps every input the device can run', () => {
		expect(effectiveTimerType('stackmat', DESKTOP_WEB)).toBe('stackmat');
		expect(effectiveTimerType('magnet', APP)).toBe('magnet');
		for (const t of ['keyboard', 'smart', 'virtual', 'gantimer', 'qiyitimer']) {
			expect(effectiveTimerType(t, APP)).toBe(t);
			expect(effectiveTimerType(t, DESKTOP_WEB)).toBe(t);
		}
	});
});

describe('choiceEngineType', () => {
	it('runs the QiYi wired option on the StackMat engine', () => {
		expect(choiceEngineType('qiyiwired')).toBe('stackmat');
		expect(choiceEngineType('stackmat')).toBe('stackmat');
		expect(choiceEngineType('magnet')).toBe('magnet');
		expect(choiceEngineType('manual')).toBe('manual');
	});
});

describe('activeChoice', () => {
	const desktop = timerChoices({ device: DESKTOP_WEB, magnetAvailable: false, inRoom: false, layout: 'dropdown' });
	const narrow = timerChoices({ device: DESKTOP_WEB, magnetAvailable: false, inRoom: false, layout: 'grid' });
	const app = timerChoices({ device: APP, magnetAvailable: true, inRoom: false, layout: 'grid' });
	const base = { manualEntry: false, wiredBrand: 'stackmat' as const, magnetUsable: true, inRoom: false };

	it('checks the row of the wired brand the user picked', () => {
		expect(activeChoice({ ...base, timerType: 'stackmat', wiredBrand: 'qiyi', offered: desktop })).toBe('qiyiwired');
		expect(activeChoice({ ...base, timerType: 'stackmat', wiredBrand: 'stackmat', offered: desktop })).toBe('stackmat');
		// Older data: no brand stored yet.
		expect(activeChoice({ ...base, timerType: 'stackmat', wiredBrand: undefined, offered: desktop })).toBe('stackmat');
	});

	it('lands a QiYi wired choice on the single wired cell of the grid', () => {
		expect(activeChoice({ ...base, timerType: 'stackmat', wiredBrand: 'qiyi', offered: narrow })).toBe('stackmat');
	});

	it('shows manual entry over the input underneath', () => {
		expect(activeChoice({ ...base, timerType: 'keyboard', manualEntry: true, offered: app })).toBe('manual');
	});

	it('shows the touch cell for a Magnet selection that cannot run', () => {
		expect(activeChoice({ ...base, timerType: 'magnet', offered: app })).toBe('magnet');
		expect(activeChoice({ ...base, timerType: 'magnet', magnetUsable: false, offered: app })).toBe('keyboard');
		expect(activeChoice({ ...base, timerType: 'magnet', inRoom: true, offered: app })).toBe('keyboard');
	});

	it('always returns something on screen', () => {
		const offered: TimerChoice[] = ['keyboard', 'smart'];
		expect(activeChoice({ ...base, timerType: 'gantimer', offered })).toBe('keyboard');
	});
});

describe('magnetTimerOwnsInput', () => {
	const base = { timerType: 'magnet', manualEntry: false, allowed: true, caps: { available: true } };

	it('owns the input for a Pro member with a working sensor', () => {
		expect(magnetTimerOwnsInput(base)).toBe(true);
	});

	it('counts a probe still in flight as available, so the first tap is not a touch start', () => {
		expect(magnetTimerOwnsInput({ ...base, caps: undefined })).toBe(true);
	});

	it('falls back to touch without Pro, after a failed probe, in manual entry and on other inputs', () => {
		expect(magnetTimerOwnsInput({ ...base, allowed: false })).toBe(false);
		expect(magnetTimerOwnsInput({ ...base, caps: null })).toBe(false);
		expect(magnetTimerOwnsInput({ ...base, manualEntry: true })).toBe(false);
		expect(magnetTimerOwnsInput({ ...base, timerType: 'keyboard' })).toBe(false);
	});
});
