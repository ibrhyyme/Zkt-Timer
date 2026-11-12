// Online score entry (ZKT), plan K10: tell a competition's delegates and
// organisers when a group's 3rd and 4th attempts are in. One notice per
// threshold, at most two per group, nothing in between.
//
// Pure, unit tested in __tests__/zkt_judge_progress.test.ts. The federation
// reports each group's level by the K4 rule (the same one ZKT Live's "Anlık
// durum" uses, computed on the site, never here); this file only decides which
// levels make a notice. cron_zkt_judge_progress.ts fetches, claims and sends.

/** One group as GET /api/internal/v1/judge/progress/ reports it. */
export interface JudgeProgressGroup {
	roundId: string;
	eventId: string;
	roundNumber: number;
	dualChance: boolean;
	/** The federation's group id, "" for cards without a group. */
	groupKey: string;
	groupNumber: number | null;
	chance: number;
	/** When the group's first card opened (ISO). A cleared round comes back with a new one. */
	since: string;
	attemptCount: number;
	/** K4: attempts every card still holding the group back has in. */
	level: number;
	/** The most attempts any present competitor of the group has in. */
	furthest: number;
}

export interface JudgeProgressCompetition {
	id: string;
	slug: string;
	name: string;
	/** The federation's User.ids of the delegates and organisers (Integration.zkt_user_id). */
	recipients: string[];
	groups: JudgeProgressGroup[];
}

export interface JudgeProgressFeed {
	competitions: JudgeProgressCompetition[];
}

/**
 * The attempt numbers that make a notice. K10 names the 3rd and the 4th of an
 * Ao5; the owner's rule for other formats (11 Nov) keeps the same place in the
 * round: 3/5 and 4/5 of the attempts, rounded up. Ao12: 8 and 10. Mo3/Bo3: 2
 * and 3. Bo2: 2. Bo1: 1. A format whose two places round to the same attempt
 * gets one notice.
 */
export function progressThresholds(attemptCount: number): number[] {
	if (!Number.isInteger(attemptCount) || attemptCount < 1) return [];
	const at = (num: number) => Math.min(attemptCount, Math.max(1, Math.ceil((attemptCount * num) / 5)));
	return [...new Set([at(3), at(4)])];
}

/**
 * The level that counts for a notice. A group whose only open cards are
 * absentees (or already with the desk) reports the format's level with nobody
 * having solved: `furthest` keeps that from reading as "4th attempts done".
 */
export function noticeLevel(group: Pick<JudgeProgressGroup, 'level' | 'furthest'>): number {
	return Math.max(0, Math.min(group.level, group.furthest));
}

export interface ProgressDecision {
	/** The threshold to notify, or null for nothing. */
	send: number | null;
	/** Thresholds to mark done without a notice of their own (passed in the same jump). */
	quiet: number[];
}

/**
 * What to do for one group now. `done` holds the thresholds already claimed,
 * by this server or another, before or after a restart. The level a group
 * reports can go down (a card opened late starts at 0); nothing already done
 * comes back, and a lower level never sends.
 *
 * When the level passes two thresholds at once (the last card holding the
 * group was accepted or marked absent), only the higher one goes and the lower
 * one is marked done with it (owner, 11 Nov): never two pushes in a row.
 */
export function decideProgress(thresholds: readonly number[], level: number, done: ReadonlySet<number>): ProgressDecision {
	const highestDone = Math.max(0, ...done);
	// Below a threshold already notified there is nothing left to say.
	const due = thresholds.filter((t) => t <= level && t > highestDone && !done.has(t));
	if (due.length === 0) return {send: null, quiet: []};
	const send = Math.max(...due);
	return {send, quiet: due.filter((t) => t !== send)};
}

/** The in-app path of the organisers' panel (it opens the running round by itself). */
export function judgeStaffPath(slug: string): string {
	return `/competitions/zkt-${slug}/judge/staff`;
}
