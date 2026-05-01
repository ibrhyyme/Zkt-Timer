// Scramble notasyonundan WCA cube_type tahmini.
// Twisty Timer gibi cube_type bilgisini disardan vermeyen kaynaklar icin kullanilir.
//
// Donus degeri normalizeBucketForImport()'a beslenecek flat ID:
//   '333' | '222' | '444' | '555' | '666' | '777'
//   'sq1' | 'pyram' | 'skewb' | 'minx' | 'clock'
//   null  -> tanimlanamadi, caller fallback uygulamali

export function detectCubeTypeFromScramble(scramble: string): string | null {
	const s = (scramble || '').trim();
	if (!s) return null;

	// Sq1: parantezli (x,y) bloklari
	if (/\(\s*-?\d+\s*,\s*-?\d+\s*\)/.test(s)) return 'sq1';

	// Megaminx: ++ veya -- iki karakterli operator
	if (/(\+\+|--)/.test(s)) return 'minx';

	// Clock: pin notasyonu (UR2+, DR4-, ALL3+) veya y2 cevirme
	if (/\b(UR|DR|UL|DL|ALL|U|R|D|L)\d+[+-]/.test(s) && /[+-]/.test(s) && /\d/.test(s)) {
		// y2 + pin kombosu varsa kesin clock
		if (/\by2\b/.test(s) || /\b(UR|DR|UL|DL|ALL)\d/.test(s)) return 'clock';
	}

	// Token bazli analiz
	const tokens = s.split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return null;

	// Wide move tespiti: 3Rw / 3Uw -> 5x5+, Rw/Uw/Fw/Lw/Bw/Dw -> 4x4+
	const has3Wide = tokens.some(t => /^3[RUFLBD]w/.test(t));
	if (has3Wide) {
		// 6x6/7x7 ayrimi guvenilmez, default 5x5'e dusur
		return '555';
	}
	const hasWide = tokens.some(t => /^[RUFLBD]w[2']?$/.test(t));
	if (hasWide) return '444';

	// Pyraminx: kucuk u/r/l/b tip rotasyonlari (1-2 karakterlik tek token)
	const hasLowerTip = tokens.some(t => /^[urlb]'?$/.test(t));
	const hasUpperURLB = tokens.some(t => /^[URLB][2']?$/.test(t));
	const hasFOrD = tokens.some(t => /^[FD]/.test(t));
	if (hasLowerTip && hasUpperURLB && !hasFOrD) return 'pyram';

	// Skewb: sadece R/L/U/B (F ve D yok), kucuk harf yok
	const onlyRLUB = tokens.every(t => /^[RLUB][2']?$/.test(t));
	if (onlyRLUB && !hasFOrD && tokens.length > 0 && tokens.length <= 15) return 'skewb';

	// 3x3/2x2: F R U B L D (+ ', 2). Ayrim guvenilir degil — default 3x3.
	const onlyCubeMoves = tokens.every(t => /^[FRUBLD][2']?$/.test(t));
	if (onlyCubeMoves) return '333';

	return null;
}
