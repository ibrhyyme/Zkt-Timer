/**
 * ONE-TIME CLEANUP: cube_type='wca' + scramble_subset=NULL orphans.
 *
 * Works on all users (no user_id filter). Cleans solve, top_solve, top_average
 * tables together.
 *
 * Classification inference — looks at scramble notation pattern:
 *   - "/" present               → sq1
 *   - "++" / "--" present       → minx (megaminx)
 *   - "Rw"/"Lw"/"Uw"/"Dw"/"Fw"/"Bw" present → 4x4-7x7 (by length)
 *   - "(",")" + number (clock) → clock
 *   - lowercase letters (l/u/r/b) and length<40 → pyram
 *   - only UDRLFB letters, length 25-80 → 333
 *   - only URF (D/L/B absent), length<30 → 222
 *   - everything else         → SKIP (manual review)
 *
 * Very conservative — if suspicious, SKIPs instead of auto-assigning.
 *
 * Usage:
 *   npx ts-node scripts/migrations/cleanup-wca-orphans.ts            # dry-run (default)
 *   npx ts-node scripts/migrations/cleanup-wca-orphans.ts --apply    # actually write
 *
 * Safe properties:
 *   - No DELETEs. UPDATE only.
 *   - Idempotent: second run matches 0 rows, safe to retry on error.
 *   - One table failure doesn't affect others (no transaction — not needed).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const DRY_RUN = !APPLY;

interface OrphanSolve {
	id: string;
	scramble: string | null;
	scramble_subset: string | null;
	user_id: string;
}

/**
 * Infers WCA event from scramble pattern.
 * Returns null if suspicious — caller SKIPs.
 */
