import {getPrisma} from '../database';
import {WcaRecord} from '../schemas/WcaRecord.schema';
import {PublicWcaProfile} from '../schemas/PublicWcaProfile.schema';
import {InternalUserAccount} from '../schemas/UserAccount.schema';
import {Integration} from '../schemas/Integration.schema';
import {WcaApiService, WcaPerson} from '../services/WcaApiService';
import {publicIntegrationSelect} from './integration';

/**
 * Fetch and save WCA records for a user
 */
export async function fetchAndSaveWcaRecords(user: InternalUserAccount, integration: Integration): Promise<WcaRecord[]> {
	const wcaPerson = await WcaApiService.fetchWcaRecordsForUser(integration);

	if (!wcaPerson) {
		throw new Error('Failed to fetch WCA records');
	}

	return saveWcaPersonRecords(user.id, integration.id, wcaPerson);
}

/**
 * Whether a record in an event the user had no record in yet starts out
 * published. A user who already shows WCA records on their profile expects a
 * new event there too: it used to arrive hidden, so after their first 4x4 the
 * profile looked incomplete until they found the manage panel. A user who
 * publishes none keeps the WCA tab off on purpose, so a new event stays hidden.
 * On the very first fetch nothing is published yet, so everything starts
 * hidden, as before.
 */
export function newRecordStartsPublished(publishedCount: number): boolean {
	return publishedCount > 0;
}

/**
 * Write an already-fetched WCA person payload into the user's WcaRecord rows
 * and the integration's career numbers. Shared by the manual refresh, the
 * nightly refresh and the results-official notification (which fetches the
 * same payload anyway, so it costs no extra WCA request).
 */
export async function saveWcaPersonRecords(
	userId: string,
	integrationId: string,
	wcaPerson: WcaPerson
): Promise<WcaRecord[]> {
	const prisma = getPrisma();

	await prisma.integration.update({
		where: {id: integrationId},
		data: {
			wca_country_iso2: wcaPerson.country_iso2 || null,
			wca_competition_count: wcaPerson.competition_count ?? null,
			wca_medal_gold: wcaPerson.medals?.gold ?? null,
			wca_medal_silver: wcaPerson.medals?.silver ?? null,
			wca_medal_bronze: wcaPerson.medals?.bronze ?? null,
			wca_record_nr: wcaPerson.records?.national ?? null,
			wca_record_cr: wcaPerson.records?.continental ?? null,
			wca_record_wr: wcaPerson.records?.world ?? null,
			wca_records_synced_at: new Date(),
		},
	});

	const publishNew = newRecordStartsPublished(
		await prisma.wcaRecord.count({where: {user_id: userId, published: true}})
	);

	const records: WcaRecord[] = [];
	const supportedEvents = WcaApiService.getSupportedEvents();

	for (const eventCode of supportedEvents) {
		const personalRecord = wcaPerson.personal_records?.[eventCode];

		if (!personalRecord || (!personalRecord.single && !personalRecord.average)) {
			continue;
		}

		const existingRecord = await prisma.wcaRecord.findUnique({
			where: {
				user_id_wca_event: {
					user_id: userId,
					wca_event: eventCode,
				},
			},
		});

		const recordData = {
			user_id: userId,
			integration_id: integrationId,
			wca_event: eventCode,
			single_record: personalRecord.single?.best || null,
			average_record: personalRecord.average?.best || null,
			single_world_rank: personalRecord.single?.world_rank || null,
			average_world_rank: personalRecord.average?.world_rank || null,
			single_continent_rank: personalRecord.single?.continent_rank || null,
			average_continent_rank: personalRecord.average?.continent_rank || null,
			single_country_rank: personalRecord.single?.country_rank || null,
			average_country_rank: personalRecord.average?.country_rank || null,
			fetched_at: new Date(),
			updated_at: new Date(),
		};

		let record;
		if (existingRecord) {
			record = await prisma.wcaRecord.update({
				where: {id: existingRecord.id},
				data: recordData,
				include: {
					integration: {select: publicIntegrationSelect},
					user: true,
				},
			});
		} else {
			record = await prisma.wcaRecord.create({
				data: {
					...recordData,
					published: publishNew,
					created_at: new Date(),
				},
				include: {
					integration: {select: publicIntegrationSelect},
					user: true,
				},
			});
		}

		records.push(record as WcaRecord);
	}

	return records;
}

/**
 * Save an already-fetched person payload for this user, but only when it is
 * the WCA ID their (non-revoked) integration is linked to. Returns whether
 * anything was written.
 */
export async function saveWcaPersonForUser(userId: string, wcaId: string, wcaPerson: WcaPerson): Promise<boolean> {
	const integration = await getPrisma().integration.findFirst({
		where: {user_id: userId, service_name: 'wca', wca_id: wcaId, revoked_at: null},
		select: {id: true},
	});
	if (!integration) {
		return false;
	}
	await saveWcaPersonRecords(userId, integration.id, wcaPerson);
	return true;
}

interface RankFields {
	single_world_rank?: number | null;
	average_world_rank?: number | null;
	single_continent_rank?: number | null;
	average_continent_rank?: number | null;
	integration?: {wca_show_rank?: boolean | null} | null;
}

/**
 * Applies the wca_show_rank switch ("show world ranking") to records leaving
 * for a profile: with it off, the world and continent ranks are blanked here,
 * so they never reach a viewer. The switch used to hide only the summary's best
 * world rank while every PB card kept showing "#1234 World". The country rank
 * stays: the switch does not name it, and it is the record's local context.
 */
