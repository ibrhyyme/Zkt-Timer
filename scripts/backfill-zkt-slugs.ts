/**
 * One-off backfill: give every ZKT competition that predates the slug feature a
 * WCA-style readable slug (e.g. BursaSummer2026). Idempotent — only touches rows
 * where slug IS NULL, so it can be re-run safely.
 *
 * Run after `prisma db push` adds the slug column:
 *   npx ts-node --transpile-only scripts/backfill-zkt-slugs.ts
 */
import {getPrisma, initPrisma} from '../server/database';
import {generateUniqueSlug} from '../server/models/zkt_competition';

async function main() {
	initPrisma();
	const prisma = getPrisma();

	const comps = await prisma.zktCompetition.findMany({
		where: {slug: null},
		select: {id: true, name: true, date_start: true},
		orderBy: {created_at: 'asc'},
	});

	console.log(`Backfilling ${comps.length} ZKT competition slug(s)...`);
	for (const c of comps) {
		const year = new Date(c.date_start).getFullYear();
		const slug = await generateUniqueSlug(prisma, c.name, year);
		await prisma.zktCompetition.update({where: {id: c.id}, data: {slug}});
		console.log(`  ${c.name} -> ${slug}`);
	}

	console.log('Done.');
	process.exit(0);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
