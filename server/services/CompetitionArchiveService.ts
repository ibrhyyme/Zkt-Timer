import {getPrisma} from '../database';
import {logger} from './logger';
import {WcaApiService} from './WcaApiService';
import {getWcaLiveData, fetchLiveRoundResults, WcaLiveData, WcaLiveRoundData} from './WcaLiveService';
import {getSearchClient, ARCHIVED_COMP_INDEX} from './search';

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const FREEZE_AGE_DAYS = 30; // freeze competition 30 days after end_date

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
 * Is the competition currently active (live ongoing)?
 * start_date <= today <= end_date + 1 day (timezone tolerance)
 *
 * For active competitions, bypass the archive and use live stream — because
 * delegates are entering data in real-time, archive snapshot becomes stale.
 */
export function isCompetitionActive(archive: {start_date: Date; end_date: Date}): boolean {
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	const start = new Date(archive.start_date);
	start.setHours(0, 0, 0, 0);
	const end = new Date(archive.end_date);
	end.setHours(23, 59, 59, 999);
	end.setDate(end.getDate() + 1); // 1 day extra for timezone tolerance
	return now >= start && now <= end;
}

/**
 * Is the competition over (end_date + 1 day tolerance has passed)?
 *
 * Only finished competitions are safe to read from / write to the archive —
 * upcoming and active comps have a moving registration list, so a snapshot
 * would be stale. They must always be read live from WCA instead.
 */
export function isCompetitionFinished(comp: {end_date: Date}): boolean {
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	const end = new Date(comp.end_date);
	end.setHours(23, 59, 59, 999);
	end.setDate(end.getDate() + 1); // 1 day extra for timezone tolerance
	return now > end;
}

/**
 * Fetch a competition from WCA + WCA Live and write to DB (upsert).
 * Idempotent — updates record if it exists, creates if not.
 *
 * @param competitionId WCA competition ID
 * @param meta Optional meta override (during bulk import comes from comp list)
 * @param prefetchedWcif if resolver already fetched this, reuse it — don't fetch again
 */
export async function archiveCompetition(
	competitionId: string,
	meta?: ArchiveMeta,
	prefetchedWcif?: any,
	opts?: {onlyIfFinished?: boolean},
): Promise<{success: boolean; error?: string}> {
	const prisma = getPrisma();

	// 1. Fetch WCIF (if not prefetched)
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

	// 2. Fetch WCA Live (optional — may not exist for old competitions)
	let liveDataPayload: ArchiveCacheLiveData | null = null;
	try {
		const liveData = await getWcaLiveData(competitionId);
		if (liveData) {
			const rounds: Record<string, WcaLiveRoundData | null> = {};
			// Fetch all rounds in parallel
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

	// 3. Extract meta from WCIF or use override
	const name = meta?.name || wcifData.name || competitionId;
	const startDate = meta?.start_date || extractStartDate(wcifData);
	const endDate = meta?.end_date || extractEndDate(wcifData);
	const countryIso2 = meta?.country_iso2 ?? null;
	const city = meta?.city ?? null;

	if (!startDate || !endDate) {
		logger.warn('[Archive] Could not extract dates', {competitionId});
		return {success: false, error: 'date_extract_failed'};
	}

	// Only archive finished competitions when the caller requests it — upcoming
	// and active comps have a moving registration list, so the snapshot would be
	// stale. Those are always read live from WCA instead (see wcaCompetitionDetail).
	if (opts?.onlyIfFinished && !isCompetitionFinished({end_date: endDate})) {
		return {success: false, error: 'not_finished'};
	}

	// 4. Upsert to DB
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
				live_data: (liveDataPayload as any) ?? undefined,
			},
			update: {
				name,
				start_date: startDate,
				end_date: endDate,
				country_iso2: countryIso2,
				city,
				wcif_data: wcifData,
				live_data: (liveDataPayload as any) ?? undefined,
				last_synced_at: new Date(),
			},
		});
	} catch (err: any) {
		logger.warn('[Archive] DB upsert failed', {competitionId, err: err?.message});
		return {success: false, error: 'db_upsert_failed'};
	}

	// 5. Mirror to ES — fire-and-forget, archive stays in DB even if ES unreachable
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
 * Mark archives as frozen if end_date is 30 days in the past.
 * Called daily from cron.
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
