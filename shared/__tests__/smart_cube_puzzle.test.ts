import { isGan251Name, isMoyuMy22Name, smartCubePuzzleFromName } from '../smart_cube/puzzle';
import { bucketHasMethodSteps } from '../util/solve/solve_steps';

describe('smartCubePuzzleFromName', () => {
	// cstimer gancube.js is251: /^(GAN251Ui|GAN251UI|gan251ui|GANic251|ganic251)/i
	it.each(['GAN251Ui_AB12', 'GAN251UI', 'gan251ui-01', 'GANic251_X', 'ganic251'])('reads %p as the GAN 251 UI', (name) => {
		expect(isGan251Name(name)).toBe(true);
		expect(smartCubePuzzleFromName(name)).toBe('222');
	});

	it('reads the Weipo V5 AI as a 2x2', () => {
		expect(isMoyuMy22Name('WCU_MY22_1037')).toBe(true);
		expect(smartCubePuzzleFromName('WCU_MY22_1037')).toBe('222');
	});

	it.each(['GAN12uiFM', 'GAN356i', 'GANicXS_1234', 'WCU_MY32_A388', 'WCU_MY33_AF9E', 'QY-QYSC-S-1234', '', null, undefined])(
		'keeps %p a 3x3',
		(name) => {
			expect(smartCubePuzzleFromName(name)).toBe('333');
		}
	);
});

describe('bucketHasMethodSteps', () => {
	it('breaks down 3x3 buckets', () => {
		for (const [type, subset] of [['333', null], ['333cfop', 'pll'], ['333roux', null], ['wca', '333'], ['wca', '333oh']] as const) {
			expect(bucketHasMethodSteps(type, subset)).toBe(true);
		}
	});

	it('leaves 2x2 and other sizes without a breakdown', () => {
		expect(bucketHasMethodSteps('222', null)).toBe(false);
		expect(bucketHasMethodSteps('wca', '222')).toBe(false);
		expect(bucketHasMethodSteps('444', null)).toBe(false);
	});

	// Nothing that was broken down before may stop being broken down.
	it('keeps the old behaviour for anything it cannot place', () => {
		expect(bucketHasMethodSteps(null)).toBe(true);
		expect(bucketHasMethodSteps('wca', null)).toBe(true);
		expect(bucketHasMethodSteps('333sub', null)).toBe(true);
		expect(bucketHasMethodSteps('333zz', null)).toBe(true);
	});

	it('covers every bucket a 3x3 smart cube has ever been allowed on', () => {
		for (const [type, subset] of [['333', '333oh'], ['333mehta', null], ['333cfop', 'oll'], ['wca', '333']] as const) {
			expect(bucketHasMethodSteps(type, subset)).toBe(true);
		}
	});
});
