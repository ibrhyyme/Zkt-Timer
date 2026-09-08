import {
	timerTypeSupportsBucket,
	timerTypeUnsupportedReason,
} from '../timer_type_support';

/**
 * Which input works on which puzzle. This table used to be copy-pasted into both
 * pickers, which is how they came to disagree: the mobile drawer ended up showing
 * nothing selected at all while the desktop one silently fell back to keyboard.
 */

// 'qiyiwired' merged into 'stackmat'; one wired entry now.
const HARDWARE_TYPES = ['stackmat', 'gantimer', 'qiyitimer'] as const;

describe('timerTypeSupportsBucket', () => {
	describe('keyboard', () => {
		it('works on every puzzle', () => {
			for (const cubeType of ['333', '222', '777', 'megaminx', 'skewb', 'clock', 'sq1', 'pyram']) {
				expect(timerTypeSupportsBucket('keyboard', cubeType)).toBe(true);
			}
		});
	});

	describe('hardware timers', () => {
		it.each(HARDWARE_TYPES)('%s measures wall clock time, so it works anywhere', (type) => {
			for (const cubeType of ['333', 'megaminx', 'clock', 'sq1']) {
				expect(timerTypeSupportsBucket(type, cubeType)).toBe(true);
			}
		});
	});

	describe('smart cube', () => {
		it('works on 3x3 cube types', () => {
			for (const cubeType of ['333', '333cfop', '333roux', '333mehta']) {
				expect(timerTypeSupportsBucket('smart', cubeType)).toBe(true);
			}
		});

		it('works on the WCA 3x3 event', () => {
			expect(timerTypeSupportsBucket('smart', 'wca', '333')).toBe(true);
		});

		it('is refused on anything else, including other NxN sizes', () => {
			for (const cubeType of ['222', '444', '555', '666', '777', 'megaminx', 'skewb', 'clock']) {
				expect(timerTypeSupportsBucket('smart', cubeType)).toBe(false);
			}
			expect(timerTypeSupportsBucket('smart', 'wca', '444')).toBe(false);
		});
	});

	describe('virtual cube', () => {
		it('works on every NxN from 2x2 to 7x7', () => {
			for (const cubeType of ['222', '333', '444', '555', '666', '777']) {
				expect(timerTypeSupportsBucket('virtual', cubeType)).toBe(true);
			}
		});

		it('works on 3x3 method variants and WCA cube events', () => {
			expect(timerTypeSupportsBucket('virtual', '333cfop')).toBe(true);
			expect(timerTypeSupportsBucket('virtual', '444yau')).toBe(true);
			expect(timerTypeSupportsBucket('virtual', 'wca', '555')).toBe(true);
			expect(timerTypeSupportsBucket('virtual', 'wca', '333oh')).toBe(true);
		});

		it('is refused on non-NxN puzzles', () => {
			for (const cubeType of ['megaminx', 'skewb', 'clock', 'sq1', 'pyram', 'fto']) {
				expect(timerTypeSupportsBucket('virtual', cubeType)).toBe(false);
			}
			expect(timerTypeSupportsBucket('virtual', 'wca', 'minx')).toBe(false);
		});

		it('is refused on an unknown or custom cube type', () => {
			expect(timerTypeSupportsBucket('virtual', 'some_custom_type')).toBe(false);
		});
	});

	it('refuses everything restricted when no cube type is known yet', () => {
		expect(timerTypeSupportsBucket('smart', null)).toBe(false);
		expect(timerTypeSupportsBucket('virtual', undefined)).toBe(false);
		// Unrestricted inputs do not care.
		expect(timerTypeSupportsBucket('keyboard', null)).toBe(true);
		expect(timerTypeSupportsBucket('stackmat', null)).toBe(true);
	});
});

describe('timerTypeUnsupportedReason', () => {
	it('is null while the input is usable', () => {
		expect(timerTypeUnsupportedReason('smart', '333')).toBeNull();
		expect(timerTypeUnsupportedReason('virtual', '555')).toBeNull();
		expect(timerTypeUnsupportedReason('keyboard', 'megaminx')).toBeNull();
	});

	it('names the reason per input', () => {
		// Reuses a key that already existed in all five locales but had never been
		// referenced from any code.
		expect(timerTypeUnsupportedReason('smart', 'megaminx')).toBe('room_timer.smart_cube_3x3_only');
		expect(timerTypeUnsupportedReason('virtual', 'megaminx')).toBe(
			'room_timer.virtual_cube_nxn_only'
		);
	});

	it('gives the smart cube its own reason on a big cube, not the virtual one', () => {
		expect(timerTypeUnsupportedReason('smart', '444')).toBe('room_timer.smart_cube_3x3_only');
		expect(timerTypeUnsupportedReason('virtual', '444')).toBeNull();
	});
});
