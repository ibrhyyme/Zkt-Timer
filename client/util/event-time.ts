/**
 * When an input event really happened, for timing a solve from it.
 *
 * e.timeStamp lives on the monotonic performance clock. On Android that clock stops while
 * the phone sleeps, so on a page kept open across screen locks performance.timeOrigin +
 * e.timeStamp falls behind Date.now() by the time slept. Mixing the two clocks made a
 * solve start on one clock while the running digits counted on the other: the digits ran
 * ahead by the drift and jumped back on the stop.
 *
 * So only the event's age is taken from the event, measured against performance.now() on
 * its own clock, where the drift cancels out. The age is then subtracted from whichever
 * clock the caller times with. That also keeps the iOS WKWebView case (an IPC delay that
 * can stamp the event after the handler already runs): a negative age counts as zero, so
 * the result is never later than now.
 */

/** Longest age still trusted as input lag; beyond it the stamp is treated as bogus. */
export const MAX_EVENT_AGE_MS = 2000;

/** How long ago the event happened, 0 when its stamp is unusable. */
export function eventAgeMs(eventTimeStamp: number, perfNow: number): number {
	const age = perfNow - eventTimeStamp;
	return Number.isFinite(age) && age > 0 && age <= MAX_EVENT_AGE_MS ? age : 0;
}

/** The event's moment on the Date.now() clock. */
export function eventWallTime(
	eventTimeStamp: number,
	wallNow: number = Date.now(),
	perfNow: number = performance.now()
): number {
	return Math.round(wallNow - eventAgeMs(eventTimeStamp, perfNow));
}

/** The event's moment on the performance.now() clock. */
export function eventMonotonicTime(eventTimeStamp: number, perfNow: number = performance.now()): number {
	return perfNow - eventAgeMs(eventTimeStamp, perfNow);
}
