import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VALID_WCA_SUBSETS = new Set([
	'333',
	'222',
	'444',
	'555',
	'666',
	'777',
	'sq1',
	'pyram',
	'clock',
	'skewb',
	'minx',
	// WCA event variants
	'333bld',
	'333oh',
	'333fm',
	'333mbld',
	'444bld',
	'555bld',
]);

interface OrphanReport {
	subsetKey: string;
	count: number;
	sample: { id: string; time: number; scrambleLen: number; createdAt: string }[];
}

async function reportSolves() {
	console.log('='.repeat(80));
	console.log('SOLVE TABLE — cube_type=wca distribution');
	console.log('='.repeat(80));

	const groups = await prisma.solve.groupBy({
		by: ['scramble_subset'],
		where: { cube_type: 'wca' },
		_count: { _all: true },
		orderBy: { _count: { id: 'desc' } },
	});

	console.log(`Total ${groups.length} different subset values:\n`);
	for (const g of groups) {
		const sub = g.scramble_subset ?? '<NULL>';
		const tag = g.scramble_subset && VALID_WCA_SUBSETS.has(g.scramble_subset) ? 'OK' : 'ORPHAN';
		console.log(`  [${tag.padEnd(6)}] ${sub.padEnd(20)} ${g._count._all.toLocaleString()}`);
	}

	const orphans = await prisma.solve.findMany({
		where: {
			cube_type: 'wca',
			OR: [
				{ scramble_subset: null },
				{ scramble_subset: { notIn: Array.from(VALID_WCA_SUBSETS) } },
			],
		},
		select: {
			id: true,
			time: true,
			scramble: true,
			scramble_subset: true,
			created_at: true,
			from_timer: true,
			user_id: true,
		},
		orderBy: { created_at: 'asc' },
	});

	console.log(`\nTotal orphan solves: ${orphans.length}`);
	if (!orphans.length) return;

	const userCounts: Record<string, number> = {};
	for (const o of orphans) {
		userCounts[o.user_id] = (userCounts[o.user_id] || 0) + 1;
	}
	const topUsers = Object.entries(userCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5);
	console.log('\nTop 5 users with most orphans:');
	for (const [uid, c] of topUsers) {
		console.log(`  ${uid}: ${c}`);
	}

	console.log('\nFirst 10 orphan examples:');
	for (const o of orphans.slice(0, 10)) {
		const sub = o.scramble_subset ?? '<NULL>';
		const scr = (o.scramble || '').slice(0, 60);
		console.log(
			`  [${sub.padEnd(15)}] time=${o.time}s, scrambleLen=${(o.scramble || '').length}, ${o.created_at.toISOString()}, scr="${scr}..."`
		);
	}
}

async function reportTopSolves() {
	console.log('\n' + '='.repeat(80));
	console.log('TOP_SOLVE TABLE — cube_type=wca distribution');
	console.log('='.repeat(80));

	const groups = await prisma.topSolve.groupBy({
		by: ['scramble_subset'],
		where: { cube_type: 'wca' },
		_count: { _all: true },
		orderBy: { _count: { id: 'desc' } },
	});

	for (const g of groups) {
		const sub = g.scramble_subset ?? '<NULL>';
		const tag = g.scramble_subset && VALID_WCA_SUBSETS.has(g.scramble_subset) ? 'OK' : 'ORPHAN';
		console.log(`  [${tag.padEnd(6)}] ${sub.padEnd(20)} ${g._count._all.toLocaleString()}`);
	}

	const orphans = await prisma.topSolve.findMany({
		where: {
			cube_type: 'wca',
			OR: [
				{ scramble_subset: null },
				{ scramble_subset: { notIn: Array.from(VALID_WCA_SUBSETS) } },
			],
		},
		include: {
			solve: { select: { id: true, time: true, scramble_subset: true } },
		},
	});

	console.log(`\nTotal top_solve orphans: ${orphans.length}`);
	if (!orphans.length) return;
	console.log('\nFirst 5 examples:');
	for (const o of orphans.slice(0, 5)) {
		console.log(
			`  topSolve.id=${o.id}, ts.subset=${o.scramble_subset ?? '<NULL>'}, solve.subset=${
				o.solve?.scramble_subset ?? '<NULL>'
			}, user=${o.user_id}, time=${o.solve?.time}s`
		);
	}
}

async function reportTopAverages() {
	console.log('\n' + '='.repeat(80));
	console.log('TOP_AVERAGE TABLE — cube_type=wca distribution');
	console.log('='.repeat(80));

	const groups = await prisma.topAverage.groupBy({
		by: ['scramble_subset'],
		where: { cube_type: 'wca' },
		_count: { _all: true },
		orderBy: { _count: { id: 'desc' } },
	});

	for (const g of groups) {
		const sub = g.scramble_subset ?? '<NULL>';
		const tag = g.scramble_subset && VALID_WCA_SUBSETS.has(g.scramble_subset) ? 'OK' : 'ORPHAN';
		console.log(`  [${tag.padEnd(6)}] ${sub.padEnd(20)} ${g._count._all.toLocaleString()}`);
	}

	const orphans = await prisma.topAverage.findMany({
		where: {
			cube_type: 'wca',
			OR: [
				{ scramble_subset: null },
				{ scramble_subset: { notIn: Array.from(VALID_WCA_SUBSETS) } },
			],
		},
		select: { id: true, scramble_subset: true, user_id: true, time: true },
	});

	console.log(`\nTotal top_average orphans: ${orphans.length}`);
	if (!orphans.length) return;
	console.log('\nFirst 5 examples:');
	for (const o of orphans.slice(0, 5)) {
		console.log(
			`  id=${o.id}, subset=${o.scramble_subset ?? '<NULL>'}, user=${o.user_id}, time=${o.time}s`
		);
	}
}

async function main() {
	console.log('Zkt-Timer WCA Orphan Audit\n');
	console.log(`Valid WCA subsets: ${Array.from(VALID_WCA_SUBSETS).join(', ')}\n`);

	await reportSolves();
	await reportTopSolves();
	await reportTopAverages();

	console.log('\n' + '='.repeat(80));
	console.log('AUDIT COMPLETED');
	console.log('='.repeat(80));
	console.log('\nRecommended action:');
	console.log('  1. Orphan distribution reported.');
	console.log('  2. Decision: (a) migrate to 333, (b) delete, (c) fix manually.');
	console.log('  3. Cleanup script applied in separate pass.');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
