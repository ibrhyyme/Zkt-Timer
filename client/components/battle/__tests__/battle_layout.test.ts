import {battleKeyPlayer, isTypingTarget, pickBattleLayout, readPointerTraits} from '../battle_layout';

describe('pickBattleLayout', () => {
	const query = (fine: boolean, coarse: boolean, maxTouchPoints: number) => ({
		navigator: {maxTouchPoints},
		matchMedia: (q: string) => ({matches: q === '(pointer: fine)' ? fine : q === '(pointer: coarse)' ? coarse : false}),
	});

	it('puts a mouse or trackpad desktop side by side', () => {
		expect(pickBattleLayout({primaryFine: true, primaryCoarse: false, maxTouchPoints: 0})).toBe('side');
	});

	it('puts a touchscreen laptop side by side: its primary pointer is still fine (K-11)', () => {
		expect(pickBattleLayout(readPointerTraits(query(true, false, 10)))).toBe('side');
	});

	it('keeps phones and tablets facing, whatever their width', () => {
		expect(pickBattleLayout(readPointerTraits(query(false, true, 5)))).toBe('facing');
		expect(pickBattleLayout({primaryFine: false, primaryCoarse: true, maxTouchPoints: 0})).toBe('facing');
	});

	it('falls back on touch support when neither query answers', () => {
		expect(pickBattleLayout(readPointerTraits(query(false, false, 5)))).toBe('facing');
		expect(pickBattleLayout(readPointerTraits(query(false, false, 0)))).toBe('side');
		expect(pickBattleLayout(readPointerTraits({navigator: {maxTouchPoints: 0}}))).toBe('side');
		expect(
			pickBattleLayout(
				readPointerTraits({
					navigator: {maxTouchPoints: 3},
					matchMedia: () => {
						throw new Error('no matchMedia');
					},
				})
			)
		).toBe('facing');
	});

	it('defaults to facing without a window', () => {
		expect(readPointerTraits(null)).toEqual({primaryFine: false, primaryCoarse: true, maxTouchPoints: 1});
		expect(pickBattleLayout(readPointerTraits(null))).toBe('facing');
	});
});

describe('battleKeyPlayer', () => {
	it('gives A to the left player and L to the right one', () => {
		expect(battleKeyPlayer({key: 'a', code: 'KeyA'})).toBe(1);
		expect(battleKeyPlayer({key: 'l', code: 'KeyL'})).toBe(2);
	});

	it('works with CapsLock on', () => {
		expect(battleKeyPlayer({key: 'A', code: 'KeyA'})).toBe(1);
		expect(battleKeyPlayer({key: 'L', code: 'KeyL'})).toBe(2);
	});

	it('follows the printed letter on Turkish F (A is under the left index finger)', () => {
		// Turkish F: the physical KeyF types "a", the physical KeyL types "l"
		expect(battleKeyPlayer({key: 'a', code: 'KeyF'})).toBe(1);
		expect(battleKeyPlayer({key: 'l', code: 'KeyL'})).toBe(2);
		// The physical KeyA types "u" there: still the left hand, still player 1
		expect(battleKeyPlayer({key: 'u', code: 'KeyA'})).toBe(1);
	});

	it('works on layouts without Latin letters by position', () => {
		expect(battleKeyPlayer({key: 'ф', code: 'KeyA'})).toBe(1);
		expect(battleKeyPlayer({key: 'д', code: 'KeyL'})).toBe(2);
	});

	it('ignores other keys and shortcut chords', () => {
		expect(battleKeyPlayer({key: ' ', code: 'Space'})).toBeNull();
		expect(battleKeyPlayer({key: 'Shift', code: 'ShiftLeft'})).toBeNull();
		expect(battleKeyPlayer({key: 'a', code: 'KeyA', ctrlKey: true})).toBeNull();
		expect(battleKeyPlayer({key: 'l', code: 'KeyL', metaKey: true})).toBeNull();
	});
});

describe('isTypingTarget', () => {
	it('recognises form fields', () => {
		expect(isTypingTarget({tagName: 'INPUT'})).toBe(true);
		expect(isTypingTarget({tagName: 'textarea'})).toBe(true);
		expect(isTypingTarget({tagName: 'DIV', isContentEditable: true})).toBe(true);
		expect(isTypingTarget({tagName: 'DIV'})).toBe(false);
		expect(isTypingTarget(null)).toBe(false);
	});
});
