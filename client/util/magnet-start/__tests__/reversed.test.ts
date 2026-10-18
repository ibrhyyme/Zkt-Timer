import { magnetReversedEligible, ReversedEligibilityInput } from '../reversed_eligibility';

const ok: ReversedEligibilityInput = {
	allowed: true,
	reversedSetting: true,
	caps: { version: 1, available: true, uncalibrated: true },
	timerType: 'magnet',
	manualEntry: false,
	mobileLayout: true,
	inModal: false,
	matchMode: false,
	streamer: false,
	rotateSupported: true,
};

describe('magnetReversedEligible', () => {
	it('turns the page for a member on the Magnet Timer', () => {
		expect(magnetReversedEligible(ok)).toBe(true);
	});

	it('does not wait for the native probe (no upright flash on mount)', () => {
		expect(magnetReversedEligible({ ...ok, caps: undefined })).toBe(true);
	});

	it.each([
		['not allowed (non-admin)', { allowed: false }],
		['touch timer (magnet is its own input now)', { timerType: 'keyboard' }],
		['setting off', { reversedSetting: false }],
		['plugin unavailable (web, old binary)', { caps: null }],
		['smart cube timer', { timerType: 'smart' }],
		['StackMat', { timerType: 'stackmat' }],
		['manual entry', { manualEntry: true }],
		['desktop layout', { mobileLayout: false }],
		['timer in a modal', { inModal: true }],
		['match mode', { matchMode: true }],
		['streamer mode', { streamer: true }],
		['no CSS rotate support', { rotateSupported: false }],
	])('stays upright when %s', (_label, over) => {
		expect(magnetReversedEligible({ ...ok, ...over })).toBe(false);
	});

	it('has no solve-state input, so the screen can never flip mid-solve', () => {
		expect(Object.keys(ok).some((k) => /solv|started|running/i.test(k))).toBe(false);
	});
});
