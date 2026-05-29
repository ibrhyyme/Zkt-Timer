/**
 * XCross slot + rotation alignment.
 *
 * Problem: cross solver rotation tokens (z2/y/x) are NOT APPLIED to state
 * (parse-scramble.ts skips negative p in solver move loop). Solver solves raw scramble,
 * slot in ABSOLUTE position (XCROSS_SLOTS idx: FR=0, FL=1, BL=2, BR=3 = cstimer
 * corner DFR/DLF/DBL/DRB). But twisty player applies rotation VISUALLY (setupAlg =
 * rotation + raw) → the slot the user sees is rotated relative to absolute slot.
 *
 * Solution: remap the slot the user SELECTED (visual) to the ABSOLUTE slot index
 * the solver uses (rotation⁻¹). This way the slot solved on twisty's rotation display
 * matches what the user intended. Solver/parse-scramble/twisty are NOT TOUCHED — only index remap.
 *
 * map[userSlotIdx] = solverSlotIdx.
 *
 * z2: EMPIRICALLY verified (user testing). Without rotation BL→BR, BR→FR... visual
 * shift (absolute slot appears in next visual position). Correction: map each selection
 * to one position earlier → idx0→3, idx1→0, idx2→1, idx3→2 = [3,0,1,2].
 *   BL(idx2)→solver1(FL): z2 visual FL→BL ⇒ user sees BL ✓
 *   BR(idx3)→solver2(BL): z2 visual BL→BR ⇒ user sees BR ✓
 *
 * Other rotations (y/x/z combinations): added EMPIRICALLY if user reports shift.
 * Undefined rotation → identity (no remap) + test with twisty.
 * (cubejs/quaternion calculation unreliable due to user perspective/camera — empirical observation is authoritative.)
 */
export const ROTATION_SLOT_MAP: Record<string, number[]> = {
	'': [0, 1, 2, 3], // None — identity
	z2: [3, 0, 1, 2], // empirical (user verified)
};

export function remapSlot(slotIdx: number, rotation: string): number {
	if (slotIdx < 0 || slotIdx > 3) return slotIdx; // invalid slot → don't touch (defense)
	const map = ROTATION_SLOT_MAP[rotation];
	if (!map) return slotIdx; // undefined rotation → identity (added after testing)
	return map[slotIdx] ?? slotIdx;
}
