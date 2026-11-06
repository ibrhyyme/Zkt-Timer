import React from 'react';
import {renderToString} from 'react-dom/server';
import {useSheetDrag} from '../useSheetDrag';

const SLIDE_OUT_MS = 220;
const SHEET_TOP = 100;
const SHEET_BOTTOM = 800;

type Listener = (e: any) => void;

function makeSheet() {
	const listeners: Record<string, Listener> = {};
	return {
		listeners,
		scrollTop: 0,
		parentElement: null,
		style: {transition: '', transform: '', pointerEvents: ''},
		getBoundingClientRect: () => ({top: SHEET_TOP, bottom: SHEET_BOTTOM}),
		closest: () => null,
		addEventListener: (type: string, fn: Listener) => {
			listeners[type] = fn;
		},
		removeEventListener: (type: string) => {
			delete listeners[type];
		},
	};
}

type Sheet = ReturnType<typeof makeSheet>;

function makeTarget(sheet: Sheet, kind: 'plain' | 'interactive' | 'handle' = 'plain', scrollTop = 0) {
	return {
		scrollTop,
		parentElement: sheet,
		closest: (selector: string) => {
			if (selector === '[data-sheet-handle]') return kind === 'handle' ? {} : null;
			return kind === 'interactive' ? {} : null;
		},
	};
}

// useEffect does not run under renderToString, so it runs by hand here: the listeners are what
// is being tested.
function mount(sheet: Sheet, onDismiss: () => void, enabled = true) {
	const cleanups: Array<() => void> = [];
	const effect = jest.spyOn(React, 'useEffect').mockImplementation((fn: any) => {
		const cleanup = fn();
		if (cleanup) cleanups.push(cleanup);
	});
	function Probe() {
		useSheetDrag({current: sheet as any}, onDismiss, enabled);
		return null;
	}
	renderToString(React.createElement(Probe));
	effect.mockRestore();
	return () => cleanups.forEach((c) => c());
}

function touch(sheet: Sheet, type: string, target: object, clientY: number, timeStamp: number) {
	sheet.listeners[type]({
		target,
		timeStamp,
		touches: [{clientY}],
		preventDefault: () => undefined,
	});
}

function pull(sheet: Sheet, target: object, fromY: number, toY: number, durationMs: number) {
	touch(sheet, 'touchstart', target, fromY, 0);
	touch(sheet, 'touchmove', target, toY, durationMs);
	sheet.listeners.touchend({target, timeStamp: durationMs, touches: []});
}

function click(sheet: Sheet, target: object, clientY: number, timeStamp = 100000) {
	sheet.listeners.click({target, clientY, timeStamp});
}

