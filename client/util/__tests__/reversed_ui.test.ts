import * as fs from 'fs';
import * as path from 'path';
import { inReversedFrame, isUiReversed, orientDelta, reversedPlacement, toReaderPoint } from '../reversed-ui';

describe('reversed UI helpers', () => {
	it('flips popper placement for a trigger inside the rotated timer', () => {
		expect(reversedPlacement('bottom', 'start', true)).toEqual({ side: 'top', align: 'end' });
		expect(reversedPlacement('bottom', 'end', true)).toEqual({ side: 'top', align: 'start' });
		expect(reversedPlacement('bottom', 'center', true)).toEqual({ side: 'top', align: 'center' });
		expect(reversedPlacement('left', 'start', true)).toEqual({ side: 'right', align: 'end' });
	});

	it('leaves placement alone when upright', () => {
		expect(reversedPlacement('bottom', 'start', false)).toEqual({ side: 'bottom', align: 'start' });
	});

	it('turns touch deltas into the reader frame', () => {
		expect(orientDelta(10, -60, false)).toEqual([10, -60]);
		expect(orientDelta(10, -60, true)).toEqual([-10, 60]);
	});

	it('turns touch points into the reader frame (the viewport turned about its centre)', () => {
		expect(toReaderPoint(30, 100, 400, 800, false)).toEqual([30, 100]);
		expect(toReaderPoint(30, 100, 400, 800, true)).toEqual([370, 700]);
		// A notch dragged physically to 25 % height sits at 75 % in the drawer's own frame.
		expect((toReaderPoint(390, 200, 400, 800, true)[1] / 800) * 100).toBe(75);
	});

	it('finds rotated frames by ancestry', () => {
		expect(inReversedFrame({ closest: () => ({}) })).toBe(true);
		expect(inReversedFrame({ closest: () => null })).toBe(false);
		expect(inReversedFrame(null)).toBe(false);
		expect(inReversedFrame({})).toBe(false);
	});

	it('counts the edge drawers as rotated frames', () => {
		// A popover opened from inside a drawer has to flip like one opened from the timer.
		const inDrawer = { closest: (sel: string) => (sel.split(', ').includes('body.zt-reversed .zt-edge-drawer__drawer') ? {} : null) };
		expect(inReversedFrame(inDrawer)).toBe(true);
	});

	it('is never reversed without a document (SSR, node)', () => {
		expect(isUiReversed()).toBe(false);
	});
});

describe('safe-area insets follow reversed use', () => {
	// Rotated surfaces must read insets through sa() (styles/config.scss), or the notch
	// padding stays on the physical top edge, which is the reader's bottom when reversed.
	const root = path.join(__dirname, '..', '..');
	const converted = [
		'components/timer/header_control/HeaderControl.scss',
		'components/timer/StatsBar.scss',
		'components/timer/MobileTimerScramble.scss',
		'components/modules/history/history_modal/HistoryModal.scss',
		'components/solve_info/SolveInfo.scss',
	];

	it.each(converted)('%s has no raw safe-area env()', (file) => {
		const scss = fs.readFileSync(path.join(root, file), 'utf8');
		expect(scss).not.toMatch(/env\(safe-area-inset-/);
		expect(scss).toMatch(/sa\((top|bottom)/);
	});

	it('Timer.scss keeps only the desktop root inset raw (mobile overrides that padding)', () => {
		const scss = fs.readFileSync(path.join(root, 'components/timer/Timer.scss'), 'utf8');
		const raw = scss.match(/env\(safe-area-inset-[a-z]+[^)]*\)/g) || [];
		expect(raw).toEqual(['env(safe-area-inset-bottom)']);
	});
});
