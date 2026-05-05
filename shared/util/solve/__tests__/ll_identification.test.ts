/**
 * OLL/PLL identification tests — saf cstimer port.
 *
 * Test stratejisi:
 *   1. Engine JSON varlik kontrolu (cubeRots, masks, patterns yuklendi mi)
 *   2. cubejs ile bilinen PLL/OLL setup state uretip identification denemesi
 *   3. Production'dan gelen gerçek user state ile dogrulama
 */

import { getMatchingOLLState, getMatchingPLLState } from '../ll_identification';
import engine from '../../../data/cstimer_ll_engine.json';

describe('LL identification — engine JSON', () => {
	it('cubeRots is 24x54', () => {
		expect(engine.cubeRots).toHaveLength(24);
		expect(engine.cubeRots[0]).toHaveLength(54);
	});

	it('PLL patterns: 22 entry (21 case + 1 skip)', () => {
		expect(engine.pllPatterns).toHaveLength(22);
	});

	it('OLL patterns: 58 entry (57 case + 1 skip)', () => {
		expect(engine.ollPatterns).toHaveLength(58);
	});

	it('PLL index -> key mapping non-null for cases', () => {
		// 21 cases should be mapped (V-perm = 333_pll_20 missing in algorithms.ts)
		const mapped = engine.pllIndexToKey.slice(0, 21).filter(Boolean);
		expect(mapped.length).toBeGreaterThanOrEqual(20);
	});
});

describe('LL identification — production scenario', () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const Cube = require('cubejs');

	function invertAlg(alg: string): string {
		return alg
			.trim()
			.split(/\s+/)
			.reverse()
			.map((m) => {
				if (m.endsWith("'")) return m.slice(0, -1);
				if (m.endsWith('2')) return m;
				return m + "'";
			})
			.join(' ');
	}

	function setupFacelet(alg: string, cubeOri?: string): string {
		const c = new Cube();
		if (cubeOri) c.move(cubeOri);
		c.move(invertAlg(alg));
		return c.asString();
	}

	it('T-perm setup -> identifies as T-perm', () => {
		const facelet = setupFacelet("R U R' U' R' F R2 U' R' U' R U R' F'");
		const result = getMatchingPLLState(facelet);
		expect(result).not.toBeNull();
		expect(result?.case).toBe('T');
	});

	it('U-perm a setup -> identifies', () => {
		const facelet = setupFacelet("R U' R U R U R U' R' U' R2");
		const result = getMatchingPLLState(facelet);
		expect(result).not.toBeNull();
		expect(result?.case).toMatch(/^U[ab]$/);
	});

	it('Sune OLL setup -> identifies', () => {
		const facelet = setupFacelet("R U R' U R U2 R'");
		const result = getMatchingOLLState(facelet);
		expect(result).not.toBeNull();
		expect(result?.key).toMatch(/^333_oll_/);
	});

	it('Cross orientation independence: T-perm with x2 -> still identifies as T', () => {
		const facelet = setupFacelet("R U R' U' R' F R2 U' R' U' R U R' F'", 'x2');
		const result = getMatchingPLLState(facelet);
		expect(result?.case).toBe('T');
	});

	it('Cross orientation independence: T-perm with z -> still identifies as T', () => {
		const facelet = setupFacelet("R U R' U' R' F R2 U' R' U' R U R' F'", 'z');
		const result = getMatchingPLLState(facelet);
		expect(result?.case).toBe('T');
	});
});

describe('LL identification — actual production user state', () => {
	it('U-cross PLL state from production logs identifies correctly', () => {
		// Bu state production log'undan alindi (ibrhyyme kullanicisi):
		// cross=U yapilmis, post-OLL state (PLL start). Eski kod MISS donuyordu, bu test fix'i kanitliyor.
		const userState = 'UUUUUUUUURRRRRRLLLFFFFFFBFBDDDDDDDDDLLLLLLRBRBBBBBBFRF';
		const result = getMatchingPLLState(userState);
		expect(result).not.toBeNull();
		expect(result?.key).toBe('333_pll_2'); // U-Perm (b)
	});
});

describe('LL identification — null cases', () => {
	it('empty input -> null', () => {
		expect(getMatchingOLLState('')).toBeNull();
		expect(getMatchingPLLState('')).toBeNull();
	});

	it('invalid length -> null', () => {
		expect(getMatchingOLLState('UUU')).toBeNull();
		expect(getMatchingPLLState('UUU')).toBeNull();
	});

	it('solved cube on PLL -> identifies skip case (idx 21) -> null returned', () => {
		const Cube = require('cubejs');
		const facelet = new Cube().asString();
		const result = getMatchingPLLState(facelet);
		// Solved cube = skip case at index 21 -> our API returns null for skip
		expect(result).toBeNull();
	});
});
