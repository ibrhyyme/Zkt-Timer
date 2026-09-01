/**
 * Classifies a touch target inside the timer page.
 *
 * The timer used to treat *any* touch inside the `.zt-timer` subtree as an intent to
 * start a solve, with a hand written list of exceptions. That list only ever covered
 * the mobile layout, so on a tablet (>= 1024px, which gets the desktop layout while
 * still being a touch device) the footer modules, the scramble and the 3D cube all
 * primed the timer.
 *
 * The rule is inverted here: priming is only allowed from the timer's own surface,
 * while everything else about a touch inside the timer subtree stays as it was.
 */

// Interactive controls: a touch on them never reaches the timer, in any layout.
const BLOCKED_TAGS = ['BUTTON', 'TEXTAREA', 'INPUT'];

// Regions that own their touch behaviour and must never drive the timer.
const BLOCKED_CLASSES = [
	'zt-timer-controls__left',
	'zt-timer-controls__right',
	'zt-timer-header-control',
	'zt-timer-dashboard',
	'zt-stats-bar',
	'zt-mobile-timer-scramble__text',
	'zt-mobile-timer-scramble__smart-scramble',
	'zt-mobile-timer-scramble__expanded',
	'zt-mobile-timer-scramble__expanded-text',
	'zt-mobile-timer-scramble__expanded-copy',
	'zt-mobile-timer-scramble__expanded-close',
];

// The timer's own touch surface. A press may only PRIME the timer from here.
const START_SURFACE_CLASSES = ['zt-timer__main', 'zt-timer__touch-overlay'];

// Interactive islands that sit inside the start surface but own their gestures:
// tapping the scramble copies it / advances it, dragging the 3D cube rotates it.
// Neither is an intent to start a solve. They can still STOP a running solve.
const NON_START_CLASSES = ['zt-timer-scramble', 'zt-smart-cube'];

const TIMER_ROOT_CLASS = 'zt-timer';

export interface TouchTargetInfo {
	/** Interactive control or excluded region — ignore the touch entirely. */
	blocked: boolean;
	/** Anywhere inside the timer subtree. */
	insideTimer: boolean;
	/** May prime (start) the timer. */
	onStartSurface: boolean;
	/** Inside an island that owns its gesture (scramble, 3D cube) — never primes. */
	inNonStartIsland: boolean;
}

function hasClass(node: any, className: string): boolean {
	return !!node.classList && node.classList.contains(className);
}

/**
 * Walks up from the touched node once, collecting everything the touch handlers need.
 * Deliberately free of `document` / `window` so it stays SSR safe and unit testable
 * without jsdom.
 */
export function classifyTouchTarget(target: any): TouchTargetInfo {
	const info: TouchTargetInfo = {
		blocked: false,
		insideTimer: false,
		onStartSurface: false,
		inNonStartIsland: false,
	};

	let node = target;

	while (node) {
		if (BLOCKED_TAGS.indexOf(node.nodeName) !== -1) {
			info.blocked = true;
			return info;
		}

		for (const className of BLOCKED_CLASSES) {
			if (hasClass(node, className)) {
				info.blocked = true;
				return info;
			}
		}

		// The walk goes bottom up, so an island is always seen before the start surface
		// that contains it.
		for (const className of NON_START_CLASSES) {
			if (hasClass(node, className)) {
				info.inNonStartIsland = true;
			}
		}

		if (!info.inNonStartIsland) {
			for (const className of START_SURFACE_CLASSES) {
				if (hasClass(node, className)) {
					info.onStartSurface = true;
				}
			}
		}

		if (hasClass(node, TIMER_ROOT_CLASS)) {
			info.insideTimer = true;
		}

		node = node.parentNode;
	}

	return info;
}
