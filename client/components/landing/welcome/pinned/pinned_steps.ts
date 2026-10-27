// The decisions behind a pinned, stepped scene on a wide screen (the chapters, the
// "what's in the app" cards), kept free of the DOM so they can be tested. The scene is
// sticky inside a tall track: one screen of scroll per step. Scroll position is only
// the state; what the visitor sees change is the step itself.

export interface SnapGeometry {
	/** Scroll position at which the scene pins (step 0). */
	start: number;
	/** Scroll distance from one step to the next: the pinned scene's height. */
	step: number;
	count: number;
}

// Rounding slack, in px: positions this close count as "on" a step.
const SLACK = 2;

export function stepOffset(g: SnapGeometry, index: number): number {
	return g.start + index * g.step;
}

export function lastOffset(g: SnapGeometry): number {
	return stepOffset(g, g.count - 1);
}

export function nearestStep(g: SnapGeometry, y: number): number {
	if (g.step <= 0) return 0;
	const index = Math.round((y - g.start) / g.step);
	return Math.max(0, Math.min(g.count - 1, index));
}

/** The scene is pinned (or within rounding of it). */
export function inPinnedRange(g: SnapGeometry, y: number): boolean {
	return y >= g.start - SLACK && y <= lastOffset(g) + SLACK;
}

/**
 * Scrolling came to rest between two steps (a dragged scrollbar, a touch fling on a
 * wide tablet): the scene should settle on the nearest one. The two ends are left
 * alone, so a visitor leaving the scene is never pulled back.
 */
export function needsSettle(g: SnapGeometry, y: number): boolean {
	if (y <= g.start + SLACK || y >= lastOffset(g) - SLACK) return false;
	return Math.abs(y - stepOffset(g, nearestStep(g, y))) > SLACK;
}

export type SnapAction = {type: 'pass'} | {type: 'block'} | {type: 'go'; index: number};

export interface SnapInput {
	g: SnapGeometry;
	y: number;
	/** 1 = towards the next step, -1 = back. */
	dir: 1 | -1;
	active: number;
	/** The scene has settled on a step since the visitor entered it. */
	engaged: boolean;
	/** A step is still playing out, or the same gesture is still sending events. */
	locked: boolean;
}

/**
 * What one wheel tick or key press does.
 * - pass: not ours; the page scrolls as usual (outside the scene, or past either end)
 * - block: swallow it; a step is under way and a trackpad's momentum must not set off
 *   a second one
 * - go: move to that step
 *
 * Entering the scene first settles on the nearest step and absorbs the rest of that
 * gesture, so a fast scroll in never skips the first (or, coming back up, the last)
 * step.
 */
export function snapAction({g, y, dir, active, engaged, locked}: SnapInput): SnapAction {
	if (!inPinnedRange(g, y)) return {type: 'pass'};
	if (locked) return {type: 'block'};
	if (!engaged) return {type: 'go', index: nearestStep(g, y)};
	const next = active + dir;
	if (next < 0 || next >= g.count) return {type: 'pass'};
	return {type: 'go', index: next};
}
