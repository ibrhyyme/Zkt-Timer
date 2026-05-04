/**
 * OLL/PLL case identification — frontend ve backend ll_states.ts birlestirilmis surumu.
 *
 * Mevcut iki implementasyon (client/util/solve/ll_states.ts ve server/util/solve/ll_states.ts)
 * neredeyse aynidir; bu dosya tek kaynak haline getirir.
 *
 * algorithms.ts client tarafinda kalir (buyuk static dataset); shared sadece import eder.
 *
 * OLL matching: top face'in U-color pattern'i 4 rotasyonda case mask'lari ile karsilastirilir.
 * PLL matching: top katman side stickers'lari (3 sticker x 4 yuz = 12 sticker) similarity test'i
 * ile karsilastirilir, encoded representation kullanilir.
 */

import { chunk } from 'lodash';
import algorithms from '../../../client/util/algorithms/algorithms';
import Cube from 'cubejs';

const OLL_KEY = '3_oll';
const PLL_KEY = '3_pll';

interface LLCase {
	options: string[];
	key: string;
	name: string;
}

const olls: LLCase[] = [];
const plls: LLCase[] = [];

function reverseTurnsOnCube(cube: any, turnsString: string) {
	const turns = turnsString.trim().split(/\s+/).filter(Boolean);
	for (let i = turns.length - 1; i >= 0; i--) {
		const t = turns[i];
		let inv: string;
		if (t.endsWith("'")) inv = t.slice(0, -1);
		else if (t.endsWith('2')) inv = t;
		else inv = t + "'";
		try {
			cube.move(inv);
		} catch {
			// Skip invalid moves silently.
		}
	}
}

function addCaseToOutput(mainKey: string, keys: string[], output: LLCase[]) {
	for (const key of keys) {
		const cubejs = new Cube();
		const llCase = (algorithms as any)[mainKey][key];
		const solution = llCase.noRotationSolution || llCase.defaultSolution;
		reverseTurnsOnCube(cubejs, solution);

		const options: string[] = [];
		for (let i = 0; i < 4; i++) {
			cubejs.move('U');
			options.push(cubejs.asString());
		}

		output.push({
			options,
			key,
			name: llCase.name,
		});
	}
}

let initialized = false;
function ensureInitialized() {
	if (initialized) return;
	const ollKeys = Object.keys((algorithms as any)[OLL_KEY] || {});
	const pllKeys = Object.keys((algorithms as any)[PLL_KEY] || {});
	addCaseToOutput(OLL_KEY, ollKeys, olls);
	addCaseToOutput(PLL_KEY, pllKeys, plls);
	initialized = true;
}

/**
 * Eager init — server app.ts startup'inda cagrilirsa cold-start gecikmesini onler.
 * Lazy init zaten icindeki ensureInitialized'da var, ama startup'ta bir kez tetiklemek
 * production'da daha temiz.
 */
export function initLLStates() {
	ensureInitialized();
}

function getMatchingState(state: string, cases: LLCase[]): LLCase | null {
	for (const c of cases) {
		for (const option of c.options) {
			const pattern = new RegExp(option.replace(/[^U]/g, '.'));
			if (pattern.test(state)) {
				return c;
			}
		}
	}
	return null;
}

function getTopRowLayerFromState(state: string): string {
	const parts = chunk(state.replace(/X/g, ''), 9);
	return parts.map((part) => part.slice(0, 3).join('')).join('');
}

function llSimilar(ll1: string, ll2: string): boolean {
	const sides = ['U', 'R', 'F', 'D', 'L', 'B'];
	let encodedL2 = ll2;
	for (let i = 0; i < sides.length; i++) {
		encodedL2 = encodedL2.replace(new RegExp(sides[i], 'g'), String(i));
	}
	for (let i = 0; i < ll1.length; i++) {
		const source = ll1[i];
		const target = encodedL2[i];
		encodedL2 = encodedL2.replace(new RegExp(target, 'g'), source);
	}
	return ll1 === encodedL2;
}

function getMatchingPllState(state: string, cases: LLCase[]): LLCase | null {
	for (const c of cases) {
		for (const option of c.options) {
			const pllState = option.replace(/[U|D]/g, 'X');
			const source = getTopRowLayerFromState(pllState);
			const target = getTopRowLayerFromState(state);
			if (llSimilar(source, target)) {
				return c;
			}
		}
	}
	return null;
}

export function getMatchingOLLState(state: string): { case: string; key: string } | null {
	ensureInitialized();
	const found = getMatchingState(state, olls);
	if (!found) return null;
	return { case: found.name, key: found.key };
}

export function getMatchingPLLState(state: string): { case: string; key: string } | null {
	ensureInitialized();
	const found = getMatchingPllState(state, plls);
	if (!found) return null;
	return { case: found.name, key: found.key };
}

const SIDE_INDEX: Record<string, number> = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };
const SIDE_OPPOSITES: Record<string, string> = { U: 'D', D: 'U', L: 'R', R: 'L', F: 'B', B: 'F' };
const EDGE_ADJ: Record<string, Record<string, number>> = {
	U: { R: 1, F: 1, L: 1, B: 1 },
	R: { U: 5, F: 5, B: 3, D: 5 },
	L: { U: 3, F: 3, D: 3, B: 5 },
	F: { U: 7, R: 3, D: 1, L: 5 },
	D: { R: 7, F: 7, L: 7, B: 7 },
	B: { U: 1, R: 5, D: 7, L: 3 },
};

/**
 * Verili cross face icin LL state'i U yuze cevir, OLL match icin normalize et.
 * (cross face != U ise opposite face'in renklerini U ile yer degistir.)
 */
export function buildOLLLookupState(crossFace: string, llState: string): string {
	const cube = Cube.fromString(llState);
	if (crossFace === 'U') cube.move('x2');
	else if (crossFace === 'R') cube.move('z');
	else if (crossFace === 'L') cube.move("z'");
	else if (crossFace === 'F') cube.move("x'");
	else if (crossFace === 'B') cube.move('x');
	let state = cube.asString();

	const opposite = SIDE_OPPOSITES[crossFace];
	if (opposite !== 'U') {
		state = state.replace(/U/g, 'X');
		state = state.replace(new RegExp(opposite, 'g'), 'U');
	}
	return state;
}

/**
 * Verili cross face icin LL state'i U yuze cevir, PLL normalization yap.
 * Backend solve_method.ts'deki tam normalizasyon mantiginin port'u.
 */
export function buildPLLLookupState(crossFace: string, llState: string): string {
	const cube = Cube.fromString(llState);
	if (crossFace === 'U') cube.move('x2');
	else if (crossFace === 'R') cube.move('z');
	else if (crossFace === 'L') cube.move("z'");
	else if (crossFace === 'F') cube.move("x'");
	else if (crossFace === 'B') cube.move('x');
	let state = cube.asString();

	const opposite = SIDE_OPPOSITES[crossFace];
	state = state.replace(new RegExp(crossFace, 'g'), 'X');
	state = state.replace(new RegExp(opposite, 'g'), 'X');

	const uSides = Object.keys(EDGE_ADJ['U']);
	const baseSides = Object.keys(EDGE_ADJ[opposite]);

	for (const [index, bs] of baseSides.entries()) {
		state = state.replace(new RegExp(bs, 'g'), String(index));
	}
	for (const [index, us] of uSides.entries()) {
		state = state.replace(new RegExp(String(index), 'g'), us);
	}

	return state;
}

export { SIDE_INDEX, SIDE_OPPOSITES, EDGE_ADJ };
