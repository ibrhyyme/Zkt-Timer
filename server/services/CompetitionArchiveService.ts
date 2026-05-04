import {getPrisma} from '../database';
import {logger} from './logger';
import {WcaApiService} from './WcaApiService';
import {getWcaLiveData, fetchLiveRoundResults, WcaLiveData, WcaLiveRoundData} from './WcaLiveService';
import {getSearchClient, ARCHIVED_COMP_INDEX} from './search';

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 gun
const FREEZE_AGE_DAYS = 30; // end_date'ten 30 gun sonra dondur

export interface ArchiveMeta {
	name?: string;
	start_date?: Date;
	end_date?: Date;
	country_iso2?: string | null;
	city?: string | null;
}

export interface ArchiveCacheLiveData {
	wcaLiveData: WcaLiveData | null;
	rounds: Record<string, WcaLiveRoundData | null>; // activityCode -> round result
}

export async function getArchivedCompetition(competitionId: string) {
	return getPrisma().archivedWcaCompetition.findUnique({
		where: {id: competitionId},
	});
}

export function isStaleArchive(archive: {is_frozen: boolean; last_synced_at: Date}): boolean {
	if (archive.is_frozen) return false;
	return Date.now() - archive.last_synced_at.getTime() > STALE_THRESHOLD_MS;
}

/**
 * Yarisma su an aktif mi (canli devam ediyor)?
 * start_date <= bugun <= end_date + 1 gun (timezone toleransi)
 *
 * Aktif yarismalarda arsivi BYPASS edip canli akisa dusulmeli — cunku
 * delegeler real-time veri giriyor, arsiv snapshot'i eski kalir.
 */
export function isCompetitionActive(archive: {start_date: Date; end_date: Date}): boolean {
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	const start = new Date(archive.start_date);
	start.setHours(0, 0, 0, 0);
	const end = new Date(archive.end_date);
	end.setHours(23, 59, 59, 999);
	end.setDate(end.getDate() + 1); // 1 gun ekstra timezone tolerans
	return now >= start && now <= end;
}

/**
 * Bir yarismayi WCA + WCA Live'dan cek ve DB'ye yaz (upsert).
 * Idempotent — kayit varsa guncellenir, yoksa olusturulur.
 *
 * @param competitionId WCA competition ID
 * @param meta Opsiyonel meta override (bulk import sirasinda comp list'ten geliyor)
 * @param prefetchedWcif Resolver zaten cektiyse tekrar cekme — direkt onu kullan
 */
