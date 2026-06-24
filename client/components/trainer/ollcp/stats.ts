/**
 * OLLCP recognition accuracy store — now server-backed (per-user) so the user's two devices share
 * one tally. Kept behind the same sync API (getAccuracy/recordAccuracy/accuracyPct) so callers are
 * unchanged. Reads come from an in-memory cache (filled by loadOllcpStats on mode entry); writes
 * update the cache immediately and fire-and-forget a mutation. Legacy device-local `ollcp_acc-`
 * localStorage data is merged into the server once (additively), then dropped.
 */
import {useEffect, useState} from 'react';
import {gql} from '@apollo/client';
import {gqlQuery, gqlMutate} from '../../api';

export interface Accuracy {
	/** Correct count. */
	c: number;
	/** Total attempts. */
	t: number;
}

const LEGACY_PREFIX = 'ollcp_acc-';
const SYNCED_FLAG = 'ollcp_acc_synced';

const MY_OLLCP_STATS = gql`
	query MyOllcpStats {
		myOllcpStats {
			alg_id
			correct
			total
		}
	}
`;

const RECORD_OLLCP = gql`
	mutation RecordOllcpAttempt($algId: String!, $correct: Boolean!) {
		recordOllcpAttempt(algId: $algId, correct: $correct) {
			alg_id
			correct
			total
		}
	}
`;

const MERGE_OLLCP = gql`
	mutation MergeOllcpStats($entries: [OllcpStatInput!]!) {
		mergeOllcpStats(entries: $entries)
	}
`;

// In-memory cache: algId → {c,t}. getAccuracy reads this synchronously.
const cache = new Map<string, Accuracy>();

// Version listeners (React subscribers re-render on change). Plain set avoids window/SSR coupling.
const listeners = new Set<() => void>();
function emit() {
	listeners.forEach((l) => l());
}

let loading = false;

export function getAccuracy(algId: string): Accuracy {
	return cache.get(algId) ?? {c: 0, t: 0};
}

export function recordAccuracy(algId: string, correct: boolean): void {
	const prev = cache.get(algId) ?? {c: 0, t: 0};
	cache.set(algId, {c: prev.c + (correct ? 1 : 0), t: prev.t + 1});
	emit();
	if (typeof window === 'undefined') return;
	// Fire-and-forget; the cache already reflects this increment.
	gqlMutate(RECORD_OLLCP, {algId, correct}).catch(() => {});
}

/** Percentage 0..100 or null when never attempted. */
export function accuracyPct(a: Accuracy): number | null {
	return a.t > 0 ? Math.round((a.c / a.t) * 100) : null;
}

// Collect this device's legacy localStorage accuracy as merge entries.
function collectLegacy(): {alg_id: string; correct: number; total: number}[] {
	const out: {alg_id: string; correct: number; total: number}[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const k = localStorage.key(i);
		if (!k || !k.startsWith(LEGACY_PREFIX)) continue;
		const raw = localStorage.getItem(k);
		if (!raw) continue;
		const [c, t] = raw.split(',').map((n) => parseInt(n, 10) || 0);
		if (t > 0) out.push({alg_id: k.slice(LEGACY_PREFIX.length), correct: c, total: t});
	}
	return out;
}

/**
 * Load server tallies into the cache (runs on OLLCP mode entry). On first run for a device, the
 * legacy localStorage data is additively merged into the server, then those keys are cleared and a
 * synced flag is set — so each device pushes its own counts exactly once and the totals add up
 * server-side. Local keys are dropped only AFTER the merge succeeds (no data loss on network error).
 */
export async function loadOllcpStats(): Promise<void> {
	if (typeof window === 'undefined' || loading) return;
	loading = true;
	try {
		if (!localStorage.getItem(SYNCED_FLAG)) {
			const entries = collectLegacy();
			if (entries.length) {
				await gqlMutate(MERGE_OLLCP, {entries});
				for (const e of entries) localStorage.removeItem(LEGACY_PREFIX + e.alg_id);
			}
			localStorage.setItem(SYNCED_FLAG, '1');
		}
		const res = await gqlQuery(MY_OLLCP_STATS, undefined, 'no-cache');
		const rows: {alg_id: string; correct: number; total: number}[] = res?.data?.myOllcpStats ?? [];
		cache.clear();
		for (const r of rows) cache.set(r.alg_id, {c: r.correct, t: r.total});
		emit();
	} catch {
		// Network/permission error → keep whatever is cached; retried on next mode entry.
	} finally {
		loading = false;
	}
}

/** Re-renders the caller whenever the accuracy cache changes (record/merge/load). */
export function useOllcpStatsVersion(): number {
	const [v, setV] = useState(0);
	useEffect(() => {
		const l = () => setV((n) => n + 1);
		listeners.add(l);
		return () => {
			listeners.delete(l);
		};
	}, []);
	return v;
}
