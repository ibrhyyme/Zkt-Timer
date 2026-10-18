/**
 * Runs `fn` once the browser has had the chance to paint what the current task changed.
 *
 * A requestAnimationFrame callback runs right before a paint and a task queued from it runs
 * after it. A hidden page gets no frames at all, so a plain timer runs `fn` anyway after
 * `fallbackMs`: work handed to this must never wait for the page to come back. Whichever
 * fires first wins, and `fn` runs once. Without requestAnimationFrame (server, tests) it is a
 * zero timeout.
 */
export function afterNextPaint(fn: () => void, fallbackMs = 100): void {
	let done = false;
	const run = () => {
		if (done) return;
		done = true;
		fn();
	};

	const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null;
	if (!raf) {
		setTimeout(run, 0);
		return;
	}

	raf(() => setTimeout(run, 0));
	setTimeout(run, fallbackMs);
}
