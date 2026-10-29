/**
 * Exports the gyro reconstructions their owners marked wrong (or all rated ones), with
 * everything needed to replay the detection on them, to tune the detector on real failures.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/export-reconstruction-feedback.ts out.json
 *   npx ts-node --transpile-only scripts/export-reconstruction-feedback.ts out.json --all
 *
 * Read only. No user is identified in the file: no user id, name or e-mail, only what the
 * cube recorded. Each entry turns into a test fixture the way
 * shared/smart_cube/__tests__/fixtures/gani4_zperm_solve.json was made: smart_turns and
 * smart_gyro exactly as stored, plus the steps, for detectCubeRotations and
 * reconstructWithRotations to be run on it again.
 */

import { writeFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const outFile = process.argv[2];
const all = process.argv.includes('--all');

async function main() {
	if (!outFile || outFile.startsWith('--')) {
		console.error('Usage: npx ts-node --transpile-only scripts/export-reconstruction-feedback.ts out.json [--all]');
		process.exit(1);
	}

	const solves = await prisma.solve.findMany({
		where: {
			reconstruction_vote: all ? { not: null } : -1,
			smart_turns: { not: null },
		},
		select: {
			id: true,
			created_at: true,
			reconstruction_vote: true,
			scramble: true,
			smart_turns: true,
			smart_rotations: true,
			smart_gyro: true,
			raw_time: true,
			solve_method_steps: {
				orderBy: { step_index: 'asc' },
				select: { step_name: true, turns: true },
			},
		},
		orderBy: { created_at: 'desc' },
	});

	writeFileSync(outFile, JSON.stringify({ exported_at: new Date().toISOString(), count: solves.length, solves }, null, 1));
	const withGyro = solves.filter((s) => s.smart_gyro).length;
	console.log(`${solves.length} solve(s) written to ${outFile} (${withGyro} with the raw gyro stream).`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
