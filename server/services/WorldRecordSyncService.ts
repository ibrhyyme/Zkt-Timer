import axios from 'axios';
import {getPrisma} from '../database';
import {logger} from './logger';
import {WcaApiService} from './WcaApiService';

const ROBIN_API_BASE = 'https://raw.githubusercontent.com/robiningelbrecht/wca-rest-api/refs/heads/v1';

interface RobinRankItem {
	rankType: 'single' | 'average';
	personId: string;
	eventId: string;
	best: number;
	rank: {world: number; continent: number; country: number};
}

interface RobinRankResponse {
	pagination: {page: number; size: number};
	total: number;
	items: RobinRankItem[];
}

interface RobinPersonResponse {
	id: string;
	name: string;
	country: string;
	gender?: string;
}

async function fetchRankFile(eventId: string, type: 'single' | 'average'): Promise<RobinRankItem | null> {
	const url = `${ROBIN_API_BASE}/rank/world/${type}/${eventId}.json`;
	try {
		const res = await axios.get<RobinRankResponse>(url, {timeout: 15000});
		return res.data?.items?.[0] ?? null;
	} catch (error) {
		logger.error(`[WRSync] Failed to fetch ${url}:`, error.message);
		return null;
	}
}

async function fetchPersonName(wcaId: string): Promise<string | null> {
	const url = `${ROBIN_API_BASE}/persons/${wcaId}.json`;
	try {
		const res = await axios.get<RobinPersonResponse>(url, {timeout: 15000});
		return res.data?.name ?? null;
	} catch {
		return null;
	}
}

export async function syncAllWorldRecords(): Promise<{updated: number; failed: number}> {
	const events = WcaApiService.getRankingEvents();
	const prisma = getPrisma();
	let updated = 0;
	let failed = 0;

	logger.info(`[WRSync] Starting sync for ${events.length} events`);

	for (const eventId of events) {
		try {
			const isBestOfOnly = WcaApiService.getBestOfEvents().includes(eventId);
			const isMbld = eventId === '333mbf';

			const [singleItem, averageItem] = await Promise.all([
				fetchRankFile(eventId, 'single'),
				isMbld ? Promise.resolve(null) : fetchRankFile(eventId, 'average'),
			]);

			const nameLookups = new Map<string, Promise<string | null>>();
			if (singleItem && !nameLookups.has(singleItem.personId)) {
				nameLookups.set(singleItem.personId, fetchPersonName(singleItem.personId));
			}
			if (averageItem && !nameLookups.has(averageItem.personId)) {
				nameLookups.set(averageItem.personId, fetchPersonName(averageItem.personId));
			}
			const names = await Promise.all(nameLookups.values());
			const nameMap = new Map<string, string | null>();
			[...nameLookups.keys()].forEach((id, i) => nameMap.set(id, names[i]));

			await (prisma as any).worldRecord.upsert({
				where: {event_id: eventId},
				update: {
					single_best: singleItem?.best ?? null,
					single_person_id: singleItem?.personId ?? null,
					single_person_name: singleItem ? nameMap.get(singleItem.personId) ?? null : null,
					average_best: averageItem?.best ?? null,
					average_person_id: averageItem?.personId ?? null,
					average_person_name: averageItem ? nameMap.get(averageItem.personId) ?? null : null,
					last_synced_at: new Date(),
				},
				create: {
					event_id: eventId,
					single_best: singleItem?.best ?? null,
					single_person_id: singleItem?.personId ?? null,
					single_person_name: singleItem ? nameMap.get(singleItem.personId) ?? null : null,
					average_best: averageItem?.best ?? null,
					average_person_id: averageItem?.personId ?? null,
					average_person_name: averageItem ? nameMap.get(averageItem.personId) ?? null : null,
				},
			});
			updated++;
		} catch (err) {
			failed++;
			logger.error(`[WRSync] Failed to upsert ${eventId}:`, err);
		}
	}

	logger.info(`[WRSync] Done. Updated: ${updated}, Failed: ${failed}`);
	return {updated, failed};
}

export async function getWorldRecordsFromDb(): Promise<Record<string, {single: number; average: number}>> {
	const prisma = getPrisma();
	const rows = await (prisma as any).worldRecord.findMany();
	const map: Record<string, {single: number; average: number}> = {};
	for (const row of rows) {
		map[row.event_id] = {
			single: row.single_best ?? 0,
			average: row.average_best ?? 0,
		};
	}
	return map;
}
