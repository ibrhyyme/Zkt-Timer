/**
 * Facelet-string helpers shared by every smart cube consumer (timer, rooms, trainer).
 *
 * A facelets string is the cube's own report of its physical state: 54 characters,
 * nine per face, in URFDLB order. It is the only signal that survives a dropped BLE
 * move packet, which is why solve detection cross-checks against it instead of
 * trusting the move stream alone.
 */

export const DEFAULT_SOLVED_STATE = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

/**
 * A FACELETS payload can be malformed: byte offsets differ between GAN firmware
 * revisions, and a half-decoded packet still has 54 characters. Verify it describes
 * a real cube before trusting it over a tracker we already have.
 */
export function isValidFacelets(facelets: string | null | undefined): facelets is string {
	if (!facelets || facelets.length !== 54) return false;
	const counts: Record<string, number> = {};
	for (const ch of facelets) counts[ch] = (counts[ch] || 0) + 1;
	return FACES.every((f) => counts[f] === 9);
}

export function faceletsAreSolved(facelets: string | null | undefined, solvedState = DEFAULT_SOLVED_STATE): boolean {
	return !!facelets && facelets === solvedState;
}
