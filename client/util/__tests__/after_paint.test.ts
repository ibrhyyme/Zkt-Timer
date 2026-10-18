import { afterNextPaint } from '../after-paint';

// A hand-run timer queue (the repo's tests do not use Jest's fake timers).
let timers: Array<{ fn: () => void; ms: number }> = [];
let timeoutSpy: jest.SpyInstance;

function runTimers(upTo: number) {
	const due = timers.filter((t) => t.ms <= upTo);
	timers = timers.filter((t) => t.ms > upTo);
	due.forEach((t) => t.fn());
}

beforeEach(() => {
	timers = [];
	timeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void, ms = 0) => {
		timers.push({ fn, ms });
		return 0;
	}) as any);
});

afterEach(() => {
	timeoutSpy.mockRestore();
	delete (global as any).requestAnimationFrame;
});

describe('afterNextPaint', () => {
	it('runs after the frame: a task queued from requestAnimationFrame', () => {
		const frames: Array<() => void> = [];
		(global as any).requestAnimationFrame = (cb: () => void) => frames.push(cb);
		const fn = jest.fn();

		afterNextPaint(fn);
		runTimers(0);
		expect(fn).not.toHaveBeenCalled();

		frames.forEach((cb) => cb());
		expect(fn).not.toHaveBeenCalled();
		runTimers(0);
		expect(fn).toHaveBeenCalledTimes(1);

		// The fallback timer does not run it a second time.
		runTimers(1000);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('still runs on a hidden page, where no frame comes', () => {
		(global as any).requestAnimationFrame = () => 0;
		const fn = jest.fn();

		afterNextPaint(fn, 100);
		runTimers(99);
		expect(fn).not.toHaveBeenCalled();
		runTimers(100);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('is a zero timeout without requestAnimationFrame', () => {
		const fn = jest.fn();
		afterNextPaint(fn);
		expect(fn).not.toHaveBeenCalled();
		runTimers(0);
		expect(fn).toHaveBeenCalledTimes(1);
	});
});
