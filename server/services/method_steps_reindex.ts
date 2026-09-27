import {Lock} from 'redlock';
import {getPrisma} from '../database';
import {logger} from './logger';
import {acquireRedisLock, createRedisKey, getValueFromRedis, RedisNamespace, setKeyInRedis} from './redis';
import {getSolveSteps} from '../util/solve/solve_method';
import {isKnownMethod} from '../../shared/util/solve/methods';
import {replaceSolveMethodSteps} from '../models/solve_method_step';
import {parseSmartTurns} from '../../shared/smart_cube/parse_turns';
import {countHTM} from '../../shared/util/solve/move_counter';
import {updateSolveLiteral} from '../models/solve';
import {updateSiteConfig} from '../models/site_config';

/**
 * Recalculates the method steps of every smart cube solve, as a background job.
 *
 * It used to run inside the admin's HTTP request. With ~37k smart solves in production
 * that takes many minutes: the proxy answered 504 after a minute while the server kept
 * working, the admin panel re-enabled its button, a second press started a second full
 * run in parallel, and all candidates (with their move strings) were loaded into memory
 * at once, twice. Now:
 * - the mutation starts the job and returns immediately;
 * - a Redis lock (extended every batch) allows one run across all app instances;
 * - candidates are read in id order, a batch at a time, so rows updated by the run
 *   itself cannot reorder what is left to read;
 * - progress and the final result live in Redis, where the admin panel polls them.
 *
 * Per solve:
 * - smart cube and virtual cube solves both carry smart_turns and both get a breakdown,
 *   so both are candidates;
 * - the method is detected from the solve ('auto'), falling back to the method it was
 *   already analysed with when detection is not confident;
 * - a completed solve whose moves lost a packet is analysed from the start derived from
 *   its moves (getSolveSteps endedSolved); a DNF never is;
 * - a solve without smart_turns is skipped, not downgraded: that is how every non-Pro
 *   smart solve is stored;
 * - smart_turns present but unreadable downgrades a smart solve to is_smart_cube=false;
 * - an engine failure keeps the steps the solve already has instead of wiping them.
 *
 * When the run completes, SiteConfig.method_steps_version is bumped so devices re-fetch
 * the breakdowns once: they only ever fetch solves they do not have yet.
 */

export interface MethodStepsReindexStatus {
	totalCandidates: number;
	processed: number;
	filled: number;
	skippedNoTurns: number;
	skippedAlreadyHasSteps: number;
	downgraded: number;
	error: number;
	methodChanged: number;
	running: boolean;
	startedAt: string | null;
	finishedAt: string | null;
}

// Every solve that carries moves the phase engine can break down.
const CANDIDATES = {OR: [{is_smart_cube: true}, {is_virtual_cube: true}]};

/**
 * Tells devices the stored breakdowns changed. Only after a run that reached the end:
 * a device that re-fetched in the middle of a run would store half-repaired data and,
 * with its version already caught up, never ask again.
 */
async function bumpMethodStepsVersion() {
	try {
		// From the row, not getSiteConfig(): a config cached before the column existed
		// would read as 0 and could move the version backwards.
		const row = await getPrisma().siteConfig.findUnique({
			where: {id: 'singleton'},
			select: {method_steps_version: true},
		});
		await updateSiteConfig({method_steps_version: (row?.method_steps_version || 0) + 1});
	} catch (e: any) {
		logger.warn('[MethodStepsReindex] could not bump method_steps_version', {error: e?.message});
	}
}

const LOCK_KEY = createRedisKey(RedisNamespace.PRO_DATA, 'method_steps_reindex_lock');
const STATUS_KEY = createRedisKey(RedisNamespace.PRO_DATA, 'method_steps_reindex_status');
// Extended after every batch; if the process dies the lock lapses on its own.
const LOCK_TTL_MS = 2 * 60 * 1000;
const BATCH_SIZE = 500;
// Long enough to read the result of last night's run the next day.
const STATUS_TTL_SECONDS = 7 * 24 * 60 * 60;

function emptyStatus(): MethodStepsReindexStatus {
	return {
		totalCandidates: 0,
		processed: 0,
		filled: 0,
		skippedNoTurns: 0,
		skippedAlreadyHasSteps: 0,
		downgraded: 0,
		error: 0,
		methodChanged: 0,
		running: true,
		startedAt: new Date().toISOString(),
		finishedAt: null,
	};
}

async function saveStatus(status: MethodStepsReindexStatus) {
	try {
		await setKeyInRedis(STATUS_KEY, JSON.stringify(status), STATUS_TTL_SECONDS);
	} catch (e: any) {
		logger.warn('[MethodStepsReindex] could not save status', {error: e?.message});
	}
}

