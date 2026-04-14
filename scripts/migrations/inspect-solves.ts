import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
	const total = await prisma.solve.count();
	console.log(`Total solves: ${total}\n`);

	const byType = await prisma.$queryRawUnsafe<Array<{ cube_type: string; scramble_subset: string | null; count: bigint }>>(
		`SELECT cube_type, scramble_subset, COUNT(*)::bigint AS count
		 FROM solve
		 GROUP BY cube_type, scramble_subset
		 ORDER BY count DESC`
	);

	console.log('By (cube_type, scramble_subset):');
	for (const r of byType) {
		console.log(`  ${r.cube_type.padEnd(12)} / ${(r.scramble_subset ?? 'NULL').padEnd(15)}: ${Number(r.count)}`);
	}

	console.log('\nSample 10 solves:');
	const sample = await prisma.solve.findMany({
		take: 10,
		orderBy: { created_at: 'desc' },
		select: { id: true, cube_type: true, scramble_subset: true, time: true, created_at: true },
	});
	for (const s of sample) {
		console.log(`  ${s.created_at.toISOString()} | ${s.cube_type} / ${s.scramble_subset ?? 'NULL'} | ${s.time}s`);
	}
}

main().finally(() => prisma.$disconnect());