export function maskHiddenWcaRanks<T extends RankFields>(records: T[]): T[] {
	return records.map((record) =>
		record.integration?.wca_show_rank === false
			? {
					...record,
					single_world_rank: null,
					average_world_rank: null,
					single_continent_rank: null,
					average_continent_rank: null,
				}
			: record
	);
}

/**
 * Get WCA records for a user
 */
export async function getWcaRecords(userId: string): Promise<WcaRecord[]> {
	return getPrisma().wcaRecord.findMany({
		where: { user_id: userId },
		include: {
			integration: {select: publicIntegrationSelect},
			user: true
		},
		orderBy: {
			wca_event: 'asc'
		}
	}) as Promise<WcaRecord[]>;
}

/**
 * Get published WCA records for a user (for public profile)
 */
export async function getPublishedWcaRecords(userId: string): Promise<WcaRecord[]> {
	const records = await getPrisma().wcaRecord.findMany({
		where: { 
			user_id: userId,
			published: true
		},
		include: {
			integration: {select: publicIntegrationSelect},
			user: true
		},
		orderBy: {
			wca_event: 'asc'
		}
	});
	return maskHiddenWcaRanks(records) as WcaRecord[];
}

/**
 * Get public WCA summary metadata for a user's profile.
 *
 * Independent of published WcaRecord rows: the visibility toggles decide what
 * is shown, not whether any event record is published. Best world rank is
 * computed from ALL of the user's records (world rank is public on WCA anyway).
 * Values whose visibility toggle is off are nulled out server-side.
 */
export async function getPublicWcaProfile(userId: string): Promise<PublicWcaProfile | null> {
	if (!userId) {
		return null;
	}

	const integration = await getPrisma().integration.findFirst({
		where: {
			user_id: userId,
			service_name: 'wca',
		},
	});

	if (!integration) {
		return null;
	}

	const showCompetitions = integration.wca_show_competitions !== false;
	const showMedals = integration.wca_show_medals !== false;
	const showRecords = integration.wca_show_records !== false;
	const showRank = integration.wca_show_rank !== false;

	// Best world rank across all records (published or not) — min single/average rank
	let bestWorldRank: number | null = null;
	let bestWorldRankEvent: string | null = null;

	if (showRank) {
		const records = await getPrisma().wcaRecord.findMany({
			where: {user_id: userId},
			select: {wca_event: true, single_world_rank: true, average_world_rank: true},
		});

		for (const rec of records) {
			if (rec.single_world_rank && (bestWorldRank === null || rec.single_world_rank < bestWorldRank)) {
				bestWorldRank = rec.single_world_rank;
				bestWorldRankEvent = rec.wca_event;
			}
			if (rec.average_world_rank && (bestWorldRank === null || rec.average_world_rank < bestWorldRank)) {
				bestWorldRank = rec.average_world_rank;
				bestWorldRankEvent = rec.wca_event;
			}
		}
	}

	return {
		wca_id: integration.wca_id ?? null,
		wca_country_iso2: integration.wca_country_iso2 ?? null,
		wca_competition_count: showCompetitions ? integration.wca_competition_count ?? null : null,
		wca_medal_gold: showMedals ? integration.wca_medal_gold ?? null : null,
		wca_medal_silver: showMedals ? integration.wca_medal_silver ?? null : null,
		wca_medal_bronze: showMedals ? integration.wca_medal_bronze ?? null : null,
		wca_record_nr: showRecords ? integration.wca_record_nr ?? null : null,
		wca_record_cr: showRecords ? integration.wca_record_cr ?? null : null,
		wca_record_wr: showRecords ? integration.wca_record_wr ?? null : null,
		wca_show_competitions: integration.wca_show_competitions,
		wca_show_medals: integration.wca_show_medals,
		wca_show_records: integration.wca_show_records,
		wca_show_rank: integration.wca_show_rank,
		wca_show_results: integration.wca_show_results,
		best_world_rank: bestWorldRank,
		best_world_rank_event: bestWorldRankEvent,
	};
}

/**
 * Publish a WCA record
 */
export async function publishWcaRecord(recordId: string, userId: string): Promise<WcaRecord> {
	// Verify ownership
	const record = await getPrisma().wcaRecord.findFirst({
		where: {
			id: recordId,
			user_id: userId
		}
	});

	if (!record) {
		throw new Error('Record not found or access denied');
	}

	return getPrisma().wcaRecord.update({
		where: { id: recordId },
		data: { published: true },
		include: {
			integration: {select: publicIntegrationSelect},
			user: true
		}
	}) as Promise<WcaRecord>;
}

/**
 * Unpublish a WCA record
 */
export async function unpublishWcaRecord(recordId: string, userId: string): Promise<WcaRecord> {
	// Verify ownership
	const record = await getPrisma().wcaRecord.findFirst({
		where: {
			id: recordId,
			user_id: userId
		}
	});

	if (!record) {
		throw new Error('Record not found or access denied');
	}

	return getPrisma().wcaRecord.update({
		where: { id: recordId },
		data: { published: false },
		include: {
			integration: {select: publicIntegrationSelect},
			user: true
		}
	}) as Promise<WcaRecord>;
}

/**
 * Get WCA record by ID
 */
export async function getWcaRecordById(recordId: string): Promise<WcaRecord | null> {
	return getPrisma().wcaRecord.findUnique({
		where: { id: recordId },
		include: {
			integration: {select: publicIntegrationSelect},
			user: true
		}
	}) as Promise<WcaRecord | null>;
}
