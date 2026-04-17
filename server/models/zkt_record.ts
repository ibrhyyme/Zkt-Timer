import {getPrisma} from '../database';
import {ZktRecord} from '@prisma/client';

export type RecordType = 'single' | 'average';

/**
 * Get the current best record for an event/type.
 */
export async function getCurrentRecord(
	eventId: string,
	recordType: RecordType
): Promise<ZktRecord | null> {
	const prisma = getPrisma();
	return prisma.zktRecord.findFirst({
		where: {event_id: eventId, record_type: recordType},
		orderBy: {value: 'asc'},
	});
}

/**
 * Get all current records, one per event/type (best value).
 */
export async function getAllCurrentRecords(): Promise<ZktRecord[]> {
	const prisma = getPrisma();
	// Group by event_id + record_type, get best value
	const records = await prisma.zktRecord.findMany({
		orderBy: [{event_id: 'asc'}, {record_type: 'asc'}, {value: 'asc'}],
		include: {
			user: {
				include: {
					profile: {include: {pfp_image: true}},
					integrations: true,
					badges: {include: {badge_type: true}},
				},
			},
		},
	});

	// Dedupe: keep only best per (event_id, record_type)
	const seen = new Set<string>();
	const deduped: ZktRecord[] = [];
	for (const r of records) {
		const key = `${r.event_id}|${r.record_type}`;
		if (!seen.has(key)) {
			seen.add(key);
			deduped.push(r);
		}
	}
	return deduped;
}

/**
 * Get history of records for a specific event/type.
 */
export async function getRecordHistory(
	eventId: string,
	recordType: RecordType
): Promise<ZktRecord[]> {
	const prisma = getPrisma();
	return prisma.zktRecord.findMany({
		where: {event_id: eventId, record_type: recordType},
		orderBy: {set_at: 'desc'},
		include: {
			user: {
				include: {
					profile: {include: {pfp_image: true}},
					integrations: true,
				},
			},
		},
	});
}

/**
 * Insert a new record.
 */
export async function insertRecord(params: {
	eventId: string;
	recordType: RecordType;
	value: number;
	userId: string;
	resultId: string;
	competitionId: string;
}): Promise<ZktRecord> {
	const prisma = getPrisma();
	return prisma.zktRecord.create({
		data: {
			event_id: params.eventId,
			record_type: params.recordType,
			value: params.value,
			user_id: params.userId,
			result_id: params.resultId,
			competition_id: params.competitionId,
		},
	});
}

/**
 * Personal best lookup for a given user + event + record type. Scans all
 * ZktResults the user has in this event (across any finalized round) and
 * returns the smallest valid value, or null if none yet.
 */
async function getUserPersonalBest(
	userId: string,
	eventId: string,
	recordType: RecordType,
	excludeResultId?: string
): Promise<number | null> {
	const prisma = getPrisma();
	const column = recordType === 'single' ? 'best' : 'average';
	const rows = await prisma.zktResult.findMany({
		where: {
			user_id: userId,
			round: {comp_event: {event_id: eventId}},
			...(excludeResultId ? {id: {not: excludeResultId}} : {}),
		},
		select: {best: true, average: true},
	});
	let pb: number | null = null;
	for (const r of rows) {
		const v = (r as any)[column] as number | null;
		if (v !== null && v !== undefined && v > 0) {
			if (pb === null || v < pb) pb = v;
		}
	}
	return pb;
}

/**
 * Check a finalized result against current records + user PB.
 * Creates new record entries if beaten. Tag priority: NR > PR.
 * Returns tags to set on the result.
 */
export async function checkAndApplyRecords(params: {
	resultId: string;
	userId: string;
	eventId: string;
	competitionId: string;
	best: number | null;
	average: number | null;
}): Promise<{singleTag: string | null; averageTag: string | null}> {
	let singleTag: string | null = null;
	let averageTag: string | null = null;

	// Single
	if (params.best !== null && params.best > 0) {
		const current = await getCurrentRecord(params.eventId, 'single');
		if (!current || params.best < current.value) {
			await insertRecord({
				eventId: params.eventId,
				recordType: 'single',
				value: params.best,
				userId: params.userId,
				resultId: params.resultId,
				competitionId: params.competitionId,
			});
			singleTag = 'NR';
		} else {
			// Not a national record — check personal best instead.
			const pb = await getUserPersonalBest(
				params.userId,
				params.eventId,
				'single',
				params.resultId
			);
			if (pb === null || params.best < pb) {
				singleTag = 'PR';
			}
		}
	}

	// Average
	if (params.average !== null && params.average > 0) {
		const current = await getCurrentRecord(params.eventId, 'average');
		if (!current || params.average < current.value) {
			await insertRecord({
				eventId: params.eventId,
				recordType: 'average',
				value: params.average,
				userId: params.userId,
				resultId: params.resultId,
				competitionId: params.competitionId,
			});
			averageTag = 'NR';
		} else {
			const pb = await getUserPersonalBest(
				params.userId,
				params.eventId,
				'average',
				params.resultId
			);
			if (pb === null || params.average < pb) {
				averageTag = 'PR';
			}
		}
	}

	return {singleTag, averageTag};
}
