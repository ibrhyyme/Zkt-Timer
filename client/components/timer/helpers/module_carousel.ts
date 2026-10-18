import { TimerModuleType } from '../@types/enums';
import { MOBILE_MODULE_OPTIONS } from '../@types/mobile_modules';

// The phone's two module slots page through the mobile modules with a horizontal swipe
// on the module itself (feedback 1.8-h, decision K-4). This file holds every decision
// that can be made without a DOM: which pages a slot has, where a swipe lands, and which
// press may start one. MobileModuleSlot.tsx only measures and draws.

export type ModulePair = [TimerModuleType, TimerModuleType];

export const DEFAULT_MOBILE_MODULES: ModulePair = [TimerModuleType.HISTORY, TimerModuleType.SCRAMBLE];

/**
 * The stored `mobile_timer_modules` setting as two valid, different modules.
 *
 * The old quick settings selectors let both slots hold the same module, and a module
 * that left the mobile list can still be stored. The left slot wins a clash: it keeps
 * its module and the right slot moves to the first free one.
 */
export function sanitizeMobileModules(
	raw: unknown,
	options: readonly TimerModuleType[] = MOBILE_MODULE_OPTIONS
): ModulePair {
	const stored = Array.isArray(raw) ? raw : [];
	const valid = (value: unknown): value is TimerModuleType => options.indexOf(value as TimerModuleType) !== -1;

	const first = valid(stored[0]) ? stored[0] : valid(DEFAULT_MOBILE_MODULES[0]) ? DEFAULT_MOBILE_MODULES[0] : options[0];

	const candidates: unknown[] = [stored[1], DEFAULT_MOBILE_MODULES[1], DEFAULT_MOBILE_MODULES[0], ...options];
	const second = candidates.find((value) => valid(value) && value !== first) as TimerModuleType | undefined;

	return [first, second ?? first];
}

/**
 * The pages one slot pages through: every mobile module except the one the other slot
 * shows, in the list's order (feedback 1.8-i). The other slot's module is skipped, not
 * shown twice.
 */
export function slotPages(
	otherModule: TimerModuleType,
	options: readonly TimerModuleType[] = MOBILE_MODULE_OPTIONS
): TimerModuleType[] {
	return options.filter((module) => module !== otherModule);
}

/**
 * The module one page away. `direction` 1 is the next page, -1 the previous one. Null
 * past either end: the pages do not wrap, so the dots read like a row of pages.
 */
export function neighbourModule(
	current: TimerModuleType,
	otherModule: TimerModuleType,
	direction: 1 | -1,
	options: readonly TimerModuleType[] = MOBILE_MODULE_OPTIONS
): TimerModuleType | null {
	const pages = slotPages(otherModule, options);
	const index = pages.indexOf(current);
	if (index === -1) return pages[0] ?? null;
	return pages[index + direction] ?? null;
}

/** Travel before a press is read as a swipe or a scroll, in CSS pixels. */
export const SWIPE_LOCK_PX = 10;

/**
 * Which way a press is going, decided once it has travelled `SWIPE_LOCK_PX`.
 *
 * A horizontal swipe must clearly be horizontal: the solves list scrolls vertically
 * under the same finger (K-4), and a slightly slanted scroll must stay a scroll.
 */
export function lockAxis(dx: number, dy: number): 'x' | 'y' | null {
	if (Math.hypot(dx, dy) < SWIPE_LOCK_PX) return null;
	return Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
}

/** How far a dragged page is drawn. Toward an end with nothing behind it, it resists. */
export function dragOffset(dx: number, hasPrevious: boolean, hasNext: boolean): number {
	// A finger moving right (dx > 0) pulls the previous page in, moving left the next one.
	const blocked = (dx > 0 && !hasPrevious) || (dx < 0 && !hasNext);
	return blocked ? dx * 0.25 : dx;
}

/** Share of the slot width a slow drag has to cover to turn the page. */
export const TURN_DISTANCE_RATIO = 0.3;
/** A flick turns the page from a short drag: px per ms, and the least travel it needs. */
export const FLICK_VELOCITY = 0.35;
export const FLICK_MIN_PX = 24;

/**
 * Where a released swipe lands: 1 the next page, -1 the previous one, 0 back where it
 * started. `velocity` is the finger's speed at release in px/ms, signed like `dx`.
 */
export function settleSwipe(
	dx: number,
	velocity: number,
	width: number,
	hasPrevious: boolean,
	hasNext: boolean
): -1 | 0 | 1 {
	if (dx === 0) return 0;

	const direction: -1 | 1 = dx < 0 ? 1 : -1;
	if ((direction === 1 && !hasNext) || (direction === -1 && !hasPrevious)) return 0;

	const far = Math.abs(dx) > width * TURN_DISTANCE_RATIO;
	const flick =
		Math.abs(dx) > FLICK_MIN_PX && Math.abs(velocity) > FLICK_VELOCITY && Math.sign(velocity) === Math.sign(dx);

	return far || flick ? direction : 0;
}

export interface SwipeTargetEnv {
	/** The node scrolls sideways on its own: its content is wider than its box. */
	scrollsX(node: any): boolean;
}

// Elements that own a horizontal drag. TWISTY-PLAYER is the cubing.js 3D cube (turned by
// dragging); its canvas lives in a shadow root, so the target seen out here is the
// element itself. Buttons are NOT here: a swipe that happens to start on a row's delete
// button is still a swipe, and the click it would end in is swallowed.
const OWNS_DRAG_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'VIDEO', 'AUDIO', 'IFRAME', 'TWISTY-PLAYER']);
const OWNS_DRAG_ROLES = new Set(['slider', 'scrollbar', 'textbox']);

/** Opt-out for a module region that owns a horizontal drag the rules cannot see. */
export const NO_SWIPE_ATTRIBUTE = 'data-module-noswipe';

/**
 * Opt-in for an element whose tag would own the drag but which is only a picture: a
 * cubing.js player in its 2D view cannot be turned, so a swipe on it pages like a swipe
 * anywhere else in the module (TwistyPlayerWrapper sets it).
 */
export const SWIPE_THROUGH_ATTRIBUTE = 'data-module-swipe';

function attribute(node: any, name: string): string | null {
	return typeof node.getAttribute === 'function' ? node.getAttribute(name) : null;
}

/**
 * Whether a press on `target` may page the slot whose frame is `frame`. Walks from the
 * target up to the frame; a target outside it (a portal) never pages.
 */
export function isSwipeTarget(target: any, frame: any, env: SwipeTargetEnv): boolean {
	let node = target;

	while (node && node !== frame) {
		if (node.nodeType === 1) {
			const tag = String(node.nodeName || '').toUpperCase();
			if (OWNS_DRAG_TAGS.has(tag) && attribute(node, SWIPE_THROUGH_ATTRIBUTE) === null) return false;

			const role = attribute(node, 'role');
			if (role && OWNS_DRAG_ROLES.has(role)) return false;

			if (attribute(node, NO_SWIPE_ATTRIBUTE) !== null) return false;
			if (node.isContentEditable) return false;
			if (env.scrollsX(node)) return false;
		}
		node = node.parentNode;
	}

	return !!node && node === frame;
}
