// Which press on a module may pick it up.
//
// A module can be dragged by its whole surface (header, padding, background), not only
// by its header. The header alone left a module dropped onto the site's top bar with
// nothing to grab: the header was under the bar. What must NOT start a drag is whatever
// inside the module owns the pointer itself: controls, the 3D cube in the scramble
// preview (turned by dragging), and any list that scrolls.
//
// Static drawings are fair game: the charts (visx svg, BarGraph) and the 2D puzzle nets
// have no press or move behaviour of their own, and a drag only begins after the pointer
// has moved with the button held, so their hover and click behaviour is untouched. A
// future module region that does own the pointer opts out with NO_DRAG_ATTRIBUTE.
//
// A list only owns the pointer for touch and pen, where the finger moves its content.
// A mouse scrolls it with the wheel, so for a mouse only the list's scrollbar is off
// limits and its rows can be grabbed like the rest of the module.
//
// Kept free of `window` / `document` so it runs in node tests. The measurements it
// needs come in through `DragTargetEnv`.

export interface DragTargetEnv {
	/** The node scrolls on its own: content larger than its box on an axis it may scroll. */
	scrolls(node: any): boolean;
	/** The point lands on the node's own scrollbar. Only asked about nodes that scroll. */
	onScrollbar(node: any, point: { x: number; y: number }): boolean;
}

/** The press being tested. Without it the walk assumes touch, the stricter case. */
export interface DragPress {
	pointerType: string;
	x: number;
	y: number;
}

// Controls and media. TWISTY-PLAYER is the cubing.js 3D cube: its canvas lives in a
// shadow root, so the event target seen out here is the custom element itself.
const BLOCKED_TAGS = new Set([
	'BUTTON',
	'A',
	'INPUT',
	'TEXTAREA',
	'SELECT',
	'OPTION',
	'LABEL',
	'VIDEO',
	'AUDIO',
	'IFRAME',
	'TWISTY-PLAYER',
]);

const BLOCKED_ROLES = new Set([
	'button',
	'link',
	'menuitem',
	'menuitemcheckbox',
	'menuitemradio',
	'option',
	'slider',
	'spinbutton',
	'tab',
	'checkbox',
	'radio',
	'switch',
	'textbox',
	'combobox',
	'listbox',
	'scrollbar',
]);

/** Opt-out for a module region the rules above cannot recognise. */
export const NO_DRAG_ATTRIBUTE = 'data-tile-nodrag';

/**
 * Opt-in for an element whose role says button but which owns no gesture beyond a
 * click, like a solves list row that opens the solve card. The role is ignored on that
 * element only: a real control inside it (an average cell) still blocks.
 */
export const DRAG_OK_ATTRIBUTE = 'data-tile-drag';

function attribute(node: any, name: string): string | null {
	return typeof node.getAttribute === 'function' ? node.getAttribute(name) : null;
}

/**
 * Whether a press on `target` may start dragging the module whose root is `tile`.
 *
 * Walks from the target up to the tile root. A target outside the tile's DOM (a menu
 * the tile opened, rendered in a portal: React still bubbles its events through the
 * tile) never starts a drag.
 */
export function isTileDragTarget(target: any, tile: any, env: DragTargetEnv, press?: DragPress): boolean {
	const mouse = press?.pointerType === 'mouse';
	let node = target;

	while (node && node !== tile) {
		// Elements only. Text nodes are walked past.
		if (node.nodeType === 1) {
			const tag = String(node.nodeName || '').toUpperCase();

			if (BLOCKED_TAGS.has(tag)) return false;

			const role = attribute(node, 'role');
			if (role && BLOCKED_ROLES.has(role) && attribute(node, DRAG_OK_ATTRIBUTE) === null) return false;

			if (attribute(node, NO_DRAG_ATTRIBUTE) !== null) return false;
			if (node.isContentEditable) return false;

			if (env.scrolls(node) && (!mouse || env.onScrollbar(node, { x: press.x, y: press.y }))) return false;
		}

		node = node.parentNode;
	}

	return !!node && node === tile;
}

/**
 * Whether a docked module may be picked up from this press.
 *
 * With a mouse, anywhere `isTileDragTarget` allows. With touch, a docked module only
 * moves by its header: the rail or bar it sits in scrolls by swiping over its modules,
 * and a module that grabbed every swipe would make that column impossible to scroll on
 * a tablet. A floating module is not inside anything that scrolls, so it is grabbed by
 * its whole surface with any pointer.
 */
export function allowsDragFrom(options: {
	floating: boolean;
	pointerType: string;
	inHeader: boolean;
}): boolean {
	if (options.floating || options.inHeader) return true;
	return options.pointerType === 'mouse';
}
