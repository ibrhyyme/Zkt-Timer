import { classifyTouchTarget } from '../touch_target';

interface FakeNode {
	nodeName: string;
	classList: { contains: (className: string) => boolean };
	parentNode: FakeNode | null;
}

/**
 * Builds a fake element chain from the outermost ancestor to the touched node, so the
 * classifier can be exercised without jsdom (jest runs in the node environment here).
 * Each entry is `"class1 class2"`, optionally prefixed with a tag: `"button:zt-foo"`.
 */
function chain(...levels: string[]): FakeNode {
	let parent: FakeNode | null = null;

	for (const level of levels) {
		const [tagPart, classPart] = level.includes(':') ? level.split(':') : ['div', level];
		const classes = classPart.split(' ').filter(Boolean);

		const node: FakeNode = {
			nodeName: tagPart.toUpperCase(),
			classList: { contains: (className: string) => classes.indexOf(className) !== -1 },
			parentNode: parent,
		};

		parent = node;
	}

	return parent as FakeNode;
}

// Desktop layout: everything below hangs off the same `.zt-timer` root.
const desktopRoot = ['zt-timer', 'zt-timer__wrapper'];
const desktopMain = [...desktopRoot, 'zt-timer__timer-side', 'zt-timer__main', 'zt-timer__main-center'];

describe('classifyTouchTarget', () => {
	it('treats the time display as the start surface', () => {
		const info = classifyTouchTarget(chain(...desktopMain, 'zt-timer__main-time', 'zt-time-display', 'h1:'));

		expect(info).toEqual({
			blocked: false,
			insideTimer: true,
			onStartSurface: true,
			inNonStartIsland: false,
		});
	});

	it('keeps footer stat modules off the start surface', () => {
		const info = classifyTouchTarget(chain(...desktopRoot, 'zt-timer-footer', 'zt-timer-footer__body', 'zt-quick-stats-block'));

		expect(info.insideTimer).toBe(true);
		expect(info.onStartSurface).toBe(false);
		expect(info.blocked).toBe(false);
	});

	it('blocks buttons anywhere in the timer', () => {
		const info = classifyTouchTarget(chain(...desktopRoot, 'zt-timer-footer', 'button:zt-history__time'));

		expect(info.blocked).toBe(true);
	});

	it('keeps the desktop scramble off the start surface even though it sits inside main', () => {
		const info = classifyTouchTarget(chain(...desktopMain, 'zt-timer-scramble', 'zt-timer-scramble__body'));

		expect(info.insideTimer).toBe(true);
		expect(info.inNonStartIsland).toBe(true);
		expect(info.onStartSurface).toBe(false);
	});

	it('keeps the 3D smart cube off the start surface', () => {
		const info = classifyTouchTarget(
			chain(...desktopMain, 'zt-timer__main-time', 'zt-smart-cube', 'zt-smart-cube__cube', 'canvas:')
		);

		expect(info.insideTimer).toBe(true);
		expect(info.inNonStartIsland).toBe(true);
		expect(info.onStartSurface).toBe(false);
	});

	it('treats the mobile touch overlay as the start surface', () => {
		const info = classifyTouchTarget(chain('zt-timer', 'zt-timer__touch-overlay zt-timer__touch-overlay--active'));

		expect(info.insideTimer).toBe(true);
		expect(info.onStartSurface).toBe(true);
	});

	it('blocks the mobile dashboard and stats bar', () => {
		const dashboard = classifyTouchTarget(chain('zt-timer', 'zt-timer__mobile-container', 'zt-timer-dashboard', 'zt-timer-dashboard__slot'));
		const statsBar = classifyTouchTarget(chain('zt-timer', 'zt-timer__mobile-container', 'zt-stats-bar', 'zt-stats-bar__item'));

		expect(dashboard.blocked).toBe(true);
		expect(statsBar.blocked).toBe(true);
	});

	it('blocks the mobile scramble text', () => {
		const info = classifyTouchTarget(chain('zt-timer', 'zt-mobile-timer-scramble', 'zt-mobile-timer-scramble__text'));

		expect(info.blocked).toBe(true);
	});

	it('reports elements outside the timer as outside', () => {
		const info = classifyTouchTarget(chain('zt-header-nav', 'zt-header-nav__link'));

		expect(info.insideTimer).toBe(false);
		expect(info.onStartSurface).toBe(false);
	});

	it('survives a null target', () => {
		expect(classifyTouchTarget(null).insideTimer).toBe(false);
	});
});
