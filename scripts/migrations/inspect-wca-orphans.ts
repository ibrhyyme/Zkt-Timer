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
	// WCA event variantlari
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
	console.log('SOLVE TABLE — cube_type=wca dagilimi');
	console.log('='.repeat(80));

	const groups = await prisma.solve.groupBy({
		by: ['scramble_subset'],
		where: { cube_type: 'wca' },
		_count: { _all: true },
		orderBy: { _count: { id: 'desc' } },
	});

	console.log(`Toplam ${groups.length} farkli subset degeri:\n`);
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

	console.log(`\nToplam orphan solve: ${orphans.length}`);
	if (!orphans.length) return;

	const userCounts: Record<string, number> = {};
	for (const o of orphans) {
		userCounts[o.user_id] = (userCounts[o.user_id] || 0) + 1;
	}
	const topUsers = Object.entries(userCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5);
	console.log('\nEn cok orphan iceren 5 kullanici:');
	for (const [uid, c] of topUsers) {
		console.log(`  ${uid}: ${c}`);
	}

	console.log('\nIlk 10 orphan ornegi:');
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
	console.log('TOP_SOLVE TABLE — cube_type=wca dagilimi');
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

	console.log(`\nToplam top_solve orphan: ${orphans.length}`);
	if (!orphans.length) return;
	console.log('\nIlk 5 ornek:');
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
	console.log('TOP_AVERAGE TABLE — cube_type=wca dagilimi');
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

	console.log(`\nToplam top_average orphan: ${orphans.length}`);
	if (!orphans.length) return;
	console.log('\nIlk 5 ornek:');
	for (const o of orphans.slice(0, 5)) {
		console.log(
			`  id=${o.id}, subset=${o.scramble_subset ?? '<NULL>'}, user=${o.user_id}, time=${o.time}s`
		);
	}
}

async function main() {
	console.log('Zkt-Timer WCA Orphan Audit\n');
	console.log(`Gecerli WCA subset'leri: ${Array.from(VALID_WCA_SUBSETS).join(', ')}\n`);

	await reportSolves();
	await reportTopSolves();
	await reportTopAverages();

	console.log('\n' + '='.repeat(80));
	console.log('AUDIT TAMAMLANDI');
	console.log('='.repeat(80));
	console.log('\nOnerilen aksiyon:');
	console.log('  1. Orphan dagilimi rapor edildi.');
	console.log('  2. Karar: (a) 333\'e migrate, (b) sil, (c) elle duzelt.');
	console.log('  3. Cleanup script\'i ayri bir geciste uygulanir.');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
