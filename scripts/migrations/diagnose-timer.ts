/**
 * Diagnose: Timer'da neden cozumler gorunmuyor?
 *
 * Kullanim:
 *   npx ts-node scripts/migrations/diagnose-timer.ts
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
	// 1. Setting row
	console.log('=== 1) Setting Row ===\n');
	const settings = await prisma.setting.findMany({
		select: { user_id: true, cube_type: true, scramble_subset: true, session_id: true },
	});
	for (const s of settings) {
		console.log(`  user_id=${s.user_id}`);
		console.log(`    cube_type       = ${s.cube_type}`);
		console.log(`    scramble_subset = ${s.scramble_subset ?? 'NULL'}`);
		console.log(`    session_id      = ${s.session_id ?? 'NULL'}`);
	}

	if (settings.length === 0) {
		console.log('  (No settings found)');
		return;
	}

	// Tek kullanici varsaysayiyoruz
	const setting = settings[0];
	const sessionId = setting.session_id;
	const userId = setting.user_id;

	// 2. Current session'da solveler (cube_type, scramble_subset) grup
	console.log(`\n=== 2) Current session (${sessionId}) solveler ===\n`);
	if (!sessionId) {
		console.log('  (Session_id null, skipping)');
	} else {
		const sessionGroups = await prisma.$queryRawUnsafe<Array<{ cube_type: string; scramble_subset: string | null; from_timer: boolean; count: bigint }>>(
			`SELECT cube_type, scramble_subset, from_timer, COUNT(*)::bigint AS count
			 FROM solve
			 WHERE session_id = $1 AND user_id = $2
			 GROUP BY cube_type, scramble_subset, from_timer
			 ORDER BY count DESC`,
			sessionId, userId
		);
		if (sessionGroups.length === 0) {
			console.log('  (bu session\'da hic solve yok)');
		} else {
			for (const r of sessionGroups) {
				console.log(`  ${r.cube_type.padEnd(12)} / ${(r.scramble_subset ?? 'NULL').padEnd(10)} | from_timer=${r.from_timer} | ${Number(r.count)}`);
			}
		}
	}

	// 3. wca/333 solveler - hangi session'da?
	console.log(`\n=== 3) wca/333 solveler session dagilimi ===\n`);
	const wca333 = await prisma.$queryRawUnsafe<Array<{ session_id: string | null; session_name: string | null; count: bigint }>>(
		`SELECT s.session_id, se.name AS session_name, COUNT(*)::bigint AS count
		 FROM solve s
		 LEFT JOIN session se ON se.id = s.session_id
		 WHERE s.cube_type = 'wca' AND s.scramble_subset = '333' AND s.user_id = $1
		 GROUP BY s.session_id, se.name
		 ORDER BY count DESC`,
		userId
	);
	if (wca333.length === 0) {
		console.log('  (wca/333 solve yok!)');
	} else {
		for (const r of wca333) {
			const isCurrent = r.session_id === sessionId ? ' <-- CURRENT' : '';
			console.log(`  session_id=${r.session_id?.slice(0, 8)}... | name="${r.session_name ?? '??'}" | count=${Number(r.count)}${isCurrent}`);
		}
	}

	// 4. wca/NULL solvelerin session dagilimi
	console.log(`\n=== 4) wca/NULL solveler session dagilimi ===\n`);
	const wcaNull = await prisma.$queryRawUnsafe<Array<{ session_id: string | null; session_name: string | null; count: bigint }>>(
		`SELECT s.session_id, se.name AS session_name, COUNT(*)::bigint AS count
		 FROM solve s
		 LEFT JOIN session se ON se.id = s.session_id
		 WHERE s.cube_type = 'wca' AND s.scramble_subset IS NULL AND s.user_id = $1
		 GROUP BY s.session_id, se.name
		 ORDER BY count DESC`,
		userId
	);
	for (const r of wcaNull) {
		const isCurrent = r.session_id === sessionId ? ' <-- CURRENT' : '';
		console.log(`  session_id=${r.session_id?.slice(0, 8)}... | name="${r.session_name ?? '??'}" | count=${Number(r.count)}${isCurrent}`);
	}

	// 5. from_timer dagilimi tum wca/333 icin
	console.log(`\n=== 5) wca/333 -> from_timer dagilimi ===\n`);
	const fromTimer = await prisma.$queryRawUnsafe<Array<{ from_timer: boolean; trainer_name: string | null; count: bigint }>>(
		`SELECT from_timer, trainer_name, COUNT(*)::bigint AS count
		 FROM solve
		 WHERE cube_type = 'wca' AND scramble_subset = '333' AND user_id = $1
		 GROUP BY from_timer, trainer_name
		 ORDER BY count DESC`,
		userId
	);
	for (const r of fromTimer) {
		console.log(`  from_timer=${r.from_timer} | trainer_name=${r.trainer_name ?? 'NULL'} | ${Number(r.count)}`);
	}

	// 6. Session ozeti
	console.log(`\n=== 6) Tum sessionlarin ozeti ===\n`);
	const allSessions = await prisma.session.findMany({
		where: { user_id: userId },
		select: { id: true, name: true, created_at: true, _count: { select: { solves: true } } },
		orderBy: { created_at: 'asc' },
	});
	for (const s of allSessions) {
		const isCurrent = s.id === sessionId ? ' <-- CURRENT' : '';
		console.log(`  ${s.created_at.toISOString().slice(0, 10)} | "${s.name}" | ${s._count.solves} solve${isCurrent}`);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
}).finally(() => prisma.$disconnect());
