// Import sirasinda parser'larin urettigi (cube_type, scramble_subset) ciftini
// Zkt-Timer'in yeni mimarisine (cube-subset-bucket) uydurur.
//
// Kural: WCA standart event'leri her zaman cube_type='wca' bucket'ina duser.
// Eski variant ID'leri (333mirror, 333oh, 222oh, vs) parent + subset olarak ayrilir.
// Tanimadigimiz cube_type'lar (8puzzle, gear, ivy, vs) NULL doner — caller solve'u atlamali.

const VARIANT_MAP: Record<string, { cube_type: string; scramble_subset: string }> = {
	'333mirror': { cube_type: '333', scramble_subset: '333mirror' },
	'333oh': { cube_type: '333', scramble_subset: '333oh' },
	'333bld': { cube_type: '333', scramble_subset: '333ni' },
	'333bl': { cube_type: '333', scramble_subset: '333ni' },
	'333ni': { cube_type: '333', scramble_subset: '333ni' },
	'333fm': { cube_type: '333', scramble_subset: '333fm' },
	'333mbld': { cube_type: '333', scramble_subset: '333mbld' },
	'222oh': { cube_type: '222', scramble_subset: '222oh' },
	'444bl': { cube_type: '444', scramble_subset: '444bld' },
	'444bld': { cube_type: '444', scramble_subset: '444bld' },
	'555bl': { cube_type: '555', scramble_subset: '555bld' },
	'555bld': { cube_type: '555', scramble_subset: '555bld' },
};

const WCA_EVENTS = new Set([
	'333',
	'222',
	'444',
	'555',
	'666',
	'777',
	'sq1',
	'pyram',
	'pyraminx',
	'clock',
	'skewb',
	'minx',
	'megaminx',
]);

// pyraminx → pyram, megaminx → minx normalize
const WCA_ALIAS: Record<string, string> = {
	pyraminx: 'pyram',
	megaminx: 'minx',
};

export interface NormalizedBucket {
	cube_type: string;
	scramble_subset: string | null;
}

/**
 * @returns Normalized bucket veya `null` (parser'in solve'u atlamasi gerektigini bildirir).
 */
export function normalizeBucketForImport(parsedCubeType: string | null | undefined): NormalizedBucket | null {
	if (!parsedCubeType) return null;
	const ct = String(parsedCubeType).toLowerCase().trim();

	// 1) Eski variant ID'leri parent + subset'e ayir
	if (VARIANT_MAP[ct]) return VARIANT_MAP[ct];

	// 2) WCA standart event ID'leri → wca + subset
	if (WCA_EVENTS.has(ct)) {
		const subset = WCA_ALIAS[ct] ?? ct;
		return { cube_type: 'wca', scramble_subset: subset };
	}

	// 3) Modern Zkt-Timer cube_type'lari (zaten yeni mimaride) — as-is
	if (ct === 'wca') return null; // wca cube_type subset'i bilinmeden saglanamaz; caller atlasin
	const MODERN_CUBE_TYPES = new Set([
		'333cfop',
		'333roux',
		'333mehta',
		'333zz',
		'333sub',
		'444yau',
		'other',
	]);
	if (MODERN_CUBE_TYPES.has(ct)) {
		return { cube_type: ct, scramble_subset: null };
	}

	// 4) Tanimadigimiz cube_type → SKIP
	return null;
}
