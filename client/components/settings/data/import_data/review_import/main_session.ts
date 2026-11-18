/**
 * The session an import offers as the new main session.
 *
 * An import never touches the main session (`session_id`), so after a backup lands the
 * timer keeps opening the empty default session the account got at signup, and a cuber
 * with 43k imported solves thinks the import lost them. The review screen offers the
 * imported session with the most solves; the box starts ticked only when that session is
 * bigger than the current main one, so an account that already solves here keeps its main.
 */

export interface MainSessionSuggestion {
	id: string;
	name: string;
	solveCount: number;
}

interface SessionLike {
	id?: string | null;
	name?: string | null;
}

interface SolveLike {
	session_id?: string | null;
}

/** The imported session holding the most solves (the first one on a tie), or null when none holds any. */
export function largestImportedSession(sessions: readonly SessionLike[], solves: readonly SolveLike[]): MainSessionSuggestion | null {
	const counts = new Map<string, number>();
	for (const solve of solves) {
		if (solve.session_id) counts.set(solve.session_id, (counts.get(solve.session_id) || 0) + 1);
	}

	let best: MainSessionSuggestion | null = null;
	for (const session of sessions) {
		if (!session.id) continue;
		const solveCount = counts.get(session.id) || 0;
		if (solveCount > 0 && (!best || solveCount > best.solveCount)) {
			best = {id: session.id, name: session.name || '', solveCount};
		}
	}
	return best;
}

/** Whether the "make it the main session" box starts ticked. */
export function suggestMainByDefault(suggestion: MainSessionSuggestion | null, currentMainSolveCount: number): boolean {
	return !!suggestion && suggestion.solveCount > currentMainSolveCount;
}
