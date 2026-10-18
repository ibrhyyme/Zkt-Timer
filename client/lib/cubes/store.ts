import { useEffect, useState } from 'react';
import { emitEvent } from '../../util/event_handler';
import { getStore } from '../../components/store';
import {
	AUTO_MAIN_SET_AT_MS,
	CubeMains,
	CubeState,
	LocalCalibration,
	LocalCube,
	LocalMain,
	mergeMains,
	normalizeCalibration,
	normalizeCube,
	PendingCalibration,
	prunePendingCalibrations,
	sameCalibrationKey,
	toMs,
	withCalibration,
} from './active_cube';

/**
 * My Cubes state of the signed-in account (design 4.1): a module store, not a Redux slice (a
 * slice would need SSR initial state in server/router.tsx). Pattern of
 * client/util/magnet-start/status_store.ts.
 *
 * The state is mirrored to localStorage per account, so stamping solves, the main cube and the
 * calibration thresholds work offline from the first frame. sync.ts fills it from the server.
 * Every change notifies subscribers and emits `cubesUpdatedEvent`.
 */

export interface CubeStoreState extends CubeState {
	/** Account the state belongs to. null: nobody signed in (or SSR). */
	userId: string | null;
	/** Last successful server read (epoch ms). null: only the local copy so far. */
	fetchedAt: number | null;
}

const STORAGE_VERSION = 1;
const STORAGE_PREFIX = 'zkt_cubes:';

const EMPTY: CubeStoreState = Object.freeze({
	userId: null,
	fetchedAt: null,
	cubes: [],
	mains: {},
	pendingCalibrations: [],
}) as CubeStoreState;

let state: CubeStoreState = EMPTY;
const listeners = new Set<() => void>();

function storageKey(userId: string): string {
	return STORAGE_PREFIX + userId;
}

function currentUserId(): string | null {
	try {
		return getStore()?.getState()?.account?.me?.id || null;
	} catch {
		return null;
	}
}

function readStored(userId: string): CubeStoreState {
	const empty: CubeStoreState = { ...EMPTY, userId };
	try {
		const raw = window.localStorage.getItem(storageKey(userId));
		if (!raw) return empty;
		const parsed = JSON.parse(raw);
		if (!parsed || parsed.v !== STORAGE_VERSION) return empty;
		const cubes = Array.isArray(parsed.cubes)
			? parsed.cubes.map(normalizeCube).filter((c: LocalCube | null): c is LocalCube => !!c)
			: [];
		const mains: CubeMains = {};
		if (parsed.mains && typeof parsed.mains === 'object') {
			for (const [puzzle, entry] of Object.entries<any>(parsed.mains)) {
				const setAt = toMs(entry?.set_at);
				if (setAt === null) continue;
				mains[puzzle] = { cube_id: entry.cube_id || null, set_at: setAt, ...(entry.pending ? { pending: true } : {}) };
			}
		}
		const pendingCalibrations = Array.isArray(parsed.pendingCalibrations)
			? parsed.pendingCalibrations
				.map(normalizeCalibration)
				.filter((c: LocalCalibration | null): c is LocalCalibration => !!c)
				.map(({ id, pending, ...rest }: LocalCalibration) => rest)
			: [];
		return { userId, fetchedAt: toMs(parsed.fetchedAt), cubes, mains, pendingCalibrations };
	} catch {
		return empty;
	}
}

function writeStored(next: CubeStoreState): void {
	if (!next.userId) return;
	try {
		window.localStorage.setItem(
			storageKey(next.userId),
			JSON.stringify({
				v: STORAGE_VERSION,
				fetchedAt: next.fetchedAt,
				cubes: next.cubes,
				mains: next.mains,
				pendingCalibrations: next.pendingCalibrations,
			})
		);
	} catch {
		// Private mode or a full quota: the in-memory state still works for this session.
	}
}

/**
 * Loads the local copy when the signed-in account changed (first read, login, account switch).
 * Returns whether the state was replaced.
 */
function syncAccount(): boolean {
	if (typeof window === 'undefined') return false;
	const userId = currentUserId();
	if (userId === state.userId) return false;
	state = userId ? readStored(userId) : EMPTY;
	return true;
}

function notify(): void {
	listeners.forEach((listener) => listener());
	emitEvent('cubesUpdatedEvent');
}

function commit(next: CubeStoreState): CubeStoreState {
	state = next;
	writeStored(next);
	notify();
	return next;
}

/** Current state for the signed-in account. Empty on the server and for visitors. */
export function getCubeState(): CubeStoreState {
	if (syncAccount()) {
		// Not a change anyone caused: subscribers learn about it on their next read, and a
		// hook mounted later reads it directly. Notifying inside a getter could loop.
		queueMicrotask?.(notify);
	}
	return state;
}

