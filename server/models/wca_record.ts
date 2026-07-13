import {PrismaClient} from '@prisma/client';
import {WcaRecord} from '../schemas/WcaRecord.schema';
import {PublicWcaProfile} from '../schemas/PublicWcaProfile.schema';
import {InternalUserAccount} from '../schemas/UserAccount.schema';
import {Integration} from '../schemas/Integration.schema';
import {WcaApiService, WcaPerson} from '../services/WcaApiService';
import {recalculateUserRanking} from './ranking';

const prisma = new PrismaClient();

/**
 * Fetch and save WCA records for a user
 */
export async function fetchAndSaveWcaRecords(user: InternalUserAccount, integration: Integration): Promise<WcaRecord[]> {
	const wcaPerson = await WcaApiService.fetchWcaRecordsForUser(integration);
	
	if (!wcaPerson) {
		throw new Error('Failed to fetch WCA records');
	}

	// WCA person metadata'yi Integration'a kaydet
	await prisma.integration.update({
		where: { id: integration.id },
		data: {
			wca_country_iso2: wcaPerson.country_iso2 || null,
			wca_competition_count: wcaPerson.competition_count ?? null,
			wca_medal_gold: wcaPerson.medals?.gold ?? null,
			wca_medal_silver: wcaPerson.medals?.silver ?? null,
			wca_medal_bronze: wcaPerson.medals?.bronze ?? null,
			wca_record_nr: wcaPerson.records?.national ?? null,
			wca_record_cr: wcaPerson.records?.continental ?? null,
			wca_record_wr: wcaPerson.records?.world ?? null,
		},
	});

	const records: WcaRecord[] = [];
	const supportedEvents = WcaApiService.getSupportedEvents();

	for (const eventCode of supportedEvents) {
		const personalRecord = wcaPerson.personal_records[eventCode];
		
		if (!personalRecord || (!personalRecord.single && !personalRecord.average)) {
			continue;
		}

		// Update or create record
		const existingRecord = await prisma.wcaRecord.findUnique({
			where: {
				user_id_wca_event: {
					user_id: user.id,
					wca_event: eventCode
				}
			}
		});

		const recordData = {
			user_id: user.id,
			integration_id: integration.id,
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
			updated_at: new Date()
		};

		let record;
		if (existingRecord) {
			record = await prisma.wcaRecord.update({
				where: { id: existingRecord.id },
				data: recordData,
				include: {
					integration: true,
					user: true
				}
			});
		} else {
			record = await prisma.wcaRecord.create({
				data: {
					...recordData,
					published: false, // Default to unpublished
					created_at: new Date()
				},
				include: {
					integration: true,
					user: true
				}
			});
		}

		records.push(record as WcaRecord);
	}

	// Recalculate Kinch + SoR scores after WCA data refresh
	try {
		await recalculateUserRanking(user.id);
	} catch (err) {
		console.error(`[Rankings] Failed to recalculate ranking for user ${user.id}:`, err);
	}

	return records;
}

/**
 * Get WCA records for a user
 */
export async function getWcaRecords(userId: string): Promise<WcaRecord[]> {
	return prisma.wcaRecord.findMany({
		where: { user_id: userId },
		include: {
			integration: true,
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
	return prisma.wcaRecord.findMany({
		where: { 
			user_id: userId,
			published: true
		},
		include: {
			integration: true,
			user: true
		},
		orderBy: {
			wca_event: 'asc'
		}
	}) as Promise<WcaRecord[]>;
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

	const integration = await prisma.integration.findFirst({
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
		const records = await prisma.wcaRecord.findMany({
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
	const record = await prisma.wcaRecord.findFirst({
		where: {
			id: recordId,
			user_id: userId
		}
	});

	if (!record) {
		throw new Error('Record not found or access denied');
	}

	return prisma.wcaRecord.update({
		where: { id: recordId },
		data: { published: true },
		include: {
			integration: true,
			user: true
		}
	}) as Promise<WcaRecord>;
}

/**
 * Unpublish a WCA record
 */
export async function unpublishWcaRecord(recordId: string, userId: string): Promise<WcaRecord> {
	// Verify ownership
	const record = await prisma.wcaRecord.findFirst({
		where: {
			id: recordId,
			user_id: userId
		}
	});

	if (!record) {
		throw new Error('Record not found or access denied');
	}

	return prisma.wcaRecord.update({
		where: { id: recordId },
		data: { published: false },
		include: {
			integration: true,
			user: true
		}
	}) as Promise<WcaRecord>;
}

/**
 * Get WCA record by ID
 */
export async function getWcaRecordById(recordId: string): Promise<WcaRecord | null> {
	return prisma.wcaRecord.findUnique({
		where: { id: recordId },
		include: {
			integration: true,
			user: true
		}
	}) as Promise<WcaRecord | null>;
}