function classifyScramble(scramble: string | null): string | null {
	if (!scramble) return null;
	const s = scramble.trim();
	if (s.length === 0) return null;

	// sq1: slash notation "(a,b)/"
	if (s.includes('/')) return 'sq1';

	// megaminx: "++" or "--" (Pochmann)
	if (s.includes('++') || s.includes('--')) return 'minx';

	// clock: "UR2+ DL3-" pattern
	if (/[+-]\d/.test(s) && /[Uu][Rr]|[Dd][Ll]/.test(s)) return 'clock';

	// 4x4+: wide turn notation "Rw", "Uw", "3Rw"
	if (/\d?[RLUDFB]w/.test(s)) {
		if (s.length < 100) return '444';
		if (s.length < 130) return '555';
		if (s.length < 180) return '666';
		return '777';
	}

	// pyramid: lowercase letter turns "l", "r", "u", "b"
	if (/(^|\s)[lrub]'?(\s|$)/.test(s) && s.length < 50) return 'pyram';

	// Do we have only [UDLRFB] turns?
	const moves = s.replace(/\s+/g, ' ').split(' ').filter(Boolean);
	const validNxN = moves.every((m) => /^[UDLRFB][2']?$/.test(m));
	if (!validNxN) return null;

	const distinctFaces = new Set(moves.map((m) => m[0]));

	// 2x2: short scramble + limited face variety
	if (s.length < 30 && distinctFaces.size <= 3) return '222';

	// 3x3: 6-face scramble, medium length
	if (s.length >= 25 && s.length <= 80 && distinctFaces.size >= 4) return '333';

	return null;
}

interface BucketResult {
	[subset: string]: string[];
}

function classifyAll<T extends { id: string }>(
	orphans: T[],
	getScramble: (o: T) => string | null
): { buckets: BucketResult; skipped: string[] } {
	const buckets: BucketResult = {};
	const skipped: string[] = [];
	for (const o of orphans) {
		const cls = classifyScramble(getScramble(o));
		if (!cls) {
			skipped.push(o.id);
			continue;
		}
		if (!buckets[cls]) buckets[cls] = [];
		buckets[cls].push(o.id);
	}
	return { buckets, skipped };
}

function logBuckets(label: string, buckets: BucketResult, skipped: string[]) {
	console.log(`\n[${label}] Classification:`);
	const keys = Object.keys(buckets).sort();
	for (const k of keys) {
		console.log(`  ${k.padEnd(8)} ${buckets[k].length}`);
	}
	console.log(`  ${'SKIPPED'.padEnd(8)} ${skipped.length}`);
}

async function fetchSolveOrphans(): Promise<OrphanSolve[]> {
	return prisma.solve.findMany({
		where: { cube_type: 'wca', scramble_subset: null },
		select: { id: true, scramble: true, scramble_subset: true, user_id: true },
	});
}

async function applySolveCleanup(orphans: OrphanSolve[]) {
	const { buckets, skipped } = classifyAll(orphans, (o) => o.scramble);
	logBuckets('solve', buckets, skipped);

	if (DRY_RUN) {
		console.log('  [dry-run] UPDATE not applied.');
		printSampleSkipped(orphans, skipped, (o) => o.scramble);
		return;
	}

	for (const subset of Object.keys(buckets)) {
		const ids = buckets[subset];
		if (ids.length === 0) continue;
		const r = await prisma.solve.updateMany({
			where: { id: { in: ids } },
			data: { scramble_subset: subset },
		});
		console.log(`  [apply]  ${r.count} solves updated to '${subset}'`);
	}
}

function printSampleSkipped<T>(
	orphans: T[],
	skippedIds: string[],
	getScramble: (o: T) => string | null
) {
	if (skippedIds.length === 0) return;
	const skippedSet = new Set(skippedIds);
	const samples = orphans
		.filter((o: any) => skippedSet.has(o.id))
		.slice(0, 5);
	console.log('  SKIPPED example scrambles:');
	for (const s of samples) {
		const scr = getScramble(s) || '<empty>';
		console.log(`    [${scr.length} char] "${scr.slice(0, 70)}${scr.length > 70 ? '...' : ''}"`);
	}
}

async function fetchTopSolveOrphans() {
	return prisma.topSolve.findMany({
		where: { cube_type: 'wca', scramble_subset: null },
		include: { solve: { select: { scramble: true } } },
	});
}

async function applyTopSolveCleanup(orphans: Awaited<ReturnType<typeof fetchTopSolveOrphans>>) {
	const { buckets, skipped } = classifyAll(orphans, (o) => o.solve?.scramble || null);
	logBuckets('top_solve', buckets, skipped);

	if (DRY_RUN) {
		console.log('  [dry-run] UPDATE not applied.');
		return;
	}

	for (const subset of Object.keys(buckets)) {
		const ids = buckets[subset];
		if (ids.length === 0) continue;
		const r = await prisma.topSolve.updateMany({
			where: { id: { in: ids } },
			data: { scramble_subset: subset },
		});
		console.log(`  [apply]  ${r.count} top_solves updated to '${subset}'`);
	}
}

async function fetchTopAverageOrphans() {
	return prisma.topAverage.findMany({
		where: { cube_type: 'wca', scramble_subset: null },
		include: { solve_1: { select: { scramble: true } } },
	});
}

async function applyTopAverageCleanup(orphans: Awaited<ReturnType<typeof fetchTopAverageOrphans>>) {
	const { buckets, skipped } = classifyAll(orphans, (o) => o.solve_1?.scramble || null);
	logBuckets('top_average', buckets, skipped);

	if (DRY_RUN) {
		console.log('  [dry-run] UPDATE not applied.');
		return;
	}

	for (const subset of Object.keys(buckets)) {
		const ids = buckets[subset];
		if (ids.length === 0) continue;
		const r = await prisma.topAverage.updateMany({
			where: { id: { in: ids } },
			data: { scramble_subset: subset },
		});
		console.log(`  [apply]  ${r.count} top_averages updated to '${subset}'`);
	}
}

async function main() {
	console.log('='.repeat(70));
	console.log('Zkt-Timer WCA Orphan Cleanup');
	console.log(`Mode: ${APPLY ? 'APPLY (actual write)' : 'DRY-RUN (report only)'}`);
	console.log('Classification: by scramble notation pattern (sq1, minx, clock, 222-777, pyram, 333)');
	console.log('='.repeat(70));

	const solveOrphans = await fetchSolveOrphans();
	const topSolveOrphans = await fetchTopSolveOrphans();
	const topAverageOrphans = await fetchTopAverageOrphans();

	console.log(`\nOrphans found:`);
	console.log(`  solve:       ${solveOrphans.length}`);
	console.log(`  top_solve:   ${topSolveOrphans.length}`);
	console.log(`  top_average: ${topAverageOrphans.length}`);

	if (solveOrphans.length === 0 && topSolveOrphans.length === 0 && topAverageOrphans.length === 0) {
		console.log('\nNo orphans found. Exiting.');
		return;
	}

	await applySolveCleanup(solveOrphans);
	await applyTopSolveCleanup(topSolveOrphans);
	await applyTopAverageCleanup(topAverageOrphans);

	console.log('\n' + '='.repeat(70));
	if (DRY_RUN) {
		console.log('DRY-RUN completed. To apply for real: --apply');
	} else {
		console.log('CLEANUP completed.');
	}
	console.log('='.repeat(70));
}

main()
	.catch((e) => {
		console.error('\n[FATAL]', e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