export async function archiveCompetition(
	competitionId: string,
	meta?: ArchiveMeta,
	prefetchedWcif?: any,
): Promise<{success: boolean; error?: string}> {
	const prisma = getPrisma();

	// 1. WCIF cek (prefetch verilmediyse)
	let wcifData: any = prefetchedWcif;
	if (!wcifData) {
		try {
			wcifData = await WcaApiService.fetchCompetitionWcif(competitionId);
		} catch (err: any) {
			logger.warn('[Archive] WCIF fetch failed', {competitionId, err: err?.message});
			return {success: false, error: 'wcif_fetch_failed'};
		}
	}
	if (!wcifData) return {success: false, error: 'wcif_empty'};

	// 2. WCA Live cek (opsiyonel — eski yarismalarda olmayabilir)
	let liveDataPayload: ArchiveCacheLiveData | null = null;
	try {
		const liveData = await getWcaLiveData(competitionId);
		if (liveData) {
			const rounds: Record<string, WcaLiveRoundData | null> = {};
			// Tum round'lari paralel cek
			await Promise.all(
				liveData.roundMap.map(async (rm) => {
					try {
						const round = await fetchLiveRoundResults(rm.liveRoundId);
						rounds[rm.activityCode] = round;
					} catch {
						rounds[rm.activityCode] = null;
					}
				}),
			);
			liveDataPayload = {wcaLiveData: liveData, rounds};
		}
	} catch (err: any) {
		logger.warn('[Archive] WCA Live fetch failed (skipping)', {competitionId, err: err?.message});
	}

	// 3. Meta'yi WCIF'ten cikar veya override'i kullan
	const name = meta?.name || wcifData.name || competitionId;
	const startDate = meta?.start_date || extractStartDate(wcifData);
	const endDate = meta?.end_date || extractEndDate(wcifData);
	const countryIso2 = meta?.country_iso2 ?? null;
	const city = meta?.city ?? null;

	if (!startDate || !endDate) {
		logger.warn('[Archive] Could not extract dates', {competitionId});
		return {success: false, error: 'date_extract_failed'};
	}

	// 4. DB'ye upsert
	try {
		await prisma.archivedWcaCompetition.upsert({
			where: {id: competitionId},
			create: {
				id: competitionId,
				name,
				start_date: startDate,
				end_date: endDate,
				country_iso2: countryIso2,
				city,
				wcif_data: wcifData,
				live_data: liveDataPayload as any,
			},
			update: {
				name,
				start_date: startDate,
				end_date: endDate,
				country_iso2: countryIso2,
				city,
				wcif_data: wcifData,
				live_data: liveDataPayload as any,
				last_synced_at: new Date(),
			},
		});
	} catch (err: any) {
		logger.warn('[Archive] DB upsert failed', {competitionId, err: err?.message});
		return {success: false, error: 'db_upsert_failed'};
	}

	// 5. ES'e mirror — fire-and-forget, ES erisilemese bile arsiv DB'de
	indexCompetitionInES({
		id: competitionId,
		name,
		start_date: startDate,
		end_date: endDate,
		country_iso2: countryIso2,
		city,
		wcif_data: wcifData,
	}).catch((err: any) => {
		logger.warn('[Archive] ES index failed', {competitionId, err: err?.message});
	});

	return {success: true};
}

async function indexCompetitionInES(archive: {
	id: string;
	name: string;
	start_date: Date;
	end_date: Date;
	country_iso2: string | null;
	city: string | null;
	wcif_data: any;
}): Promise<void> {
	const client = getSearchClient();
	if (!client) return;

	const persons = Array.isArray(archive.wcif_data?.persons) ? archive.wcif_data.persons : [];
	const competitors = persons
		.filter((p: any) => p?.registration?.status === 'accepted')
		.map((p: any) => ({
			wca_id: p.wcaId || null,
			name: p.name || '',
		}));

	const eventIds = Array.isArray(archive.wcif_data?.events)
		? archive.wcif_data.events.map((e: any) => e.id).filter(Boolean)
		: [];

	await client.index({
		index: ARCHIVED_COMP_INDEX,
		id: archive.id,
		body: {
			id: archive.id,
			name: archive.name,
			start_date: archive.start_date,
			end_date: archive.end_date,
			country_iso2: archive.country_iso2,
			city: archive.city,
			event_ids: eventIds,
			competitors,
		},
	} as any);
}

/**
 * end_date'i 30 gun gecmis arsivleri donmus yap.
 * Cron'dan gunluk cagirilir.
 */
export async function freezeOldArchives(): Promise<number> {
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - FREEZE_AGE_DAYS);
	cutoff.setHours(0, 0, 0, 0);

	const result = await getPrisma().archivedWcaCompetition.updateMany({
		where: {
			is_frozen: false,
			end_date: {lt: cutoff},
		},
		data: {is_frozen: true},
	});

	if (result.count > 0) {
		logger.info(`[Archive] Froze ${result.count} old archive(s)`);
	}
	return result.count;
}

function extractStartDate(wcif: any): Date | null {
	const iso = wcif?.schedule?.startDate;
	if (typeof iso !== 'string') return null;
	const d = new Date(iso + 'T00:00:00Z');
	return isNaN(d.getTime()) ? null : d;
}

function extractEndDate(wcif: any): Date | null {
	const start = extractStartDate(wcif);
	const days = wcif?.schedule?.numberOfDays;
	if (!start || typeof days !== 'number' || days < 1) return null;
	const end = new Date(start);
	end.setUTCDate(end.getUTCDate() + days - 1);
	return end;
}
