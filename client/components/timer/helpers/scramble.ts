import { getCubeTypeInfoById, getScrambleTypeById } from '../../../util/cubes/util';
import { ITimerContext } from '../Timer';
import { setTimerParams } from './params';
import { getSubsetsForCube } from '../../../util/cubes/scramble_subsets';
import { generateScramble, hasGenerator } from '../../../../shared/scramble/registry';
import { isAsyncScrambleType } from '../../../../shared/scramble/types';
import { generateScrambleAsync, initScrambleWorker } from '../../../util/scramble-worker-manager';

// Generator'lari kaydet — side-effect import
// Sadece hafif generator'lar main bundle'a girer
import '../../../../shared/scramble/generators/scramble-pyraminx';
import '../../../../shared/scramble/generators/scramble-skewb';
import '../../../../shared/scramble/generators/scramble-333lse';
import '../../../../shared/scramble/generators/megascramble';
import '../../../../shared/scramble/generators/utilscramble';
// Agir generator'lar (min2phase, 444, megaminx, sq1) — lazily loaded
import '../../../../shared/scramble/generators/scramble-333';
import '../../../../shared/scramble/generators/scramble-444';
import '../../../../shared/scramble/generators/scramble-sq1';
import '../../../../shared/scramble/generators/scramble-megaminx';

// 2x2 generator — shared registry'ye kayitli
import '../../../../shared/scramble/generators/scramble-222';
// Clock — mevcut custom generator
import { generateClockScramble } from '../../../util/cubes/scramble_clock';

// Cube type ID -> cstimer scramble type ID mapping (sadece WCA + variants)
const CUBE_TO_SCRAMBLE_TYPE: Record<string, string> = {
	'wca': '333',        // WCA kategori — default 3x3
	'222': '222so',      // 2x2 random-state
	'333': '333',        // 3x3 random-state (min2phase Kociemba)
	'444': '444m',       // 4x4 random-move
	'555': '555wca',     // 5x5 random-move
	'666': '666wca',     // 6x6 random-move
	'777': '777wca',     // 7x7 random-move
	'pyram': 'pyrso',    // Pyraminx random-state
	'skewb': 'skbso',    // Skewb random-state
	'sq1': 'sqrs',       // Square-1 random-state
	'clock': 'clock',    // Clock
	'minx': 'mgmp',      // Megaminx WCA (Pochmann)
	// Method-based cube types — same 3x3 scramble, different default subsets
	'333cfop': '333',
	'333roux': '333',
	'333mehta': '333',
	'333zz': '333',
	'444yau': '444m',
	// Special
	'333sub': '2gen',       // default to 2-gen
};

// Scramble temizleme: satirlari koru, satir ici bosluklari normalize et
function cleanScramble(s: string): string {
	return s.split('\n').map(line => line.replace(/ {2,}/g, ' ').trim()).filter(Boolean).join('\n');
}

export function getNewScramble(scrambleTypeId: string, _seed?: number, subset?: string) {
	const scrambleType = getScrambleTypeById(scrambleTypeId);

	if (!scrambleType || scrambleType.id === 'none') {
		return '';
	}

	let baseType = scrambleType.id;

	// Subset validation
	let effectiveSubset = '';
	if (subset && !subset.startsWith('h_')) {
		const allowedSubsets = getSubsetsForCube(baseType === '333bl' ? '333' : baseType);
		const isValid = allowedSubsets.some(s => s.id === subset);
		if (isValid) {
			effectiveSubset = subset;
		} else {
			console.warn(`Invalid subset '${subset}' for cube type '${baseType}', falling back to default.`);
		}
	}

	// WCA kategori: subset aslinda bir cube type ID — onu cube type olarak coz
	if (baseType === 'wca' && effectiveSubset) {
		return getNewScramble(effectiveSubset);
	}

	// Clock — mevcut port (Faz 5'te shared'e tasinacak)
	if (baseType === 'clock' && !effectiveSubset) {
		return generateClockScramble();
	}

	try {
		// Yeni sistem: subset varsa ve registry'de kayitliysa onu kullan
		if (effectiveSubset && hasGenerator(effectiveSubset)) {
			const scramble = generateScramble(effectiveSubset);
			return cleanScramble(scramble);
		}

		// Yeni sistem: cube type mapping
		const scrambleTypeForGen = CUBE_TO_SCRAMBLE_TYPE[baseType];
		if (scrambleTypeForGen && hasGenerator(scrambleTypeForGen)) {
			const scramble = generateScramble(scrambleTypeForGen);
			return cleanScramble(scramble);
		}
	} catch (e) {
		console.error(`[scramble] Generator error for ${baseType}/${effectiveSubset}:`, e);
		return '';
	}

	// Fallback
	console.warn(`[scramble] No generator for type: ${baseType}, subset: ${effectiveSubset}`);
	return '';
}

// Worker baslat (SSR guard)
if (typeof window !== 'undefined') {
	initScrambleWorker();
}

// ==================== Scramble Cache (cstimer mantigi) ====================
// Her scramble uretildiginde bir sonrakini arka planda hazirla.
// Kullanici istediginde cache'den aninda don, yenisini uret.
const _scrambleCache = new Map<string, string>();
let _cacheGenerating = new Set<string>();

