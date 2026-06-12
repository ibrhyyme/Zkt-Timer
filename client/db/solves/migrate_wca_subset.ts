import { getSolveDb } from './init';
import { Solve } from '../../../server/schemas/Solve.schema';
import { getSetting } from '../settings/query';
import { setCubeType, setScrambleSubset } from '../settings/update';

// One-time LokiJS migration: legacy cube_type -> (cube_type, scramble_subset)
// Mirror of scripts/migrations/wca-subset-migration.sql but for local LokiJS.
// Idempotent: safe to run multiple times.

const PURE_WCA_IDS = ['333', '222', '444', '555', '666', '777', 'sq1', 'pyram', 'clock', 'skewb', 'minx'] as const;

const VARIANT_MAP: Record<string, { cube_type: string; scramble_subset: string }> = {
	'333mirror': { cube_type: '333', scramble_subset: '333mirror' },
	'222oh':     { cube_type: '222', scramble_subset: '222oh' },
	'333oh':     { cube_type: '333', scramble_subset: '333oh' },
	'333bl':     { cube_type: '333', scramble_subset: '333ni' },
};

// A solve is "legacy" if it has one of the old cube_type ids AND no subset yet.
function mapLegacySolve(solve: Solve): { cube_type: string; scramble_subset: string | null } | null {
	if (solve.scramble_subset) {
		return null;
	}

	const ct = solve.cube_type;
	if (!ct) return null;

	if ((PURE_WCA_IDS as readonly string[]).includes(ct)) {
		return { cube_type: 'wca', scramble_subset: ct };
	}

	if (ct in VARIANT_MAP) {
		return VARIANT_MAP[ct];
	}

	return null;
}

export function migrateLokiSolvesToWcaSubset(): number {
	const db = getSolveDb();
	if (!db) return 0;

	let migrated = 0;

	// Faz 1: Legacy cube_type'lari yeni (wca, <subset>) bucket'ina cevir
	const legacyIds = [...PURE_WCA_IDS, ...Object.keys(VARIANT_MAP)];
	const legacySolves = db.chain()
		.find({
			cube_type: { $in: legacyIds },
			$or: [
				{ scramble_subset: { $exists: false } },
				{ scramble_subset: null },
			],
		})
		.data();

	for (const solve of legacySolves) {
		const mapped = mapLegacySolve(solve);
		if (!mapped) continue;

		solve.cube_type = mapped.cube_type;
		solve.scramble_subset = mapped.scramble_subset;
		db.update(solve);
		migrated++;
	}

	// Faz 2: (wca, NULL/empty) "hayalet" kayitlari (wca, '333') olarak duzelt — kural ihlali
	const orphanWcaSolves = db.chain()
		.find({
			cube_type: 'wca',
			$or: [
				{ scramble_subset: { $exists: false } },
				{ scramble_subset: null },
				{ scramble_subset: '' },
			],
		})
		.data();

	for (const solve of orphanWcaSolves) {
		solve.scramble_subset = '333';
		db.update(solve);
		migrated++;
	}

	// Faz 3: '333sub' cube type kaldirildi — subset'leri (2gen, roux, vs) '333' altina tasindi.
	// Sadece cube_type degisir; scramble_subset oldugu gibi korunur (333'te cakisan id yok).
	const subSolves = db.chain().find({ cube_type: '333sub' }).data();
	for (const solve of subSolves) {
		solve.cube_type = '333';
		db.update(solve);
		migrated++;
	}

	// Faz 4: '333zz' cube type kaldirildi — '333cfop' altina tasindi.
	// ZZ subset'leri (eoline, eocross, zzll, zbll, zbls) zaten cfop'ta mevcut.
	const zzSolves = db.chain().find({ cube_type: '333zz' }).data();
	for (const solve of zzSolves) {
		solve.cube_type = '333cfop';
		db.update(solve);
		migrated++;
	}

	return migrated;
}

// Migrate the user's active picker setting off a standalone WCA-event bucket.
// A setting like 333::null or 333::333 is the duplicate of the canonical wca::333
// and, left in place, makes every new solve land in the wrong "3x3" box again
// (the leak SessionPicker used to produce). Real variants (333oh, 333mirror, ...)
// keep a distinct subset and are untouched. Covers ALL WCA events, not just 333.
// Idempotent: re-running matches nothing once the setting is canonical.
export function migrateLokiSettingToWcaSubset(): boolean {
	const cubeType = getSetting('cube_type');
	if (!cubeType || !(PURE_WCA_IDS as readonly string[]).includes(cubeType)) {
		return false;
	}

	const subset = getSetting('scramble_subset');
	if (!subset || subset === cubeType) {
		setCubeType('wca');
		setScrambleSubset(cubeType);
		return true;
	}

	return false;
}
