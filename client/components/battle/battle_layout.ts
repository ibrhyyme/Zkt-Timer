// Offline battle layout and keyboard keys (3.0-i). Pure, no React, no DOM globals: tested in node.

/**
 * facing: the device lies flat between the two players, one half upside down (phones, tablets).
 * side:   both players look at one screen from the same side (a desktop with mouse and keyboard),
 *         so the halves sit next to each other, both upright.
 */
export type BattleLayout = 'facing' | 'side';

export interface PointerTraits {
	/** matchMedia('(pointer: fine)').matches: the PRIMARY pointer is a mouse or a trackpad */
	primaryFine: boolean;
	/** matchMedia('(pointer: coarse)').matches: the PRIMARY pointer is a finger */
	primaryCoarse: boolean;
	/** navigator.maxTouchPoints, only consulted when the browser answers neither query */
	maxTouchPoints: number;
}

/** The media queries the layout depends on; the page re-reads the traits when either flips. */
export const BATTLE_POINTER_QUERIES = ['(pointer: fine)', '(pointer: coarse)'];

/**
 * Decided by the device's PRIMARY pointer, never by the width (K-11): a tablet turned sideways
 * is as wide as a laptop but still lies on the table between the players.
 *
 * Primary pointer fine (mouse, trackpad): both players look at the screen from the same side,
 * so side by side. A Windows laptop with a touchscreen lands here as well: it has a finger as
 * an extra pointer, but it stands upright on the table, it does not lie flat.
 * Primary pointer coarse (phones, tablets): facing.
 * A browser that answers neither query falls back on touch support.
 */
export function pickBattleLayout(traits: PointerTraits): BattleLayout {
	if (traits.primaryFine) return 'side';
	if (traits.primaryCoarse) return 'facing';
	return (traits.maxTouchPoints || 0) > 0 ? 'facing' : 'side';
}

function matches(win: any, query: string): boolean {
	try {
		return !!win.matchMedia?.(query)?.matches;
	} catch (e) {
		return false;
	}
}

/** Reads the pointer traits of this browser. Defaults to the touch layout without a window. */
export function readPointerTraits(win: any): PointerTraits {
	if (!win) return {primaryFine: false, primaryCoarse: true, maxTouchPoints: 1};
	return {
		primaryFine: matches(win, BATTLE_POINTER_QUERIES[0]),
		primaryCoarse: matches(win, BATTLE_POINTER_QUERIES[1]),
		maxTouchPoints: Number(win.navigator?.maxTouchPoints) || 0,
	};
}

/**
 * One key per player, on that player's side of the keyboard.
 *
 * A and L: both letters exist on Turkish Q, US and Turkish F, and on all three A sits under
 * the left hand and L under the right one (Turkish F puts A where Q has F, still left). The
 * key is matched by the character it types, so the label on screen is the letter printed on
 * the key, and also by its physical position (KeyA / KeyL), which keeps it working on layouts
 * without Latin letters (Russian). Shift is out (five presses open Windows Sticky Keys), so
 * are CapsLock, Ctrl and Alt (browser shortcuts, AltGr on Turkish layouts, no right Ctrl on
 * many laptops), and Space would belong to neither player.
 */
export const BATTLE_KEYS: Record<1 | 2, {label: string; key: string; code: string}> = {
	1: {label: 'A', key: 'a', code: 'KeyA'},
	2: {label: 'L', key: 'l', code: 'KeyL'},
};

export interface KeyLike {
	key?: string;
	code?: string;
	ctrlKey?: boolean;
	metaKey?: boolean;
	altKey?: boolean;
}

/** Which player a keyboard event belongs to, or null. A shortcut chord belongs to nobody. */
export function battleKeyPlayer(event: KeyLike): 1 | 2 | null {
	if (!event || event.ctrlKey || event.metaKey || event.altKey) return null;
	const key = String(event.key || '').toLowerCase();
	for (const player of [1, 2] as const) {
		const def = BATTLE_KEYS[player];
		if (key === def.key || event.code === def.code) return player;
	}
	return null;
}

/** Typing into a field (player names in the menu) must never start a timer. */
export function isTypingTarget(target: any): boolean {
	if (!target) return false;
	const tag = String(target.tagName || '').toUpperCase();
	if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
	return !!target.isContentEditable;
}
