/**
 * OLLCP recognition accuracy store. Separate from the trainer's time stats (own `ollcp_acc-`
 * localStorage keys) so marking ✓/✗ here never pollutes the Standard trainer's OLLCP best/Ao5.
 * Keyed by the variant's algId (algToId), so each OLLCP case has its own correct/total tally.
 */

export interface Accuracy {
	/** Correct count. */
	c: number;
	/** Total attempts. */
	t: number;
}

const key = (algId: string) => `ollcp_acc-${algId}`;

export function getAccuracy(algId: string): Accuracy {
	if (typeof window === 'undefined') return {c: 0, t: 0};
	try {
		const raw = localStorage.getItem(key(algId));
		if (!raw) return {c: 0, t: 0};
		const [c, t] = raw.split(',').map((n) => parseInt(n, 10) || 0);
		return {c, t};
	} catch {
		return {c: 0, t: 0};
	}
}

export function recordAccuracy(algId: string, correct: boolean): void {
	if (typeof window === 'undefined') return;
	try {
		const {c, t} = getAccuracy(algId);
		localStorage.setItem(key(algId), `${c + (correct ? 1 : 0)},${t + 1}`);
	} catch {
		/* ignore quota/availability errors */
	}
}

/** Percentage 0..100 or null when never attempted. */
export function accuracyPct(a: Accuracy): number | null {
	return a.t > 0 ? Math.round((a.c / a.t) * 100) : null;
}
