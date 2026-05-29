// Estimate WCA cube_type from scramble notation.
// Used for sources like Twisty Timer that don't provide cube_type information externally.
//
// Return value is a flat ID to be fed to normalizeBucketForImport():
//   '333' | '222' | '444' | '555' | '666' | '777'
//   'sq1' | 'pyram' | 'skewb' | 'minx' | 'clock'
//   null  -> could not be identified, caller should apply fallback

export function detectCubeTypeFromScramble(scramble: string): string | null {
	const s = (scramble || '').trim();
	if (!s) return null;

	// Sq1: parenthesized (x,y) blocks
	if (/\(\s*-?\d+\s*,\s*-?\d+\s*\)/.test(s)) return 'sq1';

	// Megaminx: ++ or -- two-character operators
	if (/(\+\+|--)/.test(s)) return 'minx';

	// Clock: pin notation (UR2+, DR4-, ALL3+) or y2 rotation
	if (/\b(UR|DR|UL|DL|ALL|U|R|D|L)\d+[+-]/.test(s) && /[+-]/.test(s) && /\d/.test(s)) {
		// If y2 + pin combo present, definitely clock
		if (/\by2\b/.test(s) || /\b(UR|DR|UL|DL|ALL)\d/.test(s)) return 'clock';
	}

	// Token-based analysis
	const tokens = s.split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return null;

	// Wide move detection: 3Rw / 3Uw -> 5x5+, Rw/Uw/Fw/Lw/Bw/Dw -> 4x4+
	const has3Wide = tokens.some(t => /^3[RUFLBD]w/.test(t));
	if (has3Wide) {
		// 6x6/7x7 distinction unreliable, default to 5x5
		return '555';
	}
	const hasWide = tokens.some(t => /^[RUFLBD]w[2']?$/.test(t));
	if (hasWide) return '444';

	// Pyraminx: lowercase u/r/l/b tip rotations (1-2 character single token)
	const hasLowerTip = tokens.some(t => /^[urlb]'?$/.test(t));
	const hasUpperURLB = tokens.some(t => /^[URLB][2']?$/.test(t));
	const hasFOrD = tokens.some(t => /^[FD]/.test(t));
	if (hasLowerTip && hasUpperURLB && !hasFOrD) return 'pyram';

	// Skewb: only R/L/U/B (no F or D), no lowercase letters
	const onlyRLUB = tokens.every(t => /^[RLUB][2']?$/.test(t));
	if (onlyRLUB && !hasFOrD && tokens.length > 0 && tokens.length <= 15) return 'skewb';

	// 3x3/2x2: F R U B L D (+ ', 2). Distinction unreliable — default to 3x3.
	const onlyCubeMoves = tokens.every(t => /^[FRUBLD][2']?$/.test(t));
	if (onlyCubeMoves) return '333';

	return null;
}
