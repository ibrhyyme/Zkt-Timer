import { getCubeTypeInfoById, getScrambleTypeById } from '../../../util/cubes/util';
import { ITimerContext } from '../Timer';
import { setTimerParams } from './params';
import { getSubsetsForCube } from '../../../util/cubes/scramble_subsets';
import { generateScramble, hasGenerator } from '../../../../shared/scramble/registry';
import { isAsyncScrambleType } from '../../../../shared/scramble/types';
import { generateScrambleAsync, initScrambleWorker } from '../../../util/scramble-worker-manager';
import { applyTopColorTransform, isTopColorAvailable, isTopColorFace, TopColorFace } from '../../../util/scramble_transform';

// Register generators — side-effect import
// Only light generators enter main bundle
import '../../../../shared/scramble/generators/scramble-pyraminx';
import '../../../../shared/scramble/generators/scramble-skewb';
import '../../../../shared/scramble/generators/scramble-333lse';
import '../../../../shared/scramble/generators/megascramble';
import '../../../../shared/scramble/generators/utilscramble';
// Heavy generators (min2phase, 444, megaminx, sq1) — lazily loaded
import '../../../../shared/scramble/generators/scramble-333';
import '../../../../shared/scramble/generators/scramble-444';
import '../../../../shared/scramble/generators/scramble-sq1';
import '../../../../shared/scramble/generators/scramble-megaminx';

// 2x2 generator — registered in shared registry
import '../../../../shared/scramble/generators/scramble-222';
// Clock — existing custom generator
import { generateClockScramble } from '../../../util/cubes/scramble_clock';

// Cube type ID -> cstimer scramble type ID mapping (WCA + variants only)
const CUBE_TO_SCRAMBLE_TYPE: Record<string, string> = {
	'wca': '333',        // WCA category — default to 3x3
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

// Fallback mapping for WCA subset IDs that aren't separate cube types
// (333oh, 333mbld: no dedicated generator — use normal 3x3 scramble)
const WCA_EVENT_TO_GEN: Record<string, string> = {
	'333oh': '333',
	'333mbld': '333',
};

// Scramble cleanup: preserve lines, normalize spacing within lines
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

	// WCA category: subset is actually a cube type ID — resolve it as cube type
	if (baseType === 'wca' && effectiveSubset) {
		const result = getNewScramble(effectiveSubset);
		if (result) return result;
		if (hasGenerator(effectiveSubset)) return cleanScramble(generateScramble(effectiveSubset));
		const fallbackGen = WCA_EVENT_TO_GEN[effectiveSubset];
		if (fallbackGen && hasGenerator(fallbackGen)) return cleanScramble(generateScramble(fallbackGen));
		return '';
	}

	// Clock — current port (to be moved to shared in Phase 5)
	if (baseType === 'clock' && !effectiveSubset) {
		return generateClockScramble();
	}

	try {
		// New system: if subset exists and is registered, use it
		if (effectiveSubset && hasGenerator(effectiveSubset)) {
			const scramble = generateScramble(effectiveSubset);
			return cleanScramble(scramble);
		}

		// New system: cube type mapping
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

// Initialize scramble worker (SSR guard)
if (typeof window !== 'undefined') {
	initScrambleWorker();
}

// ==================== Scramble Cache (cstimer logic) ====================
// Each time scramble is generated, pre-generate next one in background.
// Return immediately from cache when user requests, generate new one.
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
		const asCubeType = resolveGenType(effectiveSubset);
		if (asCubeType) return asCubeType;
		if (hasGenerator(effectiveSubset)) return effectiveSubset;
		return WCA_EVENT_TO_GEN[effectiveSubset] || null;
	}
	if (baseType === 'clock' && !effectiveSubset) return 'clock';

	return (effectiveSubset && hasGenerator(effectiveSubset))
		? effectiveSubset
		: CUBE_TO_SCRAMBLE_TYPE[baseType] || null;
}

// Generate and cache next scramble in background
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

