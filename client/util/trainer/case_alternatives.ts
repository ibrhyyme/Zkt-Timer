/**
 * The algorithm variants of one trainer case (trainer-sets 5.4, 10 T6).
 *
 * One merge rule for every place that lists a case's algorithms: the stats panel picker
 * (AlternativesPicker), the set page's "Change algorithm" sheet and the set picker's variant
 * window (both VariantSheet). Order: library main algorithm, library alternatives, the shared
 * pool (TrainerAlternative), then this device's guest alternatives. Duplicates are dropped by
 * the trainer's own text (`trainerAlgText`), so a fix to the notation expansion (B-1) changes
 * every list together.
 *
 * Pure: no React, storage or network. Callers fetch the pieces and pass them in.
 */
import {trainerAlgText} from './set_queue';
import type {AlgorithmEntry, AlgorithmSubset} from '../../components/trainer/types';

export interface LibraryCase {
	subset: string;
	entry: AlgorithmEntry;
}

/** The library entry of `category` / `caseName` and its subset, or null. */
export function findLibraryCase(
	library: Record<string, AlgorithmSubset[]> | null | undefined,
	category: string,
	caseName: string
): LibraryCase | null {
	const subsets = library?.[category];
	if (!Array.isArray(subsets)) return null;
	for (const sub of subsets) {
		const entry = (sub?.algorithms || []).find((a) => a?.name === caseName);
		if (entry) return {subset: sub.subset, entry};
	}
	return null;
}

export interface CaseAlternativeSources {
	/** Library main algorithm. */
	primary?: string | null;
	/** Library alternatives (`entry.alternatives`). */
	library?: ReadonlyArray<string | null | undefined> | null;
	/** Shared pool texts (`TrainerAlternative.original_input`, or `algorithm` when that is empty). */
	pool?: ReadonlyArray<string | null | undefined> | null;
	/** This device's guest alternatives (`trainer_customAlternatives`). Left out where the server checks texts. */
	guest?: ReadonlyArray<string | null | undefined> | null;
}

/** Every variant once, in source order, as written (not expanded). */
export function mergeCaseAlternatives(sources: CaseAlternativeSources): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	const push = (alg: string | null | undefined) => {
		if (typeof alg !== 'string' || !alg.trim()) return;
		const key = trainerAlgText(alg);
		if (!key || seen.has(key)) return;
		seen.add(key);
		out.push(alg);
	};
	push(sources.primary);
	(sources.library || []).forEach(push);
	(sources.pool || []).forEach(push);
	(sources.guest || []).forEach(push);
	return out;
}

/** The variants of a library case without pool and guest texts (library main + alternatives). */
export function libraryVariants(found: LibraryCase | null): string[] {
	if (!found) return [];
	return mergeCaseAlternatives({primary: found.entry.algorithm, library: found.entry.alternatives || []});
}

/** True when two algorithm texts are the same variant for the trainer. */
export function sameVariant(a: string | null | undefined, b: string | null | undefined): boolean {
	return trainerAlgText(a || '') === trainerAlgText(b || '');
}
