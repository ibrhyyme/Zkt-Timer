import {CUBE_TYPES, CubeType} from './cube_types';
import {CUBE_SCRAMBLES, ScrambleType} from './cube_scrambles';
import {SCRAMBLE_SUBSETS} from './scramble_subsets';
import {getSettings} from '../../db/settings/query';
import i18next from 'i18next';

export function getScrambleTypeById(scrambleId: string): ScrambleType {
	return CUBE_SCRAMBLES[scrambleId];
}

// Converts CUBE_TYPES to array
export function getDefaultCubeTypes(): CubeType[] {
	return Object.keys(CUBE_TYPES).map((cubeType) => CUBE_TYPES[cubeType]);
}

// Combines default cube types and customer cube types as a map
export function getAllCubeTypesAsMap(): Record<string, CubeType> {
	return {
		...getCustomCubeTypeAsMap(),
		...CUBE_TYPES,
	};
}

// Combines default cube types and custom cube types
export function getAllCubeTypes(): CubeType[] {
	return getCustomCubeTypes().concat(getDefaultCubeTypes());
}

export function getDefaultCubeTypeNames(): string[] {
	return Object.keys(CUBE_TYPES);
}

// Combines default cube types names and custom cube types names
export function getAllCubeTypeNames(): string[] {
	return Object.keys(getCustomCubeTypeAsMap()).concat(Object.keys(CUBE_TYPES));
}

export function getAllScrambleTypeNames(): string[] {
	return Object.keys(CUBE_SCRAMBLES);
}

export function getCubeTypeInfoById(id: string): CubeType {
	if (!id) {
		return null;
	}

	const all = getAllCubeTypesAsMap();
	return all[id];
}

export function getCubeTypeInfoByName(name: string): CubeType {
	if (!name) {
		return null;
	}

	for (const ct of getAllCubeTypes()) {
		if (ct.name === name) {
			return ct;
		}
	}

	return null;
}

export function getCubeTypeInfo(idOrName: string): CubeType {
	return getCubeTypeInfoById(idOrName) || getCubeTypeInfoByName(idOrName);
}

export function getCubeTypeName(id: string): string {
	if (!id) {
		return null;
	}

	return getCubeTypeInfoById(id).name;
}

export function getCustomCubeTypes(): CubeType[] {
	const customCubeTypes = getSettings()?.custom_cube_types;

	if (!customCubeTypes) {
		return [];
	}

	return customCubeTypes.map((ct) => ({
		id: ct.id,
		name: ct.name,
		scramble: ct.scramble,
		private: ct.private,
	}));
}

// Gets the label for a subset ID within a cube type
// Handles both literal labels ("PLL") and i18n keys ("scramble_subsets.random_state")
export function getSubsetLabel(cubeType: string, subsetId: string | null | undefined): string | null {
	if (!cubeType) return null;

	const subsets = SCRAMBLE_SUBSETS[cubeType];
	if (!subsets) return null;

	const normalized = subsetId ?? '';
	const subset = subsets.find((s) => s.id === normalized);
	if (!subset) return null;

	// i18n keys contain a dot (e.g. "scramble_subsets.random_state")
	if (subset.label.includes('.') && !subset.label.includes(' ')) {
		return i18next.t(subset.label);
	}
	return subset.label;
}

// Composite label for a (cube_type, subset) pair.
// Examples: "WCA > 3x3", "3x3 > Random State", "Square-1"
export function getCubeTypeBucketLabel(cubeType: string, subsetId: string | null | undefined): string {
	const ct = getCubeTypeInfoById(cubeType);
	if (!ct) return cubeType;

	const subsetLabel = getSubsetLabel(cubeType, subsetId);
	if (!subsetLabel) return ct.name;

	return `${ct.name} > ${subsetLabel}`;
}

// Short label — subset varsa sadece subset, yoksa cube type adi.
// Charts/widget'larda daha kompakt gosterim icin (CubeDistro gibi).
export function getBucketShortLabel(cubeType: string, subsetId: string | null | undefined): string {
	const subsetLabel = getSubsetLabel(cubeType, subsetId);
	if (subsetLabel) return subsetLabel;
	return getCubeTypeInfoById(cubeType)?.name || cubeType;
}

// Returns unique cube_type ids from a bucket list, preserving WCA-first order.
export function getUniqueCubeTypes(
	buckets: { cube_type: string; scramble_subset: string | null }[]
): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const b of buckets) {
		if (!seen.has(b.cube_type)) {
			seen.add(b.cube_type);
			result.push(b.cube_type);
		}
	}
	// WCA first
	result.sort((a, b) => {
		if (a === 'wca' && b !== 'wca') return -1;
		if (b === 'wca' && a !== 'wca') return 1;
		return 0;
	});
	return result;
}

// Returns the scramble subsets present in the bucket list for a specific cube_type,
// formatted for SubsetPicker. Preserves the canonical SCRAMBLE_SUBSETS order.
export function getSubsetsForBuckets(
	cubeType: string,
	buckets: { cube_type: string; scramble_subset: string | null }[]
): { id: string; label: string; isHeader?: boolean }[] {
	const present = new Set<string>();
	for (const b of buckets) {
		if (b.cube_type === cubeType) {
			present.add(b.scramble_subset ?? '');
		}
	}

	const canonical = SCRAMBLE_SUBSETS[cubeType] || [];
	const result: { id: string; label: string }[] = [];
	const seen = new Set<string>();

	for (const sub of canonical) {
		if (sub.isHeader) continue;
		if (present.has(sub.id)) {
			const label = getSubsetLabel(cubeType, sub.id) || sub.label;
			result.push({ id: sub.id, label });
			seen.add(sub.id);
		}
	}

	// Canonical listede olmayan ama bucket'ta bulunan subset'ler (orphan/legacy)
	for (const id of present) {
		if (seen.has(id)) continue;
		if (!id) continue; // bos id'yi WCA'da zaten canonical yakaliyor, digerlerinde atla
		const label = getSubsetLabel(cubeType, id) || id;
		result.push({ id, label });
	}

	return result;
}

// Groups a flat list of (cube_type, scramble_subset) pairs into sections by cube_type.
// Output order: WCA first (if present), then other cube types in first-seen order.
export interface GroupedBucket {
	cube_type: string;
	cubeTypeName: string;
	subsets: (string | null)[];
}

export function groupBucketsByCubeType(
	buckets: { cube_type: string; scramble_subset: string | null }[]
): GroupedBucket[] {
	const map = new Map<string, (string | null)[]>();
	for (const b of buckets) {
		const list = map.get(b.cube_type) || [];
		list.push(b.scramble_subset);
		map.set(b.cube_type, list);
	}

	const entries = Array.from(map.entries());
	entries.sort(([a], [b]) => {
		if (a === 'wca' && b !== 'wca') return -1;
		if (b === 'wca' && a !== 'wca') return 1;
		return 0;
	});

	return entries.map(([cube_type, subsets]) => ({
		cube_type,
		cubeTypeName: getCubeTypeInfoById(cube_type)?.name || cube_type,
		subsets,
	}));
}

function getCustomCubeTypeAsMap(): Record<string, CubeType> {
	const list = getCustomCubeTypes();
	// Convert list to map with name as key
	const output: Record<string, CubeType> = {};

	for (const ct of list) {
		output[ct.id] = ct;
	}

	return output;
}
