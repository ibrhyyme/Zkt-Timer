// Import sirasinda parser'larin urettigi (cube_type, scramble_subset) ciftini
// Zkt-Timer'in yeni mimarisine (cube-subset-bucket) uydurur.
//
// Kural: WCA standart event'leri her zaman cube_type='wca' bucket'ina duser.
// Eski variant ID'leri (333mirror, 333oh, 222oh, vs) parent + subset olarak ayrilir.
// Tanimadigimiz cube_type'lar (8puzzle, gear, ivy, vs) NULL doner — caller solve'u atlamali.

export const VARIANT_MAP: Record<string, { cube_type: string; scramble_subset: string }> = {
	// 3x3 variantlari
	'333mirror': { cube_type: '333', scramble_subset: '333mirror' },
	'333oh': { cube_type: '333', scramble_subset: '333oh' },
	'333bld': { cube_type: '333', scramble_subset: '333ni' },
	'333bl': { cube_type: '333', scramble_subset: '333ni' },
	'333ni': { cube_type: '333', scramble_subset: '333ni' },
	'333fm': { cube_type: '333', scramble_subset: '333fm' },
	'333mbld': { cube_type: '333', scramble_subset: '333mbld' },
	'333o': { cube_type: '333', scramble_subset: '333o' },

	// 3x3 CFOP variantlari (csTimer'da bunlar 3x3 alt-subset'i)
	'pll': { cube_type: '333cfop', scramble_subset: 'pll' },
	'oll': { cube_type: '333cfop', scramble_subset: 'oll' },
	'll': { cube_type: '333cfop', scramble_subset: 'll' },
	'lsll': { cube_type: '333cfop', scramble_subset: 'lsll2' },
	'lsll2': { cube_type: '333cfop', scramble_subset: 'lsll2' },
	'zbll': { cube_type: '333cfop', scramble_subset: 'zbll' },
	'coll': { cube_type: '333cfop', scramble_subset: 'coll' },
	'cll': { cube_type: '333cfop', scramble_subset: 'cll' },
	'ell': { cube_type: '333cfop', scramble_subset: 'ell' },
	'2gll': { cube_type: '333cfop', scramble_subset: '2gll' },
	'zzll': { cube_type: '333cfop', scramble_subset: 'zzll' },
	'zbls': { cube_type: '333cfop', scramble_subset: 'zbls' },
	'eols': { cube_type: '333cfop', scramble_subset: 'eols' },
	'wvls': { cube_type: '333cfop', scramble_subset: 'wvls' },
	'vls': { cube_type: '333cfop', scramble_subset: 'vls' },
	'ttll': { cube_type: '333cfop', scramble_subset: 'ttll' },
	'f2l': { cube_type: '333cfop', scramble_subset: 'f2l' },
	'eoline': { cube_type: '333cfop', scramble_subset: 'eoline' },
	'eocross': { cube_type: '333cfop', scramble_subset: 'eocross' },

	// 3x3 Roux variantlari
	'roux': { cube_type: '333roux', scramble_subset: 'sbrx' },
	'sbrx': { cube_type: '333roux', scramble_subset: 'sbrx' },
	'cmll': { cube_type: '333roux', scramble_subset: 'cmll' },
	'cmll2': { cube_type: '333roux', scramble_subset: 'cmll' },
	'lse': { cube_type: '333roux', scramble_subset: 'lse' },
	'lsemu': { cube_type: '333roux', scramble_subset: 'lsemu' },

	// 3x3 ZZ variantlari (333zz cube type kaldirildi -> 333cfop'a tasindi)
	'eo': { cube_type: '333cfop', scramble_subset: 'eoline' },

	// 3x3 Mehta variantlari
	'mt3qb': { cube_type: '333mehta', scramble_subset: 'mt3qb' },
	'mteole': { cube_type: '333mehta', scramble_subset: 'mteole' },
	'mttdr': { cube_type: '333mehta', scramble_subset: 'mttdr' },
	'mt6cp': { cube_type: '333mehta', scramble_subset: 'mt6cp' },
	'mtcdrll': { cube_type: '333mehta', scramble_subset: 'mtcdrll' },
	'mtl5ep': { cube_type: '333mehta', scramble_subset: 'mtl5ep' },

	// 2x2 variantlari
	'222oh': { cube_type: '222', scramble_subset: '222oh' },
	'222o': { cube_type: '222', scramble_subset: '222o' },
	'222so': { cube_type: '222', scramble_subset: '222o' },
	'2223': { cube_type: '222', scramble_subset: '2223' },
	'222eg': { cube_type: '222', scramble_subset: '222eg' },
	'222eg0': { cube_type: '222', scramble_subset: '222eg0' },
	'222eg1': { cube_type: '222', scramble_subset: '222eg1' },
	'222eg2': { cube_type: '222', scramble_subset: '222eg2' },
	'222cll': { cube_type: '222', scramble_subset: '222eg0' }, // CLL = EG0
	'222tcll': { cube_type: '222', scramble_subset: '222tc' },
	'222tcp': { cube_type: '222', scramble_subset: '222tcp' },
	'222tcn': { cube_type: '222', scramble_subset: '222tcn' },
	'222tc': { cube_type: '222', scramble_subset: '222tc' },

	// 4x4 variantlari
	'444bl': { cube_type: '444', scramble_subset: '444bld' },
	'444bld': { cube_type: '444', scramble_subset: '444bld' },

	// 5x5 variantlari
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

	// Kaldirilan cube type'lar -> yeni hedeflerine remap (ölü cube_type'a düşmesin).
	// 333sub subset'leri '333' altina, 333zz ise '333cfop' altina tasindi.
	if (ct === '333sub') return { cube_type: '333', scramble_subset: null };
	if (ct === '333zz') return { cube_type: '333cfop', scramble_subset: null };

	// 3) Modern Zkt-Timer cube_type'lari (zaten yeni mimaride) — as-is
	if (ct === 'wca') return null; // wca cube_type subset'i bilinmeden saglanamaz; caller atlasin
	const MODERN_CUBE_TYPES = new Set([
		'333cfop',
		'333roux',
		'333mehta',
		'444yau',
		'other',
	]);
	if (MODERN_CUBE_TYPES.has(ct)) {
		return { cube_type: ct, scramble_subset: null };
	}

	// 4) Tanimadigimiz cube_type → SKIP
	return null;
}