export async function getMethodStepsReindexStatus(): Promise<MethodStepsReindexStatus | null> {
	try {
		const raw = await getValueFromRedis(STATUS_KEY);
		return raw ? (JSON.parse(raw) as MethodStepsReindexStatus) : null;
	} catch {
		return null;
	}
}

/**
 * Starts the job unless one is already running (on any instance). Returns the status the
 * panel should show: the fresh one, or the running job's.
 */
export async function startMethodStepsReindex(): Promise<MethodStepsReindexStatus> {
	const lock = await acquireRedisLock(LOCK_KEY, LOCK_TTL_MS);
	if (!lock) {
		const current = await getMethodStepsReindexStatus();
		// Locked but no readable status (Redis flushed mid-run): still report it as running
		return current && current.running ? current : {...emptyStatus(), startedAt: current?.startedAt ?? null};
	}

	const status = emptyStatus();
	await saveStatus(status);

	void runJob(lock, status);
	return status;
}

async function processOne(cand: any, status: MethodStepsReindexStatus) {
	if (!cand.smart_turns || typeof cand.smart_turns !== 'string') {
		status.skippedNoTurns++;
		return;
	}

	try {
		const turns = parseSmartTurns(cand.smart_turns);
		if (!turns.length) {
			if (cand.is_smart_cube) {
				// A turn string that parses to nothing is corrupt
				await updateSolveLiteral(cand.id, {is_smart_cube: false});
				status.downgraded++;
			} else {
				status.skippedNoTurns++;
			}
			return;
		}
		const storedMethod = cand.solve_method_steps?.[0]?.method_name;
		const fallback = isKnownMethod(storedMethod) ? storedMethod : undefined;
		const steps = getSolveSteps(turns, cand.scramble, 'auto', fallback, {endedSolved: !cand.dnf});
		if (!steps) {
			// The engine failed on these moves: the steps already stored stay.
			status.error++;
			return;
		}
		const newMethod = (steps as any).__method;
		if (storedMethod && newMethod && storedMethod !== newMethod) {
			status.methodChanged++;
		}
		await replaceSolveMethodSteps({id: cand.id}, steps);
		if (cand.is_smart_cube) {
			// Old solves may have null or incorrect smart_turn_count: recalculate with engine.
			// This is the single source of truth for all turn/TPS displays in the UI. A
			// virtual cube solve keeps the count its own recorder wrote.
			const htmCount = countHTM(turns.map((t) => t.turn));
			await updateSolveLiteral(cand.id, {smart_turn_count: htmCount});
		}
		status.filled++;
	} catch (e: any) {
		// Corrupted data: don't corrupt solve metadata, just skip it.
		console.warn(`[MethodStepsReindex] solve ${cand.id} skipped: ${e?.message}`);
		status.error++;
	}
}

async function runJob(initialLock: Lock, status: MethodStepsReindexStatus) {
	const prisma = getPrisma();
	let lock = initialLock;
	let cursor: string | undefined;

	let completed = false;

	try {
		status.totalCandidates = await prisma.solve.count({where: CANDIDATES});
		console.log(`[MethodStepsReindex] ${status.totalCandidates} candidate solves found`);
		await saveStatus(status);

		for (;;) {
			const batch: any[] = await prisma.solve.findMany({
				where: CANDIDATES,
				orderBy: {id: 'asc'},
				take: BATCH_SIZE,
				...(cursor ? {skip: 1, cursor: {id: cursor}} : {}),
				select: {
					id: true,
					smart_turns: true,
					scramble: true,
					dnf: true,
					is_smart_cube: true,
					// Every step row of a solve carries the same method_name; one is enough.
					solve_method_steps: {select: {method_name: true}, take: 1},
				},
			});
			if (!batch.length) break;

			for (const cand of batch) {
				status.processed++;
				await processOne(cand, status);
			}
			cursor = batch[batch.length - 1].id;

			// Losing the lock means another instance may now run the same job: stop here
			// rather than race it over the same rows.
			lock = await lock.extend(LOCK_TTL_MS);
			await saveStatus(status);
			console.log(`[MethodStepsReindex] ${status.processed}/${status.totalCandidates}...`);
		}
		completed = true;
		await bumpMethodStepsVersion();
	} catch (e: any) {
		logger.error('[MethodStepsReindex] job stopped', {error: e?.message, processed: status.processed, completed});
		status.error++;
	} finally {
		status.running = false;
		status.finishedAt = new Date().toISOString();
		await saveStatus(status);
		try {
			await lock.release();
		} catch {
			// Already expired; nothing to release
		}
		console.log(`[MethodStepsReindex] Done.`, status);
	}
}
