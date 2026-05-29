/**
 * One-shot cleanup: creates a default "New Session" for users with 0 sessions.
 *
 * Usage:
 *   npx ts-node scripts/backfill-default-sessions.ts
 *   npx ts-node scripts/backfill-default-sessions.ts --dry-run
 *
 * Why it exists: Old signup flows did not create a default session. Client-side
 * had a race-prone auto-create logic trying to fill this gap, but it caused
 * ghost sessions. This script runs once after the fix.
 *
 * Idempotent: does not create duplicate sessions for the same user (users with at least 1 session are skipped).
 */

import { PrismaClient } from '@prisma/client';
import uniqid from 'uniqid';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

async function main() {
	console.log(dryRun ? '[DRY RUN] No writes will be performed.' : '[LIVE] Write mode active.');

	// Find users with 0 sessions
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

	console.log(`Number of users with 0 sessions: ${usersWithoutSessions.length}`);

	if (!usersWithoutSessions.length) {
		console.log('Nothing to do, exiting.');
		return;
	}

	// Summary log
	for (const u of usersWithoutSessions) {
		console.log(`  - ${u.username} (${u.email}) - registered: ${u.created_at.toISOString()}`);
	}

	if (dryRun) {
		console.log(`[DRY RUN] Default session will be created for ${usersWithoutSessions.length} users.`);
		return;
	}

	// Batch creation
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

	console.log(`Sessions created: ${result.count}`);
}

main()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
