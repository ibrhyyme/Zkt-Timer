import {VISITOR_FIRST_LOOK_BACKGROUND, visitorFirstLookPatch} from '../visitor_first_look';

describe('visitorFirstLookPatch', () => {
	it('gives a visitor with no background the Kuzey Işığı one', () => {
		expect(VISITOR_FIRST_LOOK_BACKGROUND).toBe('aurora');
		expect(visitorFirstLookPatch({timer_bg_preset: null})).toEqual({timer_bg_preset: 'aurora'});
		expect(visitorFirstLookPatch({})).toEqual({timer_bg_preset: 'aurora'});
		expect(visitorFirstLookPatch(undefined)).toEqual({timer_bg_preset: 'aurora'});
	});

	it('keeps a background the visitor already chose', () => {
		expect(visitorFirstLookPatch({timer_bg_preset: 'galaxy'})).toEqual({});
	});
});
