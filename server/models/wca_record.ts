import {PrismaClient} from '@prisma/client';
import {WcaRecord} from '../schemas/WcaRecord.schema';
import {InternalUserAccount} from '../schemas/UserAccount.schema';
import {Integration} from '../schemas/Integration.schema';
import {WcaApiService, WcaPerson} from '../services/WcaApiService';

const prisma = new PrismaClient();

/**
 * Fetch and save WCA records for a user
 */
export async function fetchAndSaveWcaRecords(user: InternalUserAccount, integration: Integration): Promise<WcaRecord[]> {
	const wcaPerson = await WcaApiService.fetchWcaRecordsForUser(integration);
	
	if (!wcaPerson) {
		throw new Error('Failed to fetch WCA records');
	}

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
