/**
 * Efficiency Trainer sticker mask — 3D kupte sadece algoritmayi ilgilendiren
 * parcalar renkli, kalan gri (referans RubiksSolverDemo gibi).
 *
 * Mevcut altyapi reuse: stickering_remap.getRemappedMask (rotation-aware KPuzzle remap).
 *   - cross   → cubing hazir 'Cross' mask
 *   - eocross → cubing hazir 'EOcross' mask (yoksa null → full renkli fallback)
 *   - xcross  → 'Cross' mask + secili slot edge/corner 'regular' (extraRegular)
 *
 * Saf gorsel katman — solver/slot/rotation mantigina dokunmaz.
 */
import {getRemappedMask} from '../stickering_remap';
import type {EfficiencyType} from '../../../components/trainer/efficiency/types';

/**
 * XCROSS_SLOTS idx (FR=0, FL=1, BL=2, BR=3 = cstimer corner DFR/DLF/DBL/DRB) →
 * cubing 3x3x3 EDGES/CORNERS piece index.
 * NOT: cubing piece indekslemesi twisty preview ile AMPIRIK dogrulanmali; yanlissa
 * sadece bu tablo duzeltilir (gorsel katman, solver etkilenmez).
 *   edge:   FR=8, FL=9, BL=11, BR=10 (D-layer slot edges)
 *   corner: DFR=5, DLF=4, DBL=7, DRB=6
 */
const SLOT_PIECE: Record<number, {edge: number; corner: number}> = {
	0: {edge: 8, corner: 5}, // FR
	1: {edge: 9, corner: 4}, // FL
	2: {edge: 11, corner: 7}, // BL
	3: {edge: 10, corner: 6}, // BR
};

// cubing 'Cross' mask merkezleri 'dim' (soluk) yapiyor; referansta merkezler tam
// renkli (oryantasyon icin). Tum merkezleri 'regular' yap.
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
			// slot secili degilse (optimal) sadece cross renkli
			const extra = slot
				? {EDGES: [slot.edge], CORNERS: [slot.corner], CENTERS: ALL_CENTERS}
				: {CENTERS: ALL_CENTERS};
			return await getRemappedMask('Cross', rotation, extra);
		}
	} catch {
		return null; // hata → full renkli (fallback, cubing 'EOcross' yoksa vb.)
	}
	return null;
}
