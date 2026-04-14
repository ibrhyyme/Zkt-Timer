import { getSolveDb } from './init';
import { Solve } from '../../../server/schemas/Solve.schema';

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

	let migrated = 0;
	for (const solve of legacySolves) {
		const mapped = mapLegacySolve(solve);
		if (!mapped) continue;

		solve.cube_type = mapped.cube_type;
		solve.scramble_subset = mapped.scramble_subset;
		db.update(solve);
		migrated++;
	}

	return migrated;
}
