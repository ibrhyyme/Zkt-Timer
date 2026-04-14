/**
 * ONE-TIME DATA MIGRATION: Legacy cube_type -> WCA + scramble_subset
 *
 * Usage:
 *   npx ts-node scripts/migrations/run-wca-migration.ts
 *   npx ts-node scripts/migrations/run-wca-migration.ts --dry-run
 *
 * Safe properties:
 *   - No DELETEs. UPDATE only.
 *   - Wrapped in a single transaction. Any error rolls back.
 *   - Idempotent: second run matches 0 rows.
 *   - --dry-run: counts affected rows without writing.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

// Pure WCA puzzles: cube_type=<id> -> cube_type='wca', scramble_subset=<id>
const PURE_WCA_IDS = ['333', '222', '444', '555', '666', '777', 'sq1', 'pyram', 'clock', 'skewb', 'minx'] as const;

// Old variants: legacy_id -> { cube_type, scramble_subset }
const VARIANT_MAP: Record<string, { cube_type: string; scramble_subset: string }> = {
	'333mirror': { cube_type: '333', scramble_subset: '333mirror' },
	'222oh':     { cube_type: '222', scramble_subset: '222oh' },
	'333oh':     { cube_type: '333', scramble_subset: '333oh' },
	'333bl':     { cube_type: '333', scramble_subset: '333ni' },
};

interface TableTarget {
	name: string;
	// For daily_goal, scramble_subset is a non-nullable String @default("").
	// For other tables, it's nullable. The legacy guard is different.
	legacyGuard: 'NULL' | 'EMPTY';
}

const TABLES: TableTarget[] = [
	{ name: 'solve',       legacyGuard: 'NULL'  },
	{ name: 'top_solve',   legacyGuard: 'NULL'  },
	{ name: 'top_average', legacyGuard: 'NULL'  },
	{ name: 'setting',     legacyGuard: 'NULL'  },
	{ name: 'daily_goal',  legacyGuard: 'EMPTY' },
];

async function migrateTable(table: TableTarget): Promise<number> {
	const guard = table.legacyGuard === 'NULL'
		? '(scramble_subset IS NULL)'
		: "(scramble_subset = '')";

	let total = 0;

	// Pure WCA puzzles
	for (const id of PURE_WCA_IDS) {
		const sql = `
			UPDATE ${table.name}
			SET cube_type = $1, scramble_subset = $2
			WHERE cube_type = $2 AND ${guard}
		`;
		if (DRY_RUN) {
			const count = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
				`SELECT COUNT(*)::bigint AS count FROM ${table.name} WHERE cube_type = $1 AND ${guard}`,
				id
			);
			const n = Number(count[0].count);
			total += n;
			if (n > 0) console.log(`  [dry] ${table.name}: ${id} -> (wca, ${id}): ${n}`);
		} else {
			const n = await prisma.$executeRawUnsafe(sql, 'wca', id);
			total += n;
			if (n > 0) console.log(`  ${table.name}: ${id} -> (wca, ${id}): ${n}`);
		}
	}

	// Old variants
	for (const [legacy, target] of Object.entries(VARIANT_MAP)) {
		if (DRY_RUN) {
			const count = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
				`SELECT COUNT(*)::bigint AS count FROM ${table.name} WHERE cube_type = $1 AND ${guard}`,
				legacy
			);
			const n = Number(count[0].count);
			total += n;
			if (n > 0) console.log(`  [dry] ${table.name}: ${legacy} -> (${target.cube_type}, ${target.scramble_subset}): ${n}`);
		} else {
			const sql = `
				UPDATE ${table.name}
				SET cube_type = $1, scramble_subset = $2
				WHERE cube_type = $3 AND ${guard}
			`;
			const n = await prisma.$executeRawUnsafe(sql, target.cube_type, target.scramble_subset, legacy);
			total += n;
			if (n > 0) console.log(`  ${table.name}: ${legacy} -> (${target.cube_type}, ${target.scramble_subset}): ${n}`);
		}
	}

	return total;
}

async function verify(): Promise<void> {
	console.log('\n=== Verification ===');
	for (const table of TABLES) {
		const rows = await prisma.$queryRawUnsafe<Array<{ cube_type: string; scramble_subset: string | null; count: bigint }>>(
			`SELECT cube_type, scramble_subset, COUNT(*)::bigint AS count FROM ${table.name} GROUP BY cube_type, scramble_subset ORDER BY count DESC LIMIT 20`
		);
		console.log(`\n${table.name}:`);
		for (const r of rows) {
			console.log(`  ${r.cube_type} / ${r.scramble_subset ?? 'NULL'}: ${Number(r.count)}`);
		}
	}
}

async function main() {
	console.log(DRY_RUN ? '=== DRY RUN (no writes) ===' : '=== RUNNING MIGRATION ===');

	if (DRY_RUN) {
		let grandTotal = 0;
		for (const table of TABLES) {
			console.log(`\nScanning ${table.name}...`);
			grandTotal += await migrateTable(table);
		}
		console.log(`\n=== Would migrate ${grandTotal} rows total ===`);
		await verify();
		return;
	}

	let grandTotal = 0;
	await prisma.$transaction(async (tx) => {
		// Replace global prisma with tx inside the callback for transactional writes
		// We cheat here by using $executeRawUnsafe on tx for raw SQL.
		for (const table of TABLES) {
			console.log(`\nMigrating ${table.name}...`);
			const guard = table.legacyGuard === 'NULL'
				? '(scramble_subset IS NULL)'
				: "(scramble_subset = '')";

			for (const id of PURE_WCA_IDS) {
				const n = await tx.$executeRawUnsafe(
					`UPDATE ${table.name} SET cube_type = $1, scramble_subset = $2 WHERE cube_type = $2 AND ${guard}`,
					'wca', id
				);
				grandTotal += n;
				if (n > 0) console.log(`  ${table.name}: ${id} -> (wca, ${id}): ${n}`);
			}

			for (const [legacy, target] of Object.entries(VARIANT_MAP)) {
				const n = await tx.$executeRawUnsafe(
					`UPDATE ${table.name} SET cube_type = $1, scramble_subset = $2 WHERE cube_type = $3 AND ${guard}`,
					target.cube_type, target.scramble_subset, legacy
				);
				grandTotal += n;
				if (n > 0) console.log(`  ${table.name}: ${legacy} -> (${target.cube_type}, ${target.scramble_subset}): ${n}`);
			}
		}
	}, { timeout: 10 * 60 * 1000 }); // 10 min timeout for large datasets

	console.log(`\n=== Migrated ${grandTotal} rows total ===`);
	await verify();
}

main()
	.catch((e) => {
		console.error('Migration failed:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
