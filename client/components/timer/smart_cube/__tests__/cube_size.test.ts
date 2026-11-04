import {drawnCubeRange, drawnCubeSize, mobileCubeCap, storedCubeSize} from '../cube_size';

describe('smart cube size', () => {
	it('keeps the desktop cube the size it always was', () => {
		// The old zoom: 0.4 drew a stored 400 at 160 px.
		expect(drawnCubeSize(400, false, 1366, 768)).toBe(160);
		expect(drawnCubeSize(600, false, 1366, 768)).toBe(240);
	});

	it('caps the phone cube by the screen', () => {
		expect(mobileCubeCap(390, 844)).toBe(202);
		expect(drawnCubeSize(185, true, 390, 844)).toBe(185);
		expect(drawnCubeSize(600, true, 390, 844)).toBe(202);
	});

	it('gives the slider only sizes the screen can show', () => {
		expect(drawnCubeRange(true, 390, 844)).toEqual({min: 100, max: 202});
		expect(drawnCubeRange(false, 1366, 768)).toEqual({min: 40, max: 240});
		// A landscape phone's cap is under the stored minimum: the range does not invert.
		const landscape = drawnCubeRange(true, 844, 300);
		expect(landscape.min).toBeLessThanOrEqual(landscape.max);
	});

	it('stores what the slider picked in the setting\'s own units', () => {
		expect(storedCubeSize(160, false)).toBe(400);
		expect(storedCubeSize(190, true)).toBe(190);
		for (const drawn of [40, 101, 160, 239, 240]) {
			expect(drawnCubeSize(storedCubeSize(drawn, false), false, 1366, 768)).toBe(drawn);
		}
	});
});
