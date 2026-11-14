import { VARIANT_MAP } from '../parse_data/normalize-bucket';
import { ScrambleSubset, getSubsetsForCube } from '../../../../../util/cubes/scramble_subsets';

// Import only registers WCA events (cube_type='wca' + this subset).
// Method-based cube_type's (333cfop/roux/mehta/zz, 444yau, other, wca parent) are not shown.
export const WCA_IMPORT_EVENTS = ['333', '222', '444', '555', '666', '777', 'sq1', 'pyram', 'clock', 'skewb', 'minx'];

// Method-based cube_type's (333cfop/333roux/etc.) reduced to parent WCA event.
function getParentWcaEvent(input: string): string {
	if (!input) return '333';
	if (WCA_IMPORT_EVENTS.includes(input)) return input;
	const ct = VARIANT_MAP[input]?.cube_type ?? input;
	if (WCA_IMPORT_EVENTS.includes(ct)) return ct;
	if (ct.startsWith('333')) return '333';
	if (ct.startsWith('222')) return '222';
	if (ct.startsWith('444')) return '444';
	if (ct.startsWith('555')) return '555';
	return input;
}

interface SessionBucket {
	// WCA event shown in the CubePicker.
	cubeType: string;
	// The cube_type the solves are stored under when a subset is picked (333, 333cfop, ...).
	bucketCube: string;
	subset: string | null;
}

// Converts the value held as a single string in sessionIdCubeTypeMap to what the UI consumes.
// Accepted forms: a WCA event ('333' = wca/333), a VARIANT_MAP id ('333oh', 'pll'), or an
// explicit 'cube_type/subset' pair written by this screen ('444/RrUu').
export function deriveBucket(rawId: string): SessionBucket {
	if (!rawId) return { cubeType: '333', bucketCube: '333', subset: null };
	const slash = rawId.indexOf('/');
	if (slash > 0) {
		const ct = rawId.slice(0, slash);
		const sub = rawId.slice(slash + 1) || null;
		if (ct === 'wca') return deriveBucket(sub);
		return { cubeType: getParentWcaEvent(ct), bucketCube: ct, subset: sub };
	}
	const variant = VARIANT_MAP[rawId];
	if (variant) {
		return {
			cubeType: getParentWcaEvent(variant.cube_type),
			bucketCube: variant.cube_type,
			subset: variant.scramble_subset,
		};
	}
	return { cubeType: getParentWcaEvent(rawId), bucketCube: rawId, subset: null };
}

// The map value for a bucket: plain event id for wca/<event>, otherwise 'cube_type/subset'.
export function bucketMapKey(cubeType: string, subset: string | null): string {
	if (cubeType === 'wca') return subset ?? '333';
	if (!subset && WCA_IMPORT_EVENTS.includes(cubeType)) return cubeType;
	return `${cubeType}/${subset ?? ''}`;
}

// Subset choices for a session row. For a WCA event the empty choice is the WCA bucket
// itself, so it is listed first as "WCA" (the 3x3 list has no empty entry at all, so a
// WCA 3x3 session used to display its first practice subset, "Random Move").
export function getImportSubsets(bucketCube: string): ScrambleSubset[] {
	const subsets = getSubsetsForCube(bucketCube);
	if (!WCA_IMPORT_EVENTS.includes(bucketCube)) return subsets;
	return [{ id: '', label: 'WCA' }, ...subsets.filter((s) => s.id !== '')];
}
