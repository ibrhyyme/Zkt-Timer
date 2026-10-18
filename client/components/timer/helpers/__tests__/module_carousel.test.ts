import { TimerModuleType } from '../../@types/enums';
import { MOBILE_MODULE_OPTIONS } from '../../@types/mobile_modules';
import {
	sanitizeMobileModules,
	slotPages,
	neighbourModule,
	lockAxis,
	dragOffset,
	settleSwipe,
	isSwipeTarget,
	NO_SWIPE_ATTRIBUTE,
	SWIPE_THROUGH_ATTRIBUTE,
	DEFAULT_MOBILE_MODULES,
} from '../module_carousel';

const { HISTORY, SCRAMBLE, CROSS_SOLVER, SOLVE_GRAPH, TIME_DISTRO, PHASE_ANALYSIS, STATS } = TimerModuleType;

describe('sanitizeMobileModules', () => {
	it('keeps a valid, distinct pair', () => {
		expect(sanitizeMobileModules([CROSS_SOLVER, SOLVE_GRAPH])).toEqual([CROSS_SOLVER, SOLVE_GRAPH]);
	});

	it('falls back to the defaults for nothing stored', () => {
		expect(sanitizeMobileModules(undefined)).toEqual(DEFAULT_MOBILE_MODULES);
		expect(sanitizeMobileModules([])).toEqual(DEFAULT_MOBILE_MODULES);
		expect(sanitizeMobileModules('history')).toEqual(DEFAULT_MOBILE_MODULES);
	});

	it('moves the right slot off a duplicate, left slot wins', () => {
		expect(sanitizeMobileModules([SCRAMBLE, SCRAMBLE])).toEqual([SCRAMBLE, HISTORY]);
		expect(sanitizeMobileModules([HISTORY, HISTORY])).toEqual([HISTORY, SCRAMBLE]);
	});

	it('replaces a module that is not offered on mobile', () => {
		expect(sanitizeMobileModules([STATS, TIME_DISTRO])).toEqual([HISTORY, TIME_DISTRO]);
		expect(sanitizeMobileModules([TIME_DISTRO, STATS])).toEqual([TIME_DISTRO, SCRAMBLE]);
	});

	it('never returns the same module twice for any stored pair', () => {
		for (const a of [...MOBILE_MODULE_OPTIONS, STATS, null]) {
			for (const b of [...MOBILE_MODULE_OPTIONS, STATS, null]) {
				const [left, right] = sanitizeMobileModules([a, b]);
				expect(left).not.toBe(right);
				expect(MOBILE_MODULE_OPTIONS).toContain(left);
				expect(MOBILE_MODULE_OPTIONS).toContain(right);
			}
		}
	});
});

describe('slot pages', () => {
	it('skips the module the other slot shows', () => {
		const pages = slotPages(SCRAMBLE);
		expect(pages).not.toContain(SCRAMBLE);
		expect(pages).toHaveLength(MOBILE_MODULE_OPTIONS.length - 1);
	});

	it('steps over the other slot module to the one after it', () => {
		// order: history, scramble, cross solver, ...
		expect(neighbourModule(HISTORY, SCRAMBLE, 1)).toBe(CROSS_SOLVER);
		expect(neighbourModule(CROSS_SOLVER, SCRAMBLE, -1)).toBe(HISTORY);
	});

	it('stops at both ends instead of wrapping', () => {
		expect(neighbourModule(HISTORY, SCRAMBLE, -1)).toBeNull();
		expect(neighbourModule(PHASE_ANALYSIS, SCRAMBLE, 1)).toBeNull();
	});
});

describe('swipe gesture', () => {
	it('waits for enough travel before deciding', () => {
		expect(lockAxis(4, 3)).toBeNull();
	});

	it('reads a clearly sideways press as a swipe and a slanted one as a scroll', () => {
		expect(lockAxis(20, 4)).toBe('x');
		expect(lockAxis(12, 11)).toBe('y');
		expect(lockAxis(2, 30)).toBe('y');
	});

	it('resists toward an end with no page behind it', () => {
		expect(dragOffset(40, true, true)).toBe(40);
		expect(dragOffset(40, false, true)).toBe(10);
		expect(dragOffset(-40, true, false)).toBe(-10);
	});

	it('turns on a long drag or a flick, otherwise springs back', () => {
		// finger left = next page
		expect(settleSwipe(-60, 0, 160, true, true)).toBe(1);
		expect(settleSwipe(60, 0, 160, true, true)).toBe(-1);
		expect(settleSwipe(-30, -0.1, 160, true, true)).toBe(0);
		expect(settleSwipe(-30, -0.6, 160, true, true)).toBe(1);
		// a flick back against the drag does not turn
		expect(settleSwipe(-30, 0.6, 160, true, true)).toBe(0);
		// nothing there
		expect(settleSwipe(-100, -1, 160, true, false)).toBe(0);
		expect(settleSwipe(0, 0, 160, true, true)).toBe(0);
	});
});

describe('isSwipeTarget', () => {
	interface FakeNode {
		nodeType: number;
		nodeName: string;
		parentNode: FakeNode | null;
		attrs: Record<string, string>;
		scrollsX?: boolean;
		getAttribute(name: string): string | null;
	}

	function node(nodeName: string, parent: FakeNode | null, extra: Partial<FakeNode> = {}): FakeNode {
		const n: FakeNode = {
			nodeType: 1,
			nodeName,
			parentNode: parent,
			attrs: {},
			getAttribute(name: string) {
				return name in this.attrs ? this.attrs[name] : null;
			},
			...extra,
		};
		return n;
	}

	const env = { scrollsX: (n: any) => !!n.scrollsX };

	it('pages from the module surface, a list row and a button in it', () => {
		const frame = node('DIV', null);
		const list = node('DIV', frame);
		const row = node('DIV', list);
		const button = node('BUTTON', row);
		expect(isSwipeTarget(row, frame, env)).toBe(true);
		expect(isSwipeTarget(button, frame, env)).toBe(true);
	});

	it('leaves the 3D cube, inputs and sideways scrollers alone', () => {
		const frame = node('DIV', null);
		expect(isSwipeTarget(node('TWISTY-PLAYER', frame), frame, env)).toBe(false);
		expect(isSwipeTarget(node('INPUT', frame), frame, env)).toBe(false);
		const scroller = node('DIV', frame, { scrollsX: true });
		expect(isSwipeTarget(node('SPAN', scroller), frame, env)).toBe(false);
		const optedOut = node('DIV', frame, { attrs: { [NO_SWIPE_ATTRIBUTE]: '' } });
		expect(isSwipeTarget(optedOut, frame, env)).toBe(false);
	});

	it('pages over a cube player drawn as a 2D picture', () => {
		const frame = node('DIV', null);
		const picture = node('TWISTY-PLAYER', frame, { attrs: { [SWIPE_THROUGH_ATTRIBUTE]: '' } });
		expect(isSwipeTarget(picture, frame, env)).toBe(true);
		// The opt-in only lifts the tag rule; an opt-out region around it still wins.
		const optedOut = node('DIV', frame, { attrs: { [NO_SWIPE_ATTRIBUTE]: '' } });
		const inside = node('TWISTY-PLAYER', optedOut, { attrs: { [SWIPE_THROUGH_ATTRIBUTE]: '' } });
		expect(isSwipeTarget(inside, frame, env)).toBe(false);
	});

	it('ignores a target outside the frame (portal)', () => {
		const frame = node('DIV', null);
		const elsewhere = node('DIV', null);
		expect(isSwipeTarget(elsewhere, frame, env)).toBe(false);
	});
});
