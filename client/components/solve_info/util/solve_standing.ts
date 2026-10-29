import {Solve} from '../../../../server/schemas/Solve.schema';

/** How many of the solves just before one its time is compared with, and the fewest that make a comparison. */
export const RECENT_COUNT = 12;
export const RECENT_MIN = 5;

export type SolveStanding =
	| {kind: 'pb'}
	/** `diff` is the solve's time minus the mean of the `count` solves before it: negative is faster. */
	| {kind: 'recent'; diff: number; count: number};

type Row = Pick<Solve, 'id' | 'time' | 'dnf' | 'ended_at'>;

function counted(solve: Row): boolean {
	// solve.time already includes a +2 (db/solves/update.tsx).
	return !solve.dnf && Number(solve.time) > 0;
}

/**
 * Where one solve stands, for the line under its time on the solve card.
 *
 * - `pb`: no other solve of its bucket, in any session, is faster. The same record the solve
 *   list highlights (History.tsx); a solve that ties it holds it too. Needs at least one
 *   other counted solve, or the first solve ever made would read as a record.
 * - `recent`: compared with the mean of the counted solves just before it in its session,
 *   up to RECENT_COUNT of them and at least RECENT_MIN.
 *
 * Null for a DNF, when there are too few solves to say anything, and when the difference
 * rounds to nothing.
 *
 * @param bucket the solves of its bucket (cube type and subset) across every session
 * @param session the solves of its bucket in its own session
 */
export function getSolveStanding(solve: Row, bucket: Row[], session: Row[]): SolveStanding | null {
	if (!counted(solve)) return null;
	const time = Number(solve.time);
	const endedAt = Number(solve.ended_at);

	const others = bucket.filter((s) => s.id !== solve.id && counted(s));
	if (others.length && others.every((s) => Number(s.time) >= time)) {
		return {kind: 'pb'};
	}

	const before = session
		.filter((s) => s.id !== solve.id && counted(s) && Number(s.ended_at) < endedAt)
		.sort((a, b) => Number(b.ended_at) - Number(a.ended_at))
		.slice(0, RECENT_COUNT);
	if (before.length < RECENT_MIN) return null;

	const mean = before.reduce((sum, s) => sum + Number(s.time), 0) / before.length;
	const diff = time - mean;
	// Shown to two decimals: "0.00 faster" says nothing.
	if (Math.abs(diff) < 0.005) return null;
	return {kind: 'recent', diff, count: before.length};
}
