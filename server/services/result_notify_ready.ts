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

/**
 * A ZKT competitor judged on a phone card gets "RESMİ OLMAYAN SONUÇLARA GÖRE"
 * when the judge ends the card (zkt_judge_end.ts), so "your result is in" is
 * not sent to them as well (owner, 2026-11-15: the two went out almost
 * together with the same times). The round finished and results official
 * notices stay, and so does the follower copy. A card shows in `liveEntries`
 * while the round runs (both federation switches on); desk-only competitions
 * have none and keep the old notice.
 */
export function judgedOnPhone(
	result: {personLiveId?: string | null},
	round: {liveEntries?: {personLiveId?: string | null}[] | null}
): boolean {
	if (!result.personLiveId || !round.liveEntries) return false;
	return round.liveEntries.some((e) => e.personLiveId === result.personLiveId);
}
