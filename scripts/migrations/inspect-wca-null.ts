import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
	const wcaNull = await prisma.solve.findMany({
		where: { cube_type: 'wca', scramble_subset: null },
		select: { id: true, time: true, scramble: true, created_at: true, from_timer: true },
		orderBy: { created_at: 'asc' },
	});

	console.log(`Total wca/NULL solves: ${wcaNull.length}\n`);

	if (wcaNull.length === 0) return;

	console.log(`Earliest: ${wcaNull[0].created_at.toISOString()}`);
	console.log(`Latest:   ${wcaNull[wcaNull.length - 1].created_at.toISOString()}\n`);

	console.log('Scramble length distribution (3x3 scrambles are typically 40-80 chars, 2x2 ~20, 4x4 ~120+):');
	const buckets: Record<string, number> = {};
	for (const s of wcaNull) {
		const len = (s.scramble || '').length;
		let bucket = '';
		if (len < 30) bucket = '<30 (2x2-ish)';
		else if (len < 80) bucket = '30-80 (3x3-ish)';
		else if (len < 150) bucket = '80-150 (4x4-ish)';
		else bucket = '150+ (5x5+)';
		buckets[bucket] = (buckets[bucket] || 0) + 1;
	}
	for (const [k, v] of Object.entries(buckets)) {
		console.log(`  ${k.padEnd(20)}: ${v}`);
	}

	console.log('\nFirst 5 scrambles:');
	for (const s of wcaNull.slice(0, 5)) {
		console.log(`  [${(s.scramble || '').length} chars] ${(s.scramble || '').slice(0, 100)}`);
	}

	console.log('\nTime distribution:');
	const times = wcaNull.map((s) => s.time).filter((t) => t > 0);
	if (times.length) {
		const avg = times.reduce((a, b) => a + b, 0) / times.length;
		const min = Math.min(...times);
		const max = Math.max(...times);
		console.log(`  Count: ${times.length}, Avg: ${avg.toFixed(2)}s, Min: ${min}s, Max: ${max}s`);
	}
}

main().finally(() => prisma.$disconnect());
