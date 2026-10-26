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
 * answer to createSolve, so a solve stayed blank until that answer arrived: about a second
 * online, until the queue reached the server offline. The analysis code is shared
 * (shared/util/solve/solve_steps.ts) and is the same the server runs, so the device works it
 * out itself from the moves it recorded, when the solve is stored.
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
 * The breakdown of a solve that is about to be stored, worked out from its own moves.
 * createSolveDb puts it into the row it inserts, so the solve card, the phase analysis
 * module and the finished ladder all have it in the render that shows the solve.
 *
 * It used to be worked out only when the server could not be reached; online, every one
 * of them waited for createSolve's answer and drew the solve with empty phases first,
 * about a second on a phone. The save runs after the stop has painted
 * (timer/helpers/events.ts), so this costs the final time on screen nothing.
 */
export function localStepRowsForNewSolve(solve: Solve, method?: string | null): Solve['solve_method_steps'] | null {
	if (!solveNeedsStepRows(solve as any, canUseSmartAnalysis())) return null;

	const prepared = preparedRows.get(solve.id);
	if (prepared) {
		preparedRows.delete(solve.id);
		// Worked out from these very moves, scramble and outcome: use it rather than run the
		// same analysis twice.
		if (prepared.smartTurns === solve.smart_turns && prepared.scramble === solve.scramble && !solve.dnf) {
			return prepared.rows;
		}
	}

	try {
		return stepRowsForStoredSolve(solve as any, method || 'auto') as any;
	} catch (e) {
		console.error('[local-analysis] failed for', solve.id, e);
		return null;
	}
}

type PreparedRows = { smartTurns: string; scramble: string; rows: Solve['solve_method_steps'] };

// A smart cube solve's breakdown, worked out the moment the cube stops it, a few frames
// before the save makes the row. The finished ladder draws it in those frames and
// createSolveDb stores it, so the solve is analysed once.
const preparedRows = new Map<string, PreparedRows>();

/**
 * Works out a completed smart cube solve's breakdown ahead of its save (SmartCube, at the
 * stop). Returns the rows the save will store, or null when it will store none.
 */
export function prepareLocalStepRows(
	solve: Pick<Solve, 'id' | 'smart_turns' | 'scramble' | 'cube_type' | 'scramble_subset'>,
	method?: string | null
): Solve['solve_method_steps'] | null {
	const candidate = { ...solve, dnf: false, is_smart_cube: true, is_virtual_cube: false } as Solve;
	const rows = localStepRowsForNewSolve(candidate, method);
	if (!rows) return null;

	preparedRows.set(solve.id, { smartTurns: solve.smart_turns, scramble: solve.scramble, rows });
	// A save that never came (a crash in between) leaves its entry behind; keep only a few.
	if (preparedRows.size > 5) {
		preparedRows.delete(preparedRows.keys().next().value);
	}
	return rows;
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
