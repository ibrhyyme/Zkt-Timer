import { computeVirtualCubeSize } from '../useVirtualCubeSize';

describe('computeVirtualCubeSize', () => {
	it('keeps the desktop idle cube as it was beside the digits', () => {
		expect(computeVirtualCubeSize(400, 1024, 768, false, false)).toBe(184);
		expect(computeVirtualCubeSize(400, 1440, 900, false, false)).toBe(200);
	});

	it('gives a cube under the digits a smaller share of the height (768 px high screen)', () => {
		expect(computeVirtualCubeSize(400, 1024, 768, false, false, true)).toBe(153);
		expect(computeVirtualCubeSize(400, 1133, 744, false, false, true)).toBe(148);
	});

	it('leaves the armed cube and the phone alone', () => {
		expect(computeVirtualCubeSize(400, 1024, 768, false, true, true)).toBe(computeVirtualCubeSize(400, 1024, 768, false, true));
		expect(computeVirtualCubeSize(400, 390, 844, true, false, true)).toBe(computeVirtualCubeSize(400, 390, 844, true, false));
	});
});
