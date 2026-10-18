import { getSolveDb } from './init';
import { emitEvent } from '../../util/event_handler';
import { requestPersist } from '../persist';
import { getStore } from '../../components/store';
import { isPro, isProEnabled } from '../../lib/pro';
import { getAllQueued } from '../../util/offline-queue';
import { solveNeedsStepRows, stepRowsForStoredSolve } from '../../../shared/util/solve/solve_steps';
import { Solve } from '../../../server/schemas/Solve.schema';

/**
 * The device's own breakdown of a smart or virtual cube solve.
 *
 * The breakdown (phases, solution, replay, charts) used to come only from the server's
 * answer to createSolve, so a solve timed without a connection stayed blank in the solve
 * card until the queue reached the server. The analysis code is shared
 * (shared/util/solve/solve_steps.ts) and is the same the server runs, so the phone works it
 * out itself from the moves it recorded.
 *
 * The server stays the authority: its answer replaces these rows the moment the solve
 * reaches it (applyCreatedSolve), and it recomputes from the moves rather than taking the
 * device's rows, so nothing here can write an analysis into the account.
 */

/** Same rule as the server's createSolve: smart cube analysis is Pro, virtual cube is open. */
function canUseSmartAnalysis(): boolean {
	if (!isProEnabled()) return true;
	try {
		return isPro(getStore()?.getState()?.account?.me);
	} catch {
		return false;
	}
}

// Moves the engine could not read are not tried again on every open of the same card.
const unreadable = new Set<string>();

/**
 * Works out and stores the breakdown of a stored solve that has moves but no steps.
 * Returns the stored row (updated or not), or null when the solve is not stored here.
 */
export function ensureLocalStepRows(solveId: string, method?: string | null, opts: { silent?: boolean } = {}): Solve | null {
	const db = getSolveDb();
	const row = db?.findOne({ id: solveId });
	if (!row) return null;
	if (unreadable.has(solveId) || !solveNeedsStepRows(row as any, canUseSmartAnalysis())) return row;

	let rows = null;
	try {
		rows = stepRowsForStoredSolve(row as any, method || 'auto');
	} catch (e) {
		console.error('[local-analysis] failed for', solveId, e);
	}
	if (!rows) {
		unreadable.add(solveId);
		return row;
	}

	// The server's answer may have landed while this ran: it is the authority, keep it.
	if (Array.isArray(row.solve_method_steps) && row.solve_method_steps.length > 0) return row;

	row.solve_method_steps = rows as any;
	db.update(row);
	if (!opts.silent) {
		emitEvent('solveDbUpdatedEvent', row);
		void requestPersist();
	}
	return row;
}

/**
 * The method the user had chosen when the solve was made, if its create is still queued.
 * The server analyses it with that method once it arrives; the device should match.
 */
export async function queuedAnalysisMethod(solveId: string): Promise<string | null> {
	try {
		const queued = await getAllQueued();
		const record = queued.find((m) => m.mutationName === 'createSolve' && m.variables?.input?.id === solveId);
		return record?.variables?.analysis_method || null;
	} catch {
		return null;
	}
}

/**
 * After the timer has painted: the analysis takes tens of milliseconds on a phone and must
 * not sit between the stop and the final time on screen.
 */
export function scheduleLocalStepRows(solveId: string, method?: string | null): void {
	if (typeof window === 'undefined') return;
	const run = () => {
		try {
			ensureLocalStepRows(solveId, method);
		} catch (e) {
			console.error('[local-analysis] scheduled run failed', e);
		}
	};
	const idle = (window as any).requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined;
	if (idle) {
		idle(run, { timeout: 2000 });
	} else {
		setTimeout(run, 50);
	}
}

const BACKFILL_LIMIT = 300;

/** A solve or its inspection is on the clock (same signal the persist scheduler waits on). */
function timerBusy(): boolean {
	try {
		const timer = getStore()?.getState()?.timer;
		return Boolean(timer?.solving || timer?.inInspection);
	} catch {
		return false;
	}
}

/**
 * Solves on this device that have moves but no breakdown: timed offline before this
 * existed, or ones whose server copy has none either. Runs after the server backfill, a few
 * at a time with a pause between, so a launch with many of them never freezes the app.
 */
export async function backfillLocalStepRows(): Promise<number> {
	const db = getSolveDb();
	if (!db) return 0;

	const allowSmart = canUseSmartAnalysis();
	const ids = db
		.where((s) => !!s.smart_turns)
		.filter((s) => solveNeedsStepRows(s as any, allowSmart) && !unreadable.has(s.id))
		.slice(0, BACKFILL_LIMIT)
		.map((s) => s.id);
	if (!ids.length) return 0;

	const queued = await getAllQueued().catch(() => []);
	const methodById = new Map<string, string>();
	for (const m of queued) {
		if (m.mutationName === 'createSolve' && m.variables?.input?.id && m.variables?.analysis_method) {
			methodById.set(m.variables.input.id, m.variables.analysis_method);
		}
	}

	let filled = 0;
	// Yield by elapsed time, not by count: one solve costs tens of milliseconds on a phone,
	// so a fixed batch of ten held the main thread for half a second at a time during boot.
	let sliceStart = Date.now();
	for (let i = 0; i < ids.length; i++) {
		// One analysis is a single task the browser cannot interrupt. Run during a solve or
		// inspection, it would hold back the touch or key that stops the timer by that long.
		while (timerBusy()) {
			await new Promise((r) => setTimeout(r, 500));
			sliceStart = Date.now();
		}
		const row = ensureLocalStepRows(ids[i], methodById.get(ids[i]), { silent: true });
		if (row && Array.isArray(row.solve_method_steps) && row.solve_method_steps.length) filled++;
		if (Date.now() - sliceStart >= 8) {
			await new Promise((r) => setTimeout(r, 16));
			sliceStart = Date.now();
		}
	}
	if (filled > 0) {
		emitEvent('solveDbUpdatedEvent', null);
		void requestPersist();
	}
	return filled;
}