// Async scramble generation — return immediately from cache if available, otherwise generate + pre-cache next
export async function getNewScrambleAsync(scrambleTypeId: string, subset?: string): Promise<string> {
	const key = getCacheKey(scrambleTypeId, subset);

	// If in cache, return immediately
	const cached = _scrambleCache.get(key);
	if (cached) {
		_scrambleCache.delete(key);
		// Pre-generate next in background
		warmCache(scrambleTypeId, subset);
		return cached;
	}

	// Not in cache — generate
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

	// Pre-generate next in background
	warmCache(scrambleTypeId, subset);
	return scramble;
}

// Pre-generate: generate next scramble in background during solve
let _preGeneratedScramble: string | null = null;
let _preGeneratedForType: string | null = null;
let _preGeneratedForSubset: string | null = null;
let _preGeneratedForTopColor: TopColorFace | null = null;

export function preGenerateScramble(cubeType: string, subset?: string, topColor?: string | null) {
	const ct = getCubeTypeInfoById(cubeType);
	if (!ct) return;

	const effectiveTopColor: TopColorFace | null =
		isTopColorAvailable(cubeType, subset) && isTopColorFace(topColor)
			? topColor
			: null;

	_preGeneratedScramble = null;
	_preGeneratedForType = cubeType;
	_preGeneratedForSubset = subset ?? null;
	_preGeneratedForTopColor = effectiveTopColor;

	// Async: generate in background via worker + apply transform
	getNewScrambleAsync(ct.scramble, subset).then(async (rawScramble) => {
		if (_preGeneratedForType !== cubeType || _preGeneratedForSubset !== (subset ?? null) || _preGeneratedForTopColor !== effectiveTopColor) return;
		const scramble = await applyTopColorTransform(rawScramble, effectiveTopColor);
		if (_preGeneratedForType !== cubeType || _preGeneratedForSubset !== (subset ?? null) || _preGeneratedForTopColor !== effectiveTopColor) return;
		_preGeneratedScramble = scramble;
	});
}

/**
 * Consume pre-generated scramble. Returns null on cubeType + subset + topColor mismatch
 * (generates fresh scramble, doesn't serve old cached wrong-colored scramble).
 */
export function consumePreGeneratedScramble(cubeType: string, subset?: string, topColor?: string | null): string | null {
	const effectiveTopColor: TopColorFace | null =
		isTopColorAvailable(cubeType, subset) && isTopColorFace(topColor)
			? topColor
			: null;

	if (
		_preGeneratedScramble &&
		_preGeneratedForType === cubeType &&
		_preGeneratedForSubset === (subset ?? null) &&
		_preGeneratedForTopColor === effectiveTopColor
	) {
		const scramble = _preGeneratedScramble;
		_preGeneratedScramble = null;
		_preGeneratedForType = null;
		_preGeneratedForSubset = null;
		_preGeneratedForTopColor = null;
		return scramble;
	}
	return null;
}

export function resetScramble(context: ITimerContext) {
	const { cubeType, scrambleLocked, customScrambleFunc, scrambleSubset, scrambleTopColor } = context;
	const ct = getCubeTypeInfoById(cubeType);
	if (!ct) return;

	if (customScrambleFunc) {
		const newScramble = customScrambleFunc(context);
		setTimerParams({ scramble: newScramble, originalScramble: newScramble, smartTurnOffset: 0 });
		return;
	}

	if (scrambleLocked) return;

	// Top color transform only active for 3x3 CFOP + PLL/OLL/f2l subsets.
	// In other cases, topColor is null → applyTopColorTransform returns raw scramble.
	const effectiveTopColor: TopColorFace | null =
		isTopColorAvailable(cubeType, scrambleSubset) && isTopColorFace(scrambleTopColor)
			? scrambleTopColor
			: null;

	getNewScrambleAsync(ct.scramble, scrambleSubset).then(async (rawScramble) => {
		const newScramble = await applyTopColorTransform(rawScramble, effectiveTopColor);
		setTimerParams({ scramble: newScramble, originalScramble: newScramble, smartTurnOffset: 0 });
	}).catch((e) => { console.error('[scramble] resetScramble failed:', e); });
}
