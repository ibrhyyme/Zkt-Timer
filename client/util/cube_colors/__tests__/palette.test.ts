import {
	DEFAULT_NXN_COLORS,
	DEFAULT_SQ1_COLORS,
	migrateLegacyNxnColors,
	sanitizeColor,
	sanitizeColors,
} from '../palette';

describe('sanitizeColors', () => {
	it('keeps valid colours, lowercased', () => {
		expect(sanitizeColors(['#FFFFFF', '#Ef3E33'], ['#000000', '#000000'])).toEqual([
			'#ffffff',
			'#ef3e33',
		]);
	});

	it('repairs per entry rather than rejecting the whole array', () => {
		// One bad colour must cost one colour, not the user's whole scheme.
		const saved = ['#ffffff', 'not-a-colour', '#00a651', '#ffd600', '#ff8a00', '#1e49bf'];
		expect(sanitizeColors(saved, DEFAULT_NXN_COLORS)).toEqual([
			'#ffffff',
			DEFAULT_NXN_COLORS[1].toLowerCase(),
			'#00a651',
			'#ffd600',
			'#ff8a00',
			'#1e49bf',
		]);
	});

	it('pads a short array and ignores extra entries', () => {
		expect(sanitizeColors(['#ffffff'], ['#000000', '#111111'])).toEqual(['#ffffff', '#111111']);
		expect(sanitizeColors(['#ffffff', '#111111', '#222222'], ['#000000', '#000000'])).toHaveLength(2);
	});

	it('falls back entirely for a non-array', () => {
		expect(sanitizeColors(undefined, DEFAULT_SQ1_COLORS)).toEqual(
			DEFAULT_SQ1_COLORS.map((c) => c.toLowerCase())
		);
		expect(sanitizeColors('#ffffff', DEFAULT_SQ1_COLORS)).toEqual(
			DEFAULT_SQ1_COLORS.map((c) => c.toLowerCase())
		);
	});

	it('rejects shorthand and non-hex forms', () => {
		expect(sanitizeColor('#fff', '#000000')).toBe('#000000');
		expect(sanitizeColor('rgb(255,255,255)', '#000000')).toBe('#000000');
		expect(sanitizeColor('#ffffff', '#000000')).toBe('#ffffff');
	});
});

describe('migrateLegacyNxnColors', () => {
	// The exact array every pre-Colors account has saved in its prefs blob, from when the
	// setting existed but nothing read it. Left alone, it paints a green top face.
	const legacy = ['#43ff43', '#ff9826', '#ffffff', '#246bfd', '#ff4343', '#ffff49'];

	it('replaces the never-chosen legacy array with the default', () => {
		expect(migrateLegacyNxnColors(legacy)).toEqual(DEFAULT_NXN_COLORS);
	});

	it('is what a sanitized legacy value becomes, uppercase included', () => {
		// The value is stored uppercase; sanitizeColors lowercases it, and only then does the
		// match happen. Both halves have to line up or the migration never fires.
		const stored = ['#43FF43', '#FF9826', '#FFFFFF', '#246BFD', '#FF4343', '#FFFF49'];
		expect(migrateLegacyNxnColors(sanitizeColors(stored, DEFAULT_NXN_COLORS))).toEqual(
			DEFAULT_NXN_COLORS
		);
	});

	it('leaves a palette the user actually chose alone', () => {
		const chosen = ['#000000', '#ff9826', '#ffffff', '#246bfd', '#ff4343', '#ffff49'];
		expect(migrateLegacyNxnColors(chosen)).toEqual(chosen);
	});

	it('leaves the default alone', () => {
		expect(migrateLegacyNxnColors(DEFAULT_NXN_COLORS)).toEqual(DEFAULT_NXN_COLORS);
	});
});
