import type { FloatFrame } from './layout';
import type { DragTargetEnv } from './drag_target';

// Browser measurements for the tile layer. Kept apart from layout.ts and drag_target.ts
// so those stay testable in node.

/** The site header bar. Fixed over the top of the page, above the free tile layer. */
const TOP_BAR_SELECTOR = '.zt-header-nav__bar';

/**
 * Bottom edge of the fixed top bar, in viewport pixels. 0 when there is none on screen
 * (streamer mode hides it, and pages without the app shell do not have it).
 */
export function measureTopInset(): number {
	if (typeof document === 'undefined') return 0;

	const bar = document.querySelector<HTMLElement>(TOP_BAR_SELECTOR);
	if (!bar) return 0;

	const rect = bar.getBoundingClientRect();
	if (rect.height <= 0) return 0;

	return Math.max(0, Math.round(rect.bottom));
}

export function measureFloatFrame(): FloatFrame {
	if (typeof window === 'undefined') {
		return { width: 0, height: 0, topInset: 0 };
	}
	return { width: window.innerWidth, height: window.innerHeight, topInset: measureTopInset() };
}

function scrollsOnAxis(overflow: string, content: number, box: number): boolean {
	return (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') && content > box + 1;
}

/**
 * Overlay scrollbars (macOS, some Linux setups) take no room, so the gutter measures 0.
 * This strip along the edge is kept for them: wide enough for the thumb Chrome draws
 * on hover, narrow enough that a row stays grabbable almost to its end.
 */
const OVERLAY_SCROLLBAR_PX = 16;

export const domDragEnv: DragTargetEnv = {
	scrolls(node: Element) {
		if (typeof window === 'undefined' || !(node instanceof Element)) return false;
		const style = window.getComputedStyle(node);
		return (
			scrollsOnAxis(style.overflowY, node.scrollHeight, node.clientHeight) ||
			scrollsOnAxis(style.overflowX, node.scrollWidth, node.clientWidth)
		);
	},

	onScrollbar(node: Element, point: { x: number; y: number }) {
		if (typeof window === 'undefined' || !(node instanceof HTMLElement)) return false;
		const style = window.getComputedStyle(node);
		// A hidden scrollbar (the solves list hides its own) leaves nothing to press.
		if ((style as CSSStyleDeclaration & { scrollbarWidth?: string }).scrollbarWidth === 'none') return false;
		const rect = node.getBoundingClientRect();
		const borderLeft = parseFloat(style.borderLeftWidth) || 0;
		const borderRight = parseFloat(style.borderRightWidth) || 0;
		const borderTop = parseFloat(style.borderTopWidth) || 0;
		const borderBottom = parseFloat(style.borderBottomWidth) || 0;

		if (scrollsOnAxis(style.overflowY, node.scrollHeight, node.clientHeight)) {
			const gutter = node.offsetWidth - node.clientWidth - borderLeft - borderRight;
			if (point.x >= rect.right - borderRight - Math.max(gutter, OVERLAY_SCROLLBAR_PX)) return true;
		}
		if (scrollsOnAxis(style.overflowX, node.scrollWidth, node.clientWidth)) {
			const gutter = node.offsetHeight - node.clientHeight - borderTop - borderBottom;
			if (point.y >= rect.bottom - borderBottom - Math.max(gutter, OVERLAY_SCROLLBAR_PX)) return true;
		}
		return false;
	},
};
