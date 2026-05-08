/**
 * One-shot temizlik: 0 sezonu olan kullanicilara default "Yeni Sezon" olusturur.
 *
 * Kullanim:
 *   npx ts-node scripts/backfill-default-sessions.ts
 *   npx ts-node scripts/backfill-default-sessions.ts --dry-run
 *
 * Neden var: Eski signup akislari default sezon olusturmuyordu. Client tarafinda
 * race-prone bir auto-create logic'i bu bosluku doldurmaya calisiyordu ama
 * hayalet sezonlara sebep oluyordu. Bu script, fix sonrasi tek seferlik calisir.
 *
 * Idempotent: ayni kullaniciya iki kez sezon olusturmaz (en az 1 sezonu olanlar atlanir).
 */

import { PrismaClient } from '@prisma/client';
import uniqid from 'uniqid';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

async function main() {
	console.log(dryRun ? '[DRY RUN] Hicbir yazma yapilmayacak.' : '[LIVE] Yazma modu aktif.');

	// 0 sezonu olan kullanicilari bul
	const usersWithoutSessions = await prisma.userAccount.findMany({
		where: {
			sessions: {
				none: {},
			},
		},
		select: {
			id: true,
			username: true,
			email: true,
			created_at: true,
		},
	});

	console.log(`0 sezonu olan kullanici sayisi: ${usersWithoutSessions.length}`);

	if (!usersWithoutSessions.length) {
		console.log('Yapacak is yok, cikiyorum.');
		return;
	}

	// Ozet log
	for (const u of usersWithoutSessions) {
		console.log(`  - ${u.username} (${u.email}) - kayit: ${u.created_at.toISOString()}`);
	}

	if (dryRun) {
		console.log(`[DRY RUN] ${usersWithoutSessions.length} kullaniciya default sezon olusturulacak.`);
		return;
	}

	// Toplu olusturma
	const data = usersWithoutSessions.map((u) => ({
		id: uniqid('se-'),
		name: 'Yeni Sezon',
		order: 0,
		user_id: u.id,
	}));

	const result = await prisma.session.createMany({
		data,
		skipDuplicates: true,
	});

	console.log(`Olusturulan sezon sayisi: ${result.count}`);
}

main()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
