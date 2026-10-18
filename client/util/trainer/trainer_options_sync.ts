/**
 * Algorithm trainer settings (Standard and Smart Cube modes): defaults, the stored blob
 * format, and the rule that decides which copy wins when the device and the server disagree.
 *
 * Two copies exist:
 *  - the device copy in localStorage (`trainer_options:<userId>`), written on every change,
 *    so the trainer works offline and opens instantly;
 *  - the server copy in the GLOBAL `trainer_options` setting (Setting.trainer_options column),
 *    shared by every device of the account.
 *
 * Both hold the same blob: `{v, ts, options}` where `ts` is the time of the change. The newer
 * copy wins. A change made offline therefore survives the next launch (its ts is newer than
 * the server's) and is pushed up then, instead of being overwritten by an older server value.
 *
 * Pure and React free so the rules are testable in node.
 */
import type {CubeFace, StudyMode, TrainerBackView, TrainerOptions} from '../../components/trainer/types';

export const DEFAULT_TRAINER_OPTIONS: TrainerOptions = {
	randomOrder: true,
	prioritizeSlow: false,
	prioritizeFailed: false,
	selectLearning: false,
	randomizeAUF: true,
	autoLearnEnabled: true,
	autoLearnThreshold: 5,
	cubeSize: 280,
	wakeLockEnabled: true,
	flashingError: true,
	showCaseName: true,
	whiteOnBottom: false,
	showAllBleDevices: false,
	backView: 'none',
	topFace: 'U',
	frontFace: 'F',
	lastMode: 'standard',
};

export const TRAINER_OPTIONS_BLOB_VERSION = 1;

/** Device copy key before server sync existed. Read once as a migration source. */
export const LEGACY_TRAINER_OPTIONS_KEY = 'trainer_options';

export function trainerOptionsDeviceKey(userId: string | null | undefined): string {
	return `${LEGACY_TRAINER_OPTIONS_KEY}:${userId || '_anon'}`;
}

const FACES: readonly CubeFace[] = ['U', 'D', 'F', 'B', 'R', 'L'];
const BACK_VIEWS: readonly TrainerBackView[] = ['none', 'side-by-side', 'top-right'];
const STUDY_MODES: readonly StudyMode[] = ['standard', 'smart'];

// Same ranges the settings modal sliders offer.
const NUMBER_RANGES: Partial<Record<keyof TrainerOptions, [number, number]>> = {
	autoLearnThreshold: [3, 10],
	cubeSize: [180, 500],
};

/**
 * Keeps only known keys whose value has the right shape, layered over `base`. A blob written
 * by an older or newer client (renamed key, removed option, wrong type) can never put a value
 * into the trainer that the UI does not understand.
 */
export function sanitizeTrainerOptions(
	raw: unknown,
	base: TrainerOptions = DEFAULT_TRAINER_OPTIONS
): TrainerOptions {
	const out: TrainerOptions = {...base};
	if (!raw || typeof raw !== 'object') return out;
	const src = raw as Record<string, unknown>;

	for (const key of Object.keys(DEFAULT_TRAINER_OPTIONS) as (keyof TrainerOptions)[]) {
		const value = src[key];
		if (value === undefined || value === null) continue;
		const def = DEFAULT_TRAINER_OPTIONS[key];

		if (key === 'topFace' || key === 'frontFace') {
			if (FACES.includes(value as CubeFace)) (out as any)[key] = value;
			continue;
		}
		if (key === 'backView') {
			if (BACK_VIEWS.includes(value as TrainerBackView)) out.backView = value as TrainerBackView;
			continue;
		}
		if (key === 'lastMode') {
			// Only the two study modes; 'recognition' or a future value falls back to the base.
			if (STUDY_MODES.includes(value as StudyMode)) out.lastMode = value as StudyMode;
			continue;
		}
		if (typeof def === 'number') {
			if (typeof value !== 'number' || !Number.isFinite(value)) continue;
			const range = NUMBER_RANGES[key];
			(out as any)[key] = range ? Math.min(range[1], Math.max(range[0], value)) : value;
			continue;
		}
		if (typeof value === typeof def) (out as any)[key] = value;
	}

	return out;
}

export interface TrainerOptionsSnapshot {
	ts: number;
	options: TrainerOptions;
}

/**
 * Reads a stored blob (string or already parsed object). Accepts the current `{v, ts, options}`
 * shape and the legacy plain options object the trainer used to write to localStorage, which
 * gets ts 0 so any real server copy beats it. Returns null for anything unreadable.
 */
export function parseTrainerOptionsBlob(raw: unknown): TrainerOptionsSnapshot | null {
	if (raw === null || raw === undefined || raw === '') return null;
	let value: unknown = raw;
	if (typeof raw === 'string') {
		try {
			value = JSON.parse(raw);
		} catch {
			return null;
		}
	}
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const obj = value as Record<string, unknown>;

	if (obj.options && typeof obj.options === 'object') {
		const ts = typeof obj.ts === 'number' && Number.isFinite(obj.ts) ? obj.ts : 0;
		return {ts, options: sanitizeTrainerOptions(obj.options)};
	}
	return {ts: 0, options: sanitizeTrainerOptions(obj)};
}

export function serializeTrainerOptions(options: TrainerOptions, ts: number): string {
	return JSON.stringify({
		v: TRAINER_OPTIONS_BLOB_VERSION,
		ts,
		options: sanitizeTrainerOptions(options),
	});
}

export function sameTrainerOptions(a: TrainerOptions, b: TrainerOptions): boolean {
	for (const key of Object.keys(DEFAULT_TRAINER_OPTIONS) as (keyof TrainerOptions)[]) {
		if (a[key] !== b[key]) return false;
	}
	return true;
}

export interface ResolvedTrainerOptions {
	options: TrainerOptions;
	ts: number;
	source: 'local' | 'remote' | 'default';
	/** The device copy is newer than the server's (an offline change, or a first upload). */
	pushLocal: boolean;
}

/**
 * Picks the copy to use. The newer `ts` wins; on a tie the server wins, since it is the
 * shared one. With only one copy present, that copy is used, and a device copy the server
 * has never seen is marked for upload.
 */
export function resolveTrainerOptions(localRaw: unknown, remoteRaw: unknown): ResolvedTrainerOptions {
	const local = parseTrainerOptionsBlob(localRaw);
	const remote = parseTrainerOptionsBlob(remoteRaw);

	if (!local && !remote) {
		return {options: {...DEFAULT_TRAINER_OPTIONS}, ts: 0, source: 'default', pushLocal: false};
	}
	if (local && (!remote || local.ts > remote.ts)) {
		const differs = !remote || !sameTrainerOptions(local.options, remote.options);
		return {options: local.options, ts: local.ts, source: 'local', pushLocal: differs};
	}
	return {options: remote.options, ts: remote.ts, source: 'remote', pushLocal: false};
}
