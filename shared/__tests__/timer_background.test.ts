import {
	isTimerBackgroundRowEmpty,
	parseTimerBackgroundTarget,
	resolveTimerBackground,
} from '../timer_background';

describe('resolveTimerBackground', () => {
	const legacyRow = {storage_path: 'timer_backgrounds/a.jpg', media_type: null};

	it('shows a row from before the split on desktop and on mobile (K-7 migration)', () => {
		expect(resolveTimerBackground(legacyRow, 'desktop')).toEqual({
			storage_path: 'timer_backgrounds/a.jpg',
			is_video: false,
		});
		expect(resolveTimerBackground(legacyRow, 'mobile')).toEqual({
			storage_path: 'timer_backgrounds/a.jpg',
			is_video: false,
		});
	});

	it('uses the mobile slot once "same as desktop" is off', () => {
		const row = {
			storage_path: 'timer_backgrounds/a.jpg',
			media_type: 'image',
			mobile_storage_path: 'timer_backgrounds/b.mp4',
			mobile_media_type: 'video',
			mobile_same_as_desktop: false,
		};
		expect(resolveTimerBackground(row, 'mobile')).toEqual({storage_path: 'timer_backgrounds/b.mp4', is_video: true});
		expect(resolveTimerBackground(row, 'desktop')?.storage_path).toBe('timer_backgrounds/a.jpg');
	});

	it('shows nothing on mobile when the switch is off and no mobile file exists', () => {
		const row = {storage_path: 'timer_backgrounds/a.jpg', mobile_same_as_desktop: false};
		expect(resolveTimerBackground(row, 'mobile')).toBeNull();
	});

	it('ignores a stored mobile file while the switch is on', () => {
		const row = {storage_path: null, mobile_storage_path: 'timer_backgrounds/b.jpg', mobile_same_as_desktop: true};
		expect(resolveTimerBackground(row, 'mobile')).toBeNull();
	});

	it('handles no row', () => {
		expect(resolveTimerBackground(null, 'desktop')).toBeNull();
		expect(resolveTimerBackground(undefined, 'mobile')).toBeNull();
	});
});

describe('parseTimerBackgroundTarget', () => {
	it('defaults to desktop, which is what clients before the split upload', () => {
		expect(parseTimerBackgroundTarget(undefined)).toBe('desktop');
		expect(parseTimerBackgroundTarget('anything')).toBe('desktop');
		expect(parseTimerBackgroundTarget('mobile')).toBe('mobile');
	});
});

describe('isTimerBackgroundRowEmpty', () => {
	it('keeps a row that only remembers the switch being off', () => {
		expect(isTimerBackgroundRowEmpty({mobile_same_as_desktop: false})).toBe(false);
	});

	it('drops a row with no files and the default switch', () => {
		expect(isTimerBackgroundRowEmpty({storage_path: null, mobile_storage_path: null})).toBe(true);
		expect(isTimerBackgroundRowEmpty({mobile_storage_path: 'x'})).toBe(false);
	});
});
