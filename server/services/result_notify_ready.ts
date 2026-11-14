// When "your result is in" (and its follower copy) may go out for one result.
//
// Since 2026-11-14 a ZKT judge's phone writes every attempt into the official
// result the moment it lands (federation lib/zkt/judge/official.ts). On a ZKT
// round a result with one attempt is therefore a card still being solved: the
// push waits for the full card, or for the round to finish (a missed cutoff
// never fills the card). WCA Live is entered card by card at the desk, so a WCA
// round keeps the old rule: the first result with a best.

export function resultReadyToNotify(
	result: {best: number; attempts: {result: number}[]},
	round: {finished: boolean; numberOfAttempts: number},
	zkt: boolean
): boolean {
	if (!result.best || result.best <= 0) return false;
	if (!zkt || round.finished) return true;
	const filled = result.attempts.filter((a) => a.result !== 0).length;
	return filled >= round.numberOfAttempts;
}