export function subscribeCubes(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

// Server render has no cubes. The first client render must match it (hydrate), so a hook
// mounted during hydration starts empty and reads the real state in its effect; any hook
// mounted after that reads it at once.
let clientMounted = false;

/** The cube state, re-rendering on every change. Empty during SSR and hydration. */
export function useCubes(): CubeStoreState {
	const [value, setValue] = useState<CubeStoreState>(() =>
		clientMounted && typeof window !== 'undefined' ? getCubeState() : EMPTY
	);
	useEffect(() => {
		clientMounted = true;
		setValue(getCubeState());
		return subscribeCubes(() => setValue(getCubeState()));
	}, []);
	return value;
}

/** Drops the in-memory state (logout). The per-account local copy stays for the next login. */
export function resetCubeStore(): void {
	state = EMPTY;
	notify();
}

function mutate(change: (current: CubeStoreState) => CubeStoreState | null): CubeStoreState | null {
	const current = getCubeState();
	if (!current.userId) return null;
	const next = change(current);
	if (!next || next === current) return null;
	return commit(next);
}

/**
 * A server read (myCubeState): cubes replaced, mains merged by time (4.2), pending
 * measurements the server has caught up with dropped. Ignored when the account changed while
 * the request was in flight.
 */
export function applyServerCubeState(userId: string, cubesRaw: ReadonlyArray<any>, mainsRaw: ReadonlyArray<any>): void {
	mutate((current) => {
		if (current.userId !== userId) return null;
		const cubes = (cubesRaw || []).map(normalizeCube).filter((c): c is LocalCube => !!c);
		return {
			...current,
			fetchedAt: Date.now(),
			cubes,
			mains: mergeMains(current.mains, mainsRaw || []),
			pendingCalibrations: prunePendingCalibrations(current.pendingCalibrations, cubes),
		};
	});
}

/**
 * The person chose the main cube of a puzzle (or "no cube" with null). Applied at once and
 * marked pending; sync.ts sends it. Returns the entry, or null when nobody is signed in.
 */
export function setMainLocal(puzzle: string, cubeId: string | null, at: number = Date.now()): LocalMain | null {
	if (!puzzle) return null;
	// Never at or before an entry already held: two quick choices in the same millisecond, or a
	// clock that jumped back, must still let the latest one win.
	const prev = getCubeState().mains[puzzle];
	const entry: LocalMain = { cube_id: cubeId || null, set_at: Math.max(at, (prev?.set_at ?? 0) + 1), pending: true };
	const next = mutate((current) => ({ ...current, mains: { ...current.mains, [puzzle]: entry } }));
	return next ? entry : null;
}

/**
 * The server answered a setMainCube sent with `sentSetAt`. Its row is the truth unless the
 * person chose again meanwhile. The row's set_at may be earlier than the one sent (the server
 * clamps a clock that runs ahead), so the match is on what was sent, not on the times.
 */
export function resolveMainSent(puzzle: string, sentSetAt: number, row: { cube_id?: string | null; set_at?: unknown } | null): void {
	mutate((current) => {
		const entry = current.mains[puzzle];
		if (!entry || entry.set_at !== sentSetAt) return null;
		const mains = { ...current.mains };
		const setAt = toMs(row?.set_at) ?? sentSetAt;
		if (row && row.cube_id) mains[puzzle] = { cube_id: row.cube_id, set_at: setAt };
		else mains[puzzle] = { cube_id: null, set_at: setAt };
		return { ...current, mains };
	});
}

/** The server refused a main choice (cube archived or gone): forget it, the next read settles the puzzle. */
export function dropPendingMain(puzzle: string, sentSetAt: number): void {
	mutate((current) => {
		const entry = current.mains[puzzle];
		if (!entry || entry.set_at !== sentSetAt) return null;
		const mains = { ...current.mains };
		delete mains[puzzle];
		return { ...current, mains };
	});
}

/**
 * A cube the server returned (createCube, updateCube, setCubeArchived, ensureSmartCube).
 * Mirrors the server's main rules until the next read: the first active cube of a puzzle
 * becomes its main, `chosenMainAt` (the form's "make it my main", the set_at sent) makes it the
 * main unless a later choice exists, and an archived main is cleared.
 */
export function upsertCube(raw: any, options: { chosenMainAt?: number | null } = {}): LocalCube | null {
	const cube = normalizeCube(raw);
	if (!cube) return null;
	mutate((current) => {
		const existing = current.cubes.find((c) => c.id === cube.id);
		// Calibrations are not always selected by the caller's mutation; keep what is known.
		const merged: LocalCube = existing && !Array.isArray(raw?.calibrations) ? { ...cube, calibrations: existing.calibrations } : cube;
		const cubes = existing ? current.cubes.map((c) => (c.id === cube.id ? merged : c)) : [...current.cubes, merged];

		const mains = { ...current.mains };
		const main = mains[cube.puzzle];
		if (merged.archived_at) {
			if (main && main.cube_id === merged.id) delete mains[cube.puzzle];
		} else if (options.chosenMainAt && (!main || main.set_at < options.chosenMainAt)) {
			mains[cube.puzzle] = { cube_id: merged.id, set_at: options.chosenMainAt };
		} else if (!main && !existing) {
			const otherActive = current.cubes.some((c) => c.puzzle === cube.puzzle && !c.archived_at);
			if (!otherActive) mains[cube.puzzle] = { cube_id: merged.id, set_at: AUTO_MAIN_SET_AT_MS };
		}
		return { ...current, cubes, mains };
	});
	return cube;
}

/** A deleted cube: gone with its main entry and its pending measurements. */
export function removeCube(id: string): void {
	mutate((current) => {
		if (!current.cubes.some((c) => c.id === id)) return null;
		const mains: CubeMains = {};
		for (const [puzzle, entry] of Object.entries(current.mains)) {
			if (entry.cube_id !== id) mains[puzzle] = entry;
		}
		return {
			...current,
			cubes: current.cubes.filter((c) => c.id !== id),
			mains,
			pendingCalibrations: current.pendingCalibrations.filter((c) => c.cube_id !== id),
		};
	});
}

/**
 * A measurement finished on this device (4.4): usable at once, uploaded by sync.ts. Replaces an
 * older pending one for the same cube and phone model.
 */
export function addPendingCalibration(row: PendingCalibration): void {
	mutate((current) => {
		const others = current.pendingCalibrations.filter((c) => !sameCalibrationKey(c, row));
		const older = current.pendingCalibrations.find((c) => sameCalibrationKey(c, row));
		if (older && older.measured_at > row.measured_at) return null;
		return { ...current, pendingCalibrations: [...others, { ...row }] };
	});
}

/**
 * The server answered a saveCubeCalibration for `sent`: its row (ours, or a newer one made on
 * another phone of the same model) goes into the cube, the pending copy is dropped.
 */
export function resolveCalibrationSent(sent: PendingCalibration, rowRaw: any): void {
	const row = normalizeCalibration(rowRaw);
	mutate((current) => {
		const pendingCalibrations = current.pendingCalibrations.filter(
			(c) => !(sameCalibrationKey(c, sent) && c.measured_at === sent.measured_at)
		);
		const cubes = row
			? current.cubes.map((cube) => (cube.id === row.cube_id ? { ...cube, calibrations: withCalibration(cube.calibrations, row) } : cube))
			: current.cubes;
		return { ...current, cubes, pendingCalibrations };
	});
}

/** The server refused a measurement for good (invalid, cube gone, no Pro): stop sending it. */
export function dropPendingCalibration(sent: PendingCalibration): void {
	mutate((current) => {
		const pendingCalibrations = current.pendingCalibrations.filter(
			(c) => !(sameCalibrationKey(c, sent) && c.measured_at === sent.measured_at)
		);
		if (pendingCalibrations.length === current.pendingCalibrations.length) return null;
		return { ...current, pendingCalibrations };
	});
}

/** A stored calibration deleted on the server (deleteCubeCalibration). */
export function removeCalibration(id: string): void {
	mutate((current) => {
		let changed = false;
		const cubes = current.cubes.map((cube) => {
			if (!cube.calibrations.some((c) => c.id === id)) return cube;
			changed = true;
			return { ...cube, calibrations: cube.calibrations.filter((c) => c.id !== id) };
		});
		return changed ? { ...current, cubes } : null;
	});
}

/**
 * A solve was just saved with this cube. Moves its "last used" and count forward locally so
 * sorting reacts at once; the next server read replaces both with the real numbers.
 */
export function noteCubeSolve(cubeId: string | null | undefined, at: number = Date.now()): void {
	if (!cubeId) return;
	mutate((current) => {
		const cube = current.cubes.find((c) => c.id === cubeId);
		if (!cube) return null;
		const updated: LocalCube = {
			...cube,
			solve_count: cube.solve_count + 1,
			last_used_at: Math.max(cube.last_used_at ?? 0, at),
			first_used_at: cube.first_used_at ?? at,
		};
		return { ...current, cubes: current.cubes.map((c) => (c.id === cubeId ? updated : c)) };
	});
}
