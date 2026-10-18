import { NAV_LABEL_MIN_GAP_PX, NAV_LABELS_SHOWN, nextNavLabelFit } from '../nav_label_fit';

describe('nextNavLabelFit (Önceki / Sonraki labels on the mobile action row)', () => {
	it('keeps the labels while the row has room for them and the gap', () => {
		expect(nextNavLabelFit(NAV_LABELS_SHOWN, 342, 342 - NAV_LABEL_MIN_GAP_PX)).toBe(NAV_LABELS_SHOWN);
	});

	it('hides them when they do not fit, and remembers the width they needed', () => {
		expect(nextNavLabelFit(NAV_LABELS_SHOWN, 342, 400)).toEqual({ shown: false, needed: 400 + NAV_LABEL_MIN_GAP_PX });
	});

	it('brings them back once the row is wide enough again', () => {
		const hidden = { shown: false, needed: 408 };
		expect(nextNavLabelFit(hidden, 407, null)).toBe(hidden);
		expect(nextNavLabelFit(hidden, 408, null)).toBe(NAV_LABELS_SHOWN);
	});

	it('changes nothing without a usable measurement', () => {
		const hidden = { shown: false, needed: 408 };
		expect(nextNavLabelFit(NAV_LABELS_SHOWN, 0, 900)).toBe(NAV_LABELS_SHOWN);
		expect(nextNavLabelFit(NAV_LABELS_SHOWN, 342, null)).toBe(NAV_LABELS_SHOWN);
		expect(nextNavLabelFit(NAV_LABELS_SHOWN, 342, NaN)).toBe(NAV_LABELS_SHOWN);
		expect(nextNavLabelFit(hidden, NaN, null)).toBe(hidden);
		expect(nextNavLabelFit({ shown: false, needed: 0 }, 900, null)).toEqual({ shown: false, needed: 0 });
	});
});
