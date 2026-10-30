import { referenceDigitsWidth, smartCubeWidths, timeRowFit } from '../time_row_fit';

// Widths measured in Chrome at the default timer size (90 px digits): the smart cube is
// 160 px with a 96 px connect column beside it and a 0.75rem gap, the row gap is 2rem.
const cube = smartCubeWidths(160, 10.5, 96);
const SMART = {
	digits: referenceDigitsWidth(90),
	gap: 28,
	companion: cube.line,
	companionStacked: cube.stacked,
	companionFolded: cube.folded,
};

describe('smartCubeWidths', () => {
	it('puts the connect column beside the cube, beside the smaller cube, or under it', () => {
		expect(cube.line).toBeCloseTo(266.5);
		expect(cube.stacked).toBeCloseTo(226.5);
		expect(cube.folded).toBe(120);
	});

	it('is as wide as the connect column when the cube is hidden', () => {
		expect(smartCubeWidths(0, 10.5, 96)).toEqual({ line: 96, stacked: 96, folded: 96 });
	});
});

describe('timeRowFit', () => {
	it('sizes the digits for a time past ten seconds', () => {
		expect(referenceDigitsWidth(90)).toBe(270);
	});

	it('keeps the row when the pair fits (1366 px)', () => {
		expect(timeRowFit({ ...SMART, available: 610 })).toEqual({ stacked: false, folded: false });
	});

	it('folds the smart cube first (a 1180 px tablet between two rails)', () => {
		expect(timeRowFit({ ...SMART, available: 433 })).toEqual({ stacked: false, folded: true });
	});

	it('moves the companion under the digits when folding is not enough (1024 px)', () => {
		expect(timeRowFit({ ...SMART, available: 285 })).toEqual({ stacked: true, folded: false });
	});

	it('folds a stacked smart cube only when even its smaller line is too wide', () => {
		expect(timeRowFit({ ...SMART, available: 240 })).toEqual({ stacked: true, folded: false });
		expect(timeRowFit({ ...SMART, available: 220 })).toEqual({ stacked: true, folded: true });
	});

	it('stacks a companion that cannot fold (virtual cube)', () => {
		const virtual = { digits: 270, gap: 28, companion: 184 };
		expect(timeRowFit({ ...virtual, available: 610 })).toEqual({ stacked: false, folded: false });
		expect(timeRowFit({ ...virtual, available: 433 })).toEqual({ stacked: true, folded: false });
	});

	it('leaves the row alone without a companion or a measurement', () => {
		expect(timeRowFit({ digits: 270, gap: 28, companion: 0, available: 100 })).toEqual({ stacked: false, folded: false });
		expect(timeRowFit({ ...SMART, available: 0 })).toEqual({ stacked: false, folded: false });
		expect(timeRowFit({ ...SMART, available: NaN })).toEqual({ stacked: false, folded: false });
	});

	it('ignores a folded width that is not narrower', () => {
		expect(timeRowFit({ digits: 270, gap: 28, companion: 200, companionFolded: 200, available: 400 })).toEqual({
			stacked: true,
			folded: false,
		});
	});
});