function getCacheKey(scrambleTypeId: string, subset?: string): string {
	return subset ? `${scrambleTypeId}:${subset}` : scrambleTypeId;
}

function resolveGenType(scrambleTypeId: string, subset?: string): string | null {
	const scrambleType = getScrambleTypeById(scrambleTypeId);
	if (!scrambleType || scrambleType.id === 'none') return null;

	let baseType = scrambleType.id;
	let effectiveSubset = '';
	if (subset && !subset.startsWith('h_')) {
		const allowedSubsets = getSubsetsForCube(baseType === '333bl' ? '333' : baseType);
		if (allowedSubsets.some(s => s.id === subset)) effectiveSubset = subset;
	}

	if (baseType === 'wca' && effectiveSubset) {
		return resolveGenType(effectiveSubset);
	}
	if (baseType === 'clock' && !effectiveSubset) return 'clock';

	return (effectiveSubset && hasGenerator(effectiveSubset))
		? effectiveSubset
		: CUBE_TO_SCRAMBLE_TYPE[baseType] || null;
}

// Arka planda bir sonraki scramble'i uret ve cache'le
function warmCache(scrambleTypeId: string, subset?: string) {
	const key = getCacheKey(scrambleTypeId, subset);
	if (_scrambleCache.has(key) || _cacheGenerating.has(key)) return;

	const genType = resolveGenType(scrambleTypeId, subset);
	if (!genType) return;

	_cacheGenerating.add(key);

	if (genType === 'clock') {
		_scrambleCache.set(key, generateClockScramble());
		_cacheGenerating.delete(key);
		return;
	}

	if (isAsyncScrambleType(genType) && generateScrambleAsync) {
		generateScrambleAsync(genType).then(s => {
			_scrambleCache.set(key, cleanScramble(s));
			_cacheGenerating.delete(key);
		}).catch(() => _cacheGenerating.delete(key));
	} else if (hasGenerator(genType)) {
		_scrambleCache.set(key, cleanScramble(generateScramble(genType)));
		_cacheGenerating.delete(key);
	}
}

// Async scramble uretim — cache varsa aninda don, yoksa uret + sonrakini cache'le
export async function getNewScrambleAsync(scrambleTypeId: string, subset?: string): Promise<string> {
	const key = getCacheKey(scrambleTypeId, subset);

	// Cache'de varsa aninda don
	const cached = _scrambleCache.get(key);
	if (cached) {
		_scrambleCache.delete(key);
		// Bir sonrakini arka planda hazirla
		warmCache(scrambleTypeId, subset);
		return cached;
	}

	// Cache'de yok — uret
	const genType = resolveGenType(scrambleTypeId, subset);
	if (!genType) return '';

	let scramble: string;
	try {
		if (genType === 'clock') {
			scramble = generateClockScramble();
		} else if (isAsyncScrambleType(genType) && generateScrambleAsync) {
			scramble = await generateScrambleAsync(genType);
			scramble = cleanScramble(scramble);
		} else if (hasGenerator(genType)) {
			scramble = cleanScramble(generateScramble(genType));
		} else {
			scramble = getNewScramble(scrambleTypeId, undefined, subset);
		}
	} catch {
		scramble = getNewScramble(scrambleTypeId, undefined, subset);
	}

	// Bir sonrakini arka planda hazirla
	warmCache(scrambleTypeId, subset);
	return scramble;
}

// Pre-generate: solve sirasinda yeni karistirmayi arka planda hazirla
let _preGeneratedScramble: string | null = null;
let _preGeneratedForType: string | null = null;

export function preGenerateScramble(cubeType: string, subset?: string) {
	const ct = getCubeTypeInfoById(cubeType);
	if (!ct) return;

	_preGeneratedScramble = null;
	_preGeneratedForType = cubeType;

	// Async: worker uzerinden arka planda uret
	getNewScrambleAsync(ct.scramble, subset).then((scramble) => {
		if (_preGeneratedForType !== cubeType) return;
		_preGeneratedScramble = scramble;
	});
}

export function consumePreGeneratedScramble(cubeType: string): string | null {
	if (_preGeneratedScramble && _preGeneratedForType === cubeType) {
		const scramble = _preGeneratedScramble;
		_preGeneratedScramble = null;
		_preGeneratedForType = null;
		return scramble;
	}
	return null;
}

export function resetScramble(context: ITimerContext) {
	const { cubeType, scrambleLocked, customScrambleFunc, scrambleSubset } = context;
	const ct = getCubeTypeInfoById(cubeType);
	if (!ct) return;

	if (customScrambleFunc) {
		const newScramble = customScrambleFunc(context);
		setTimerParams({ scramble: newScramble, originalScramble: newScramble, smartTurnOffset: 0 });
		return;
	}

	if (scrambleLocked) return;

	getNewScrambleAsync(ct.scramble, scrambleSubset).then((newScramble) => {
		setTimerParams({ scramble: newScramble, originalScramble: newScramble, smartTurnOffset: 0 });
	}).catch((e) => { console.error('[scramble] resetScramble failed:', e); });
}