describe('useSheetDrag', () => {
	beforeEach(() => {
		(jest.useFakeTimers as unknown as (config: {legacyFakeTimers: boolean}) => void)({legacyFakeTimers: true});
	});
	afterEach(() => {
		jest.useRealTimers();
	});

	function setup() {
		const sheet = makeSheet();
		const onDismiss = jest.fn();
		const unmount = mount(sheet, onDismiss);
		return {sheet, onDismiss, unmount};
	}

	function settle() {
		jest.advanceTimersByTime(SLIDE_OUT_MS);
	}

	describe('tap', () => {
		it('closes on the handle, sliding out first', () => {
			const {sheet, onDismiss} = setup();
			click(sheet, makeTarget(sheet, 'handle'), SHEET_TOP + 10);
			expect(sheet.style.transform).toBe('translateY(100%)');
			expect(onDismiss).not.toHaveBeenCalled();
			settle();
			expect(onDismiss).toHaveBeenCalledTimes(1);
		});

		it('closes on the handle from a keyboard press, whose click has no position', () => {
			const {sheet, onDismiss} = setup();
			click(sheet, makeTarget(sheet, 'handle'), 0);
			settle();
			expect(onDismiss).toHaveBeenCalledTimes(1);
		});

		it('closes on the grabber row of a sheet whose body draws a plain grabber', () => {
			const {sheet, onDismiss} = setup();
			click(sheet, makeTarget(sheet), SHEET_TOP + 20);
			settle();
			expect(onDismiss).toHaveBeenCalledTimes(1);
		});

		it('leaves the sheet open below the grabber row', () => {
			const {sheet, onDismiss} = setup();
			click(sheet, makeTarget(sheet), SHEET_TOP + 40);
			settle();
			expect(onDismiss).not.toHaveBeenCalled();
		});

		it('ignores a click from code on the content, which reports position 0', () => {
			const {sheet, onDismiss} = setup();
			click(sheet, makeTarget(sheet), 0);
			settle();
			expect(onDismiss).not.toHaveBeenCalled();
		});

		it('leaves a control in the top row to its own click', () => {
			const {sheet, onDismiss} = setup();
			click(sheet, makeTarget(sheet, 'interactive'), SHEET_TOP + 20);
			settle();
			expect(onDismiss).not.toHaveBeenCalled();
		});

		it('leaves scrolled content in the top row alone', () => {
			const {sheet, onDismiss} = setup();
			click(sheet, makeTarget(sheet, 'plain', 200), SHEET_TOP + 20);
			settle();
			expect(onDismiss).not.toHaveBeenCalled();
		});

		it('closes once when tapped twice during the slide', () => {
			const {sheet, onDismiss} = setup();
			const handle = makeTarget(sheet, 'handle');
			click(sheet, handle, SHEET_TOP + 10);
			click(sheet, handle, SHEET_TOP + 10);
			settle();
			expect(onDismiss).toHaveBeenCalledTimes(1);
		});

		it('does not close from the click a short pull ends in', () => {
			const {sheet, onDismiss} = setup();
			const handle = makeTarget(sheet, 'handle');
			pull(sheet, handle, SHEET_TOP + 10, SHEET_TOP + 40, 1000);
			click(sheet, handle, SHEET_TOP + 40, 1010);
			settle();
			expect(onDismiss).not.toHaveBeenCalled();
			expect(sheet.style.transform).toBe('');
		});

		it('closes on a later press after a short pull sprang back', () => {
			const {sheet, onDismiss} = setup();
			const handle = makeTarget(sheet, 'handle');
			pull(sheet, handle, SHEET_TOP + 10, SHEET_TOP + 40, 1000);
			click(sheet, handle, 0, 5000);
			settle();
			expect(onDismiss).toHaveBeenCalledTimes(1);
		});

		it('takes no more presses while sliding out', () => {
			const {sheet} = setup();
			click(sheet, makeTarget(sheet, 'handle'), SHEET_TOP + 10);
			expect(sheet.style.pointerEvents).toBe('none');
		});
	});

	describe('pull', () => {
		it('closes past the distance', () => {
			const {sheet, onDismiss} = setup();
			pull(sheet, makeTarget(sheet), SHEET_TOP + 10, SHEET_TOP + 200, 1000);
			settle();
			expect(onDismiss).toHaveBeenCalledTimes(1);
		});

		it('closes on a fast flick', () => {
			const {sheet, onDismiss} = setup();
			pull(sheet, makeTarget(sheet), SHEET_TOP + 10, SHEET_TOP + 70, 50);
			settle();
			expect(onDismiss).toHaveBeenCalledTimes(1);
		});

		it('springs back from a short slow pull', () => {
			const {sheet, onDismiss} = setup();
			pull(sheet, makeTarget(sheet), SHEET_TOP + 10, SHEET_TOP + 50, 1000);
			settle();
			expect(onDismiss).not.toHaveBeenCalled();
			expect(sheet.style.transform).toBe('');
		});

		it('takes the handle even though it is a button and the content is scrolled', () => {
			const {sheet, onDismiss} = setup();
			sheet.scrollTop = 300;
			pull(sheet, makeTarget(sheet, 'handle'), SHEET_TOP + 10, SHEET_TOP + 200, 1000);
			settle();
			expect(onDismiss).toHaveBeenCalledTimes(1);
		});

		it('leaves a pull on scrolled content to the scroll', () => {
			const {sheet, onDismiss} = setup();
			sheet.scrollTop = 300;
			pull(sheet, makeTarget(sheet), SHEET_TOP + 50, SHEET_TOP + 300, 1000);
			settle();
			expect(onDismiss).not.toHaveBeenCalled();
			expect(sheet.style.transform).toBe('');
		});

		it('leaves a pull that starts on a control or below the strip', () => {
			const {sheet, onDismiss} = setup();
			pull(sheet, makeTarget(sheet, 'interactive'), SHEET_TOP + 10, SHEET_TOP + 200, 1000);
			pull(sheet, makeTarget(sheet), SHEET_TOP + 90, SHEET_TOP + 300, 1000);
			settle();
			expect(onDismiss).not.toHaveBeenCalled();
		});
	});

	describe('reversed use: the modal is turned 180 degrees', () => {
		beforeEach(() => {
			(global as any).document = {body: {classList: {contains: () => true}}};
		});
		afterEach(() => {
			delete (global as any).document;
		});

		it('closes on a pull up the screen, which is toward the reader', () => {
			const {sheet, onDismiss} = setup();
			pull(sheet, makeTarget(sheet), SHEET_BOTTOM - 10, SHEET_BOTTOM - 200, 1000);
			expect(sheet.style.transform).toBe('translateY(100%)');
			settle();
			expect(onDismiss).toHaveBeenCalledTimes(1);
		});

		it('follows the finger in the turned frame', () => {
			const {sheet} = setup();
			const target = makeTarget(sheet);
			touch(sheet, 'touchstart', target, SHEET_BOTTOM - 10, 0);
			touch(sheet, 'touchmove', target, SHEET_BOTTOM - 60, 500);
			expect(sheet.style.transform).toBe('translateY(50px)');
		});

		it('does not move on a pull the other way', () => {
			const {sheet} = setup();
			const target = makeTarget(sheet);
			touch(sheet, 'touchstart', target, SHEET_BOTTOM - 10, 0);
			touch(sheet, 'touchmove', target, SHEET_BOTTOM + 50, 500);
			expect(sheet.style.transform).toBe('');
		});

		it('measures the grabber row from the physical bottom edge', () => {
			const {sheet, onDismiss} = setup();
			click(sheet, makeTarget(sheet), SHEET_TOP + 10);
			settle();
			expect(onDismiss).not.toHaveBeenCalled();
			click(sheet, makeTarget(sheet), SHEET_BOTTOM - 10);
			settle();
			expect(onDismiss).toHaveBeenCalledTimes(1);
		});
	});

	it('does nothing when off', () => {
		const sheet = makeSheet();
		mount(sheet, jest.fn(), false);
		expect(Object.keys(sheet.listeners)).toEqual([]);
	});

	it('does not close after the sheet unmounts mid-slide', () => {
		const {sheet, onDismiss, unmount} = setup();
		click(sheet, makeTarget(sheet, 'handle'), SHEET_TOP + 10);
		unmount();
		settle();
		expect(onDismiss).not.toHaveBeenCalled();
		expect(Object.keys(sheet.listeners)).toEqual([]);
	});
});
