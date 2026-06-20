import {getPrisma} from '../database';
import {ZktRoundFormat} from '@prisma/client';
import {generateScramble, hasGenerator} from '../../shared/scramble/registry';

// Side-effect: register generators (idempotent — re-importing is safe).
import '../../shared/scramble/generators/scramble-pyraminx';
import '../../shared/scramble/generators/scramble-skewb';
import '../../shared/scramble/generators/scramble-333lse';
import '../../shared/scramble/generators/megascramble';
import '../../shared/scramble/generators/utilscramble';
import '../../shared/scramble/generators/scramble-333';
import '../../shared/scramble/generators/scramble-444';
import '../../shared/scramble/generators/scramble-sq1';
import '../../shared/scramble/generators/scramble-megaminx';
import '../../shared/scramble/generators/scramble-222';
import {generateClockScramble} from '../../client/util/cubes/scramble_clock';

// WCA event id → cstimer scramble type id.
// 333oh uses 333 scramble. BLD events use sighted scramble (no orientation).
// FMC uses 333fm. MBLD uses r3ni (random-state, large count).
const EVENT_TO_SCRAMBLE_TYPE: Record<string, string> = {
	'222': '222so',
	'333': '333',
	'333oh': '333',
	'333bf': '333',
	'333fm': '333fm',
	'333mbf': '333',
	'444': '444m',
	'444bf': '444bld',
	'555': '555wca',
	'555bf': '555bld',
	'666': '666wca',
	'777': '777wca',
	'pyram': 'pyrso',
	'skewb': 'skbso',
	'sq1': 'sqrs',
	'clock': 'clock',
	'minx': 'mgmp',
};

function generateScrambleForEvent(eventId: string): string {
	if (eventId === 'clock') {
		try {
			return generateClockScramble();
		} catch {
			// fall through
		}
	}
	const scrambleType = EVENT_TO_SCRAMBLE_TYPE[eventId] || '333';
	try {
		if (hasGenerator(scrambleType)) {
			return generateScramble(scrambleType).replace(/\s+/g, ' ').trim();
		}
	} catch (e) {
		console.error(`[zkt-scramble] generator failed for ${eventId} (${scrambleType}):`, e);
	}
	// Last-ditch fallback so a missing generator never blocks round opening.
	try {
		return generateScramble('333').replace(/\s+/g, ' ').trim();
	} catch {
		return "R U R' U' R' F R2 U' R' U' R U R' F'";
	}
}

function attemptCountForFormat(format: ZktRoundFormat): number {
	switch (format) {
		case 'BO1':
			return 1;
		case 'BO2':
			return 2;
		case 'BO3':
		case 'MO3':
			return 3;
		case 'AO5':
			return 5;
		default:
			return 5;
	}
}

interface ScrambleCreate {
	round_id: string;
	group_id: string | null;
	attempt_number: number;
	is_extra: boolean;
	scramble_string: string;
}

/**
 * Idempotent: only creates scrambles that don't already exist for the round.
 * Generates `attemptCount` regular scrambles + 2 extras (used for replays /
 * +2 disputes per WCA regulations).
 *
 * Per-group scrambles (WCA parity): when the round has groups, EACH group gets
 * its OWN distinct scramble set so no two groups share scrambles. When the round
 * has no groups yet, a single round-level set is created (group_id = null),
 * preserving the legacy behaviour. Caller decides when to invoke — usually on
 * the round's start transition.
 */
export async function ensureScramblesForRound(roundId: string): Promise<void> {
	const prisma = getPrisma();
	const round = await prisma.zktRound.findUnique({
		where: {id: roundId},
		include: {
			comp_event: true,
			groups: {orderBy: {group_number: 'asc'}, select: {id: true}},
			scrambles: {select: {group_id: true, attempt_number: true}},
		},
	});
	if (!round) return;

	const eventId = round.comp_event.event_id;
	const baseCount = attemptCountForFormat(round.format);
	const totalNeeded = baseCount + 2; // +2 extras

	const toCreate: ScrambleCreate[] = [];

	// Build the missing attempts for one "bucket" (a group, or the round-level
	// null bucket), each with a freshly generated scramble.
	const addBucket = (groupId: string | null) => {
		const existing = new Set(
			round.scrambles.filter((s) => s.group_id === groupId).map((s) => s.attempt_number)
		);
		for (let i = 1; i <= totalNeeded; i++) {
			if (existing.has(i)) continue;
			toCreate.push({
				round_id: roundId,
				group_id: groupId,
				attempt_number: i,
				is_extra: i > baseCount,
				scramble_string: generateScrambleForEvent(eventId),
			});
		}
	};

	if (round.groups.length > 0) {
		for (const g of round.groups) addBucket(g.id);
	} else {
		addBucket(null);
	}

	if (toCreate.length === 0) return;
	await prisma.zktScramble.createMany({data: toCreate});
}

/**
 * Regenerate ALL scrambles for a round. Destroys existing — only allowed
 * when the round has no recorded results yet (caller checks).
 */
export async function regenerateScramblesForRound(roundId: string): Promise<void> {
	const prisma = getPrisma();
	await prisma.zktScramble.deleteMany({where: {round_id: roundId}});
	await ensureScramblesForRound(roundId);
}
