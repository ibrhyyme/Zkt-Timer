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
			competition: true,
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
			competition: true,
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
 * Full rebuild of records + result tags for one event.
 *
 * checkAndApplyRecords only ever ADDS records, so any backwards change —
 * deleting a result, editing a finalized result, reopening a round — leaves
 * stale ZktRecord rows and stale NR/PR tags behind. This rescans every result
 * of the event's finished rounds in chronological order (competition start
 * date, then round number, then entry time) and rewrites the record table and
 * tags from scratch. Per-event data volume is small, so a full rebuild is the
 * simplest correct approach (simplified from recordranks' cancel/setFutureRecords).
 */
export async function rebuildRecordsForEvent(eventId: string): Promise<void> {
	const prisma = getPrisma();

	const results = await prisma.zktResult.findMany({
		where: {round: {status: 'FINISHED', comp_event: {event_id: eventId}}},
		include: {round: {include: {comp_event: {include: {competition: true}}}}},
	});

	const sorted = results.slice().sort((a, b) => {
		const da = a.round.comp_event.competition.date_start.getTime();
		const db = b.round.comp_event.competition.date_start.getTime();
		if (da !== db) return da - db;
		if (a.round.round_number !== b.round.round_number) {
			return a.round.round_number - b.round.round_number;
		}
		return a.created_at.getTime() - b.created_at.getTime();
	});

	const newRecords: {
		event_id: string;
		record_type: string;
		value: number;
		user_id: string;
		result_id: string;
		competition_id: string;
		set_at: Date;
	}[] = [];
	const tags = new Map<string, {single: string | null; average: string | null}>();

	for (const recordType of ['single', 'average'] as RecordType[]) {
		let runningRecord: number | null = null;
		const pbByUser = new Map<string, number>();

		for (const r of sorted) {
			const value = recordType === 'single' ? r.best : r.average;
			const entry = tags.get(r.id) ?? {single: null, average: null};
			let tag: string | null = null;

			if (value !== null && value > 0) {
				if (runningRecord === null || value < runningRecord) {
					runningRecord = value;
					newRecords.push({
						event_id: eventId,
						record_type: recordType,
						value,
						user_id: r.user_id,
						result_id: r.id,
						competition_id: r.round.comp_event.competition_id,
						set_at: r.round.comp_event.competition.date_start,
					});
					tag = 'NR';
				} else {
					const pb = pbByUser.get(r.user_id);
					if (pb === undefined || value < pb) tag = 'PR';
				}
				const pb = pbByUser.get(r.user_id);
				if (pb === undefined || value < pb) pbByUser.set(r.user_id, value);
			}

			entry[recordType] = tag;
			tags.set(r.id, entry);
		}
	}

	// Apply atomically: wipe + rewrite records, update only changed tags.
	const tagUpdates = sorted
		.filter((r) => {
			const t = tags.get(r.id);
			return (
				t && (r.single_record_tag !== t.single || r.average_record_tag !== t.average)
			);
		})
		.map((r) => {
			const t = tags.get(r.id)!;
			return prisma.zktResult.update({
				where: {id: r.id},
				data: {single_record_tag: t.single, average_record_tag: t.average},
			});
		});

	await prisma.$transaction([
		prisma.zktRecord.deleteMany({where: {event_id: eventId}}),
		...newRecords.map((rec) => prisma.zktRecord.create({data: rec})),
		...tagUpdates,
	]);
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
