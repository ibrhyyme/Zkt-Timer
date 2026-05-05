/**
 * cstimer'in cubeRots (24x54) + mask'larini + LLPattern template'ini Node'da uretip
 * JSON'a dump eder. Bu cubie-level matematik mathlib.CubieCube'a baglidir; runtime'a
 * tasimak istemiyoruz, build-time bir kez ureteyim.
 *
 * Kullanim: node scripts/dump-cstimer-rotations.mjs
 * Cikti: shared/data/cstimer_ll_engine.json
 */

import { readFileSync, writeFileSync } from 'fs';
import vm from 'vm';

const isaacSrc = readFileSync('Referans/cstimer-master/src/js/lib/isaac.js', 'utf8');
const mathlibSrc = readFileSync('Referans/cstimer-master/src/js/lib/mathlib.js', 'utf8');
const cubeutilSrc = readFileSync('Referans/cstimer-master/src/js/lib/cubeutil.js', 'utf8');
const scrambleEditSrc = readFileSync('Referans/cstimer-master/src/js/scramble/scramble_333_edit.js', 'utf8');

// algorithms.ts'i block-bazli parse et — her case bir block, key ve defaultSolution
// regex *? non-greedy bazı case'leri kaçırıyordu (333_pll_20 gibi). Block-split daha güvenli.
const algSrcGlobal = readFileSync('client/util/algorithms/algorithms.ts', 'utf8');
const keyAlgsAll = (() => {
	const out = {};
	const blocks = algSrcGlobal.split(/(?=key:\s*'333_(?:oll|pll)_\d+')/);
	for (const block of blocks) {
		const keyMatch = block.match(/key:\s*'(333_(?:oll|pll)_\d+)'/);
		// defaultSolution hem "..." hem '...' format'inda olabilir (linter formatter'a gore)
		const algMatch = block.match(/defaultSolution:\s*(['"])((?:(?!\1).)*)\1/);
		const nameMatch = block.match(/name:\s*['"]([^'"]+)['"]/);
		if (keyMatch && algMatch) {
			// algMatch[1] = quote char, algMatch[2] = solution string
			out[keyMatch[1]] = { alg: algMatch[2], name: (nameMatch && nameMatch[1]) || keyMatch[1] };
		}
	}
	return out;
})();
console.log('algorithms.ts toplam:', Object.keys(keyAlgsAll).length, 'case (PLL:', Object.keys(keyAlgsAll).filter(k => k.includes('pll')).length, 'OLL:', Object.keys(keyAlgsAll).filter(k => k.includes('oll')).length, ')');

// scramble_333_edit.js'ten pllImgParam, oll_map ve pll_map'i parse et
const pllImgParamMatch = scrambleEditSrc.match(/var pllImgParam = (\[[\s\S]*?\]);/);
const ollMapMatch = scrambleEditSrc.match(/var oll_map = (\[[\s\S]*?\]);/);
const pllMapMatch = scrambleEditSrc.match(/var pll_map = (\[[\s\S]*?\]);/);
if (!pllImgParamMatch || !ollMapMatch || !pllMapMatch) {
	console.error('pllImgParam / oll_map / pll_map parse edilemedi');
	process.exit(1);
}
const pllImgParam = eval(pllImgParamMatch[1]);
const oll_map = eval(ollMapMatch[1]);
const pll_map = eval(pllMapMatch[1]);
console.log('pllImgParam:', pllImgParam.length, 'entry');
console.log('oll_map:', oll_map.length, 'entry');
console.log('pll_map:', pll_map.length, 'entry');

// cstimer PLL index -> bizim algorithms.ts key (manuel mapping, name'lerden cikartildi)
const PLL_NAME_TO_KEY = {
	'H': '333_pll_3', 'Ua': '333_pll_1', 'Ub': '333_pll_2', 'Z': '333_pll_4',
	'Aa': '333_pll_5', 'Ab': '333_pll_6', 'E': '333_pll_7', 'F': '333_pll_8',
	'Ga': '333_pll_9', 'Gb': '333_pll_10', 'Gc': '333_pll_11', 'Gd': '333_pll_12',
	'Ja': '333_pll_15', 'Jb': '333_pll_16', 'Na': '333_pll_17', 'Nb': '333_pll_18',
	'Ra': '333_pll_13', 'Rb': '333_pll_14', 'T': '333_pll_19', 'Y': '333_pll_21',
	'V': '333_pll_20',
};
// cstimer index 0-20: pll_map sirasiyla, 21 = identity (skip)
const pllIndexToKey = pll_map.map((row) => PLL_NAME_TO_KEY[row[3]] || null);
pllIndexToKey.push(null); // index 21 = skip case

// cstimer OLL index 0 = 'PLL' (skip = OLL solved). Index 1-57 = OLL case'ler.
// oll_map[i][3] = '<type>-<n>' formatinda (orn 'Awkward-29'), n parse edip 333_oll_<n>.
const ollIndexToKey = oll_map.map((row) => {
	const name = row[3];
	if (name === 'PLL') return null; // skip
	const m = /-(\d+)$/.exec(name);
	if (!m) return null;
	return '333_oll_' + m[1];
});

// cubeutil.js scramble_333.getPLLImage / getOLLImage cagriyor (identPLL/identOLL icinde).
// Sadece cubeRots + maskler + LLPattern yeter — pattern uretimi ayri (algorithms.ts'imizden).
// O yuzden cubeutil.js'in identStep ve scramble_333 bagimliliklarini stub'la.

// IIFE'in son return'unu (public API) bul ve internal'lari ekle.
// Ayrica identPLL/identOLL'u tetiklemek icin warm-up cagrilar ekle (lazy pattern[] init).
const patchedCubeutilSrc = cubeutilSrc.replace(
	"return {\n\t\tgetProgress: getProgress,",
	`identPLL(mathlib.SOLVED_FACELET);
	identOLL(mathlib.SOLVED_FACELET);
	return {
		__cubeRots: cubeRots,
		__masks: { ollMask, f2lMask, eollMask, crossMask, solvedMask },
		__LLPattern: LLPattern,
		__solvedProgress: solvedProgress,
		__searchCaseByPattern: searchCaseByPattern,
		__toEqus: toEqus,
		__identPLL: identPLL,
		__identOLL: identOLL,
		getProgress: getProgress,`
);
if (!patchedCubeutilSrc.includes('__cubeRots')) {
	console.error('PATCH FAILED — return signature degismis olabilir');
	process.exit(1);
}

// Pattern array'lerini IIFE icindeki private degiskenler. Warm-up sonrasi 'pllPattern'
// ve 'ollPattern' degiskenleri populated. Onlari da export edelim — patch ile.
const patchedCubeutilSrc2 = patchedCubeutilSrc.replace(
	"\t\t__identPLL: identPLL,",
	`\t\t__identPLL: identPLL,
		__pllPatterns: (function() {
			var arr = [];
			for (var i = 0; i < 22; i++) {
				var param = i == 21 ? 'UUUUUUUUUFFFRRRBBBLLL' : scramble_333.getPLLImage(i)[0];
				arr.push(toEqus(LLPattern.replace(/[0-9a-z]/g, function(v) {
					return param[parseInt(v, 36)].toLowerCase();
				})));
			}
			return arr;
		})(),
		__ollPatterns: (function() {
			var arr = [];
			for (var i = 0; i < 58; i++) {
				var param = scramble_333.getOLLImage(i)[0].replace(/G/g, '-');
				arr.push(toEqus(LLPattern.replace(/[0-9a-z]/g, function(v) {
					return param[parseInt(v, 36)].toLowerCase();
				})));
			}
			return arr;
		})(),`
);

// Gerçek cstimer getPLLImage / getOLLImage mantigi
function getPLLImage(i) {
	return ['DDDDDDDDD' + pllImgParam[i][0]];
}
function getOLLImage(i) {
	let face = '';
	let val = oll_map[i][4];
	for (let j = 0; j < 21; j++) {
		if (j == 4) face += 'D';
		else { face += (val & 1) ? 'D' : 'G'; val >>= 1; }
	}
	return [face];
}

const ctx2 = {
	console,
	DEBUG: false,
	mathlib: undefined,
	cubeutil: undefined,
	scramble_333: {
		getPLLImage,
		getOLLImage,
		getCOLLImage: () => ['UUUUUUUUUFFFRRRBBBLLL'],
		getZBLLImage: () => ['UUUUUUUUUFFFRRRBBBLLL'],
		getEGLLImage: () => ['UUUUUUUUUFFFRRRBBBLLL'],
	},
	scramble_222: {
		getEGLLImage: () => ['UUUUUUUUUFFFRRRBBBLLL'],
	},
	kernel: { getProp: () => '' },
	tools: { isCurTrainScramble: () => false },
	$: { map: () => [] },
};
vm.createContext(ctx2);
vm.runInContext(isaacSrc, ctx2);
vm.runInContext(mathlibSrc, ctx2);
vm.runInContext(patchedCubeutilSrc2, ctx2);

const cu2 = ctx2.cubeutil;
console.log('cubeRots length:', cu2.__cubeRots.length, 'x', cu2.__cubeRots[0].length);
console.log('LLPattern:', cu2.__LLPattern);
console.log('PLL patterns:', cu2.__pllPatterns.length);
console.log('OLL patterns:', cu2.__ollPatterns.length);
console.log('ollMask first 3:', JSON.stringify(cu2.__masks.ollMask.slice(0, 3)));

const output = {
	_meta: {
		generated_at: new Date().toISOString(),
		source: 'cstimer cubeutil.js + scramble_333_edit.js',
	},
	cubeRots: cu2.__cubeRots.map((r) => Array.from(r)),
	masks: {
		ollMask: cu2.__masks.ollMask,
		f2lMask: cu2.__masks.f2lMask,
		eollMask: cu2.__masks.eollMask,
		solvedMask: cu2.__masks.solvedMask,
	},
	LLPattern: cu2.__LLPattern,
	pllPatterns: cu2.__pllPatterns,
	ollPatterns: cu2.__ollPatterns,
	pllIndexToKey,
	ollIndexToKey,
	pllCaseNames: pll_map.map((row) => row[3]),
	ollCaseNames: oll_map.map((row) => row[3]),
};

writeFileSync('shared/data/cstimer_ll_engine.json', JSON.stringify(output));
console.log('Yazildi: shared/data/cstimer_ll_engine.json');
console.log('Boyut:', (readFileSync('shared/data/cstimer_ll_engine.json').length / 1024).toFixed(1), 'KB');
