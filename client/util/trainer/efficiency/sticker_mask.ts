/**
 * Efficiency Trainer sticker mask — on 3D cube only pieces relevant to algorithm are colored,
 * rest are gray (like RubiksSolverDemo reference).
 *
 * Reuse existing infrastructure: stickering_remap.getRemappedMask (rotation-aware KPuzzle remap).
 *   - cross   → cubing built-in 'Cross' mask
 *   - eocross → cubing built-in 'EOcross' mask (or null → full colored fallback)
 *   - xcross  → 'Cross' mask + selected slot edge/corner 'regular' (extraRegular)
 *
 * Pure visual layer — doesn't touch solver/slot/rotation logic.
 */
import {getRemappedMask} from '../stickering_remap';
import type {EfficiencyType} from '../../../components/trainer/efficiency/types';

/**
 * XCROSS_SLOTS idx (FR=0, FL=1, BL=2, BR=3 = cstimer corner DFR/DLF/DBL/DRB) →
 * cubing 3x3x3 EDGES/CORNERS piece index.
 * NOTE: cubing piece indexing should be EMPIRICALLY verified against twisty preview; if wrong
 * only this table is corrected (visual layer, solver unaffected).
 *   edge:   FR=8, FL=9, BL=11, BR=10 (D-layer slot edges)
 *   corner: DFR=5, DLF=4, DBL=7, DRB=6
 */
const SLOT_PIECE: Record<number, {edge: number; corner: number}> = {
	0: {edge: 8, corner: 5}, // FR
	1: {edge: 9, corner: 4}, // FL
	2: {edge: 11, corner: 7}, // BL
	3: {edge: 10, corner: 6}, // BR
};

// cubing 'Cross' mask makes centers 'dim' (faded); in reference they're fully colored (for orientation).
// Make all centers 'regular'.
const ALL_CENTERS = [0, 1, 2, 3, 4, 5];

export async function getEfficiencyMask(
	type: EfficiencyType,
	slotIdx: number | undefined,
	rotation: string
): Promise<any | null> {
	try {
		if (type === 'cross') {
			return await getRemappedMask('Cross', rotation, {CENTERS: ALL_CENTERS});
		}
		if (type === 'eocross') {
			return await getRemappedMask('EOcross', rotation, {CENTERS: ALL_CENTERS});
		}
		if (type === 'xcross') {
			const slot = slotIdx !== undefined ? SLOT_PIECE[slotIdx] : undefined;
			// If slot not selected (optimal) only cross colored
			const extra = slot
				? {EDGES: [slot.edge], CORNERS: [slot.corner], CENTERS: ALL_CENTERS}
				: {CENTERS: ALL_CENTERS};
			return await getRemappedMask('Cross', rotation, extra);
		}
	} catch {
		return null; // error → full colored (fallback, e.g., cubing 'EOcross' missing)
	}
	return null;
}
