import axios from 'axios';
import {Prisma} from '@prisma/client';
import {getPrisma} from '../database';
import {LINKED_SERVICES} from '../../shared/integration';
import {updateIntegration} from '../models/integration';
import {fetchAndSaveWcaRecords, saveWcaPersonRecords} from '../models/wca_record';
import {WcaApiService} from './WcaApiService';
import {getOAuthPostRequest, syncWcaProfileToIntegration} from '../integrations/oauth';
import {logger} from './logger';

export interface WcaBackfillResult {
	total: number;
	filled: number;
	tokenFailed: number;
	revoked: number;
	noWcaId: number;
	rateLimited: number;
	error: number;
	recordsTotal: number;
	recordsFilled: number;
	recordsError: number;
	refreshTotal: number;
	refreshed: number;
	refreshError: number;
}

/**
 * Phase 2 selector: linked WCA users with a wca_id and no WcaRecord row yet.
 * The marker must be the relation, not a derived column: a column that gets
 * cleared would make every WCA user look "not fetched" and the nightly cron
 * would hit the WCA API for all of them at once (429).
 * Users whose WCA profile has no results (only DNFs) never get a row and are
 * asked again every night, same as before.
 */
export const WCA_RECORDS_MISSING_WHERE: Prisma.IntegrationWhereInput = {
	service_name: 'wca',
	revoked_at: null,
	wca_id: {not: null},
	wca_records: {none: {}},
};

/**
 * Phase 3 selector base: linked users who already have WcaRecord rows. The
 * phase reads it twice, never-refreshed first, then the stalest.
 */
export const WCA_RECORDS_REFRESH_WHERE: Prisma.IntegrationWhereInput = {
	service_name: 'wca',
	revoked_at: null,
	wca_id: {not: null},
	wca_records: {some: {}},
};

/**
 * A row refreshed less than this long ago is skipped. Under 24 h on purpose:
 * the cron fires at the same time every night, and a row written at 03:04
 * yesterday must be due again at 03:00 today.
 */
export const WCA_REFRESH_AFTER_MS = 20 * 60 * 60 * 1000;

/** Consecutive 429s after which the refresh gives up for the night. */
const REFRESH_MAX_CONSECUTIVE_429 = 3;

export interface WcaBackfillOptions {
	batchSize?: number;
	requestDelayMs?: number;
	includeRecords?: boolean;
	/**
	 * Phase 3: re-read WCA for users whose records are older than a day, oldest
	 * first. Off by default so the admin's manual run stays short; the nightly
	 * cron turns it on.
	 */
	includeRefresh?: boolean;
	refreshBatchSize?: number;
	refreshDelayMs?: number;
	/** Pause after a 429 before the next refresh request. */
	rateLimitPauseMs?: number;
}

/**
 * Fills in missing fields (wca_user_id, wca_id, wca_name, wca_avatar_url, wca_country_iso2)
 * in WCA Integration table in the background. Both admin mutation and cron call this same function.
 *
 * Behavior rules:
 *  - Only processes records with service_name='wca' AND revoked_at IS NULL.
 *  - If token expired, tries refresh; if refresh fails permanently, marks revoked_at and skips.
 *  - If WCA /me returns 401/404, marks revoked_at.
 *  - If WCA /me returns 429 (rate limit), sleeps 10s and skips (retry next tick).
 *  - Writes fields via syncWcaProfileToIntegration (idempotent).
 *  - Then Phase 2: fetches WCA records for users with a wca_id whose records were never fetched.
 *  - Then Phase 3 (includeRefresh): re-reads WCA for users whose records are a day old, so PBs,
 *    ranks, medals and competition counts follow WCA without the user pressing "refresh".
 */
export async function runWcaBackfill(opts: WcaBackfillOptions = {}): Promise<WcaBackfillResult> {
	const {
		batchSize = 500,
		requestDelayMs = 300,
		includeRecords = true,
		includeRefresh = false,
		refreshBatchSize = 1000,
		refreshDelayMs = 500,
		rateLimitPauseMs = 10_000,
	} = opts;
	const prisma = getPrisma();
	const wcaService = LINKED_SERVICES['wca'];

	const result: WcaBackfillResult = {
		total: 0, filled: 0, tokenFailed: 0, revoked: 0, noWcaId: 0,
		rateLimited: 0, error: 0,
		recordsTotal: 0, recordsFilled: 0, recordsError: 0,
		refreshTotal: 0, refreshed: 0, refreshError: 0,
	};

	// Phase 1: fill missing profile fields in order
	// - wca_user_id null: real bug, retry every night
	// - wca_id null: newcomer, retry once every 30 days (WCA official competition check takes 2-4 weeks)
	const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
	const needsUpdate = await prisma.integration.findMany({
		where: {
			service_name: 'wca',
			revoked_at: null,
			OR: [
				{wca_user_id: null},
				{
					wca_id: null,
					OR: [
						{last_synced_at: null},
						{last_synced_at: {lt: thirtyDaysAgo}},
					],
				},
			],
		},
		include: {user: true},
		orderBy: {created_at: 'asc'},
		take: batchSize,
	});

	result.total = needsUpdate.length;

	for (const int of needsUpdate) {
		try {
			let authToken = int.auth_token;
			const expiresAt = new Date(Number(int.auth_expires_at));
			if (expiresAt < new Date()) {
				try {
					const refreshResult = await getOAuthPostRequest(
						wcaService,
						wcaService.tokenEndpoint,
						{grant_type: 'refresh_token', refresh_token: int.refresh_token}
					);
					authToken = refreshResult.accessToken;
					await updateIntegration(int, {
						auth_token: refreshResult.accessToken,
						refresh_token: refreshResult.refreshToken,
						auth_expires_at: refreshResult.createdAt + refreshResult.expiresIn * 1000,
					});
				} catch (e: any) {
					const status = e?.response?.status;
					logger.warn(`[WcaBackfill] Token refresh failed user=${int.user_id} status=${status}: ${e?.message}`);
					if (status === 400 || status === 401) {
						// Refresh permanent error — mark revoked, skip future attempts
						await updateIntegration(int, {revoked_at: new Date()} as any);
						result.revoked++;
					} else {
						result.tokenFailed++;
					}
					continue;
				}
			}

			if (requestDelayMs > 0) {
				await new Promise((r) => setTimeout(r, requestDelayMs));
			}

			let res;
			try {
				res = await axios.get(wcaService.meEndpoint, {
					headers: {Authorization: 'Bearer ' + authToken},
					timeout: 8000,
				});
			} catch (e: any) {
				const status = e?.response?.status;
				if (status === 401 || status === 404) {
					await updateIntegration(int, {revoked_at: new Date()} as any);
					logger.warn(`[WcaBackfill] /me ${status} user=${int.user_id} — marked revoked`);
					result.revoked++;
					continue;
				}
				if (status === 429) {
					logger.warn(`[WcaBackfill] Rate limited (429), sleeping 10s...`);
					result.rateLimited++;
					await new Promise((r) => setTimeout(r, 10_000));
					continue;
				}
				throw e;
			}

			const wcaData = res?.data?.me || res?.data;
			await syncWcaProfileToIntegration(int as any, wcaData);

			if (!wcaData?.wca_id) {
				result.noWcaId++;
				logger.info(`[WcaBackfill] Newcomer user=${int.user_id} wca_user_id=${wcaData?.id ?? 'null'}`);
			} else {
				result.filled++;
				logger.info(`[WcaBackfill] Filled user=${int.user_id} wca_id=${wcaData.wca_id} wca_user_id=${wcaData?.id}`);
			}
		} catch (e: any) {
			logger.warn(`[WcaBackfill] Unexpected error user=${int.user_id}: ${e?.message}`);
			result.error++;
		}
	}

	// Phase 2: fetch records for users with a wca_id whose records were never fetched
	if (includeRecords) {
		const missingRecords = await prisma.integration.findMany({
			where: WCA_RECORDS_MISSING_WHERE,
			include: {user: true},
			take: batchSize,
		});

		result.recordsTotal = missingRecords.length;

		for (const int of missingRecords) {
			try {
				// Be kind to WCA API for records too — 500ms between consecutive requests avoids 429
				await new Promise((r) => setTimeout(r, 500));
				await fetchAndSaveWcaRecords(int.user as any, int as any);
				result.recordsFilled++;
				logger.info(`[WcaBackfill] Records fetched wca_id=${int.wca_id} user=${int.user_id}`);
			} catch (e: any) {
				if (e?.response?.status === 429) {
					logger.warn(`[WcaBackfill] Records 429, sleeping 10s...`);
					await new Promise((r) => setTimeout(r, 10_000));
					result.rateLimited++;
					continue;
				}
				logger.warn(`[WcaBackfill] Records failed user=${int.user_id}: ${e?.message}`);
				result.recordsError++;
			}
		}
	}

	// Phase 3: refresh records that are a day old. Never-refreshed rows first (a
	// plain ascending sort puts NULL last in Postgres, and with more users than
	// one batch they would never be reached), then the stalest.
	if (includeRefresh) {
		const staleBefore = new Date(Date.now() - WCA_REFRESH_AFTER_MS);
		const select = {id: true, user_id: true, wca_id: true} as const;
		const never = await prisma.integration.findMany({
			where: {...WCA_RECORDS_REFRESH_WHERE, wca_records_synced_at: null},
			select,
			take: refreshBatchSize,
		});
		const stale =
			never.length < refreshBatchSize
				? await prisma.integration.findMany({
						where: {...WCA_RECORDS_REFRESH_WHERE, wca_records_synced_at: {lt: staleBefore}},
						select,
						orderBy: {wca_records_synced_at: 'asc'},
						take: refreshBatchSize - never.length,
					})
				: [];
		const due = [...never, ...stale];
		result.refreshTotal = due.length;

		let consecutive429 = 0;
		for (const int of due) {
			if (refreshDelayMs > 0) {
				await new Promise((r) => setTimeout(r, refreshDelayMs));
			}
			try {
				const person = await WcaApiService.fetchPersonDataOrThrow(int.wca_id!);
				await saveWcaPersonRecords(int.user_id, int.id, person);
				result.refreshed++;
				consecutive429 = 0;
			} catch (e: any) {
				if (e?.response?.status === 429) {
					result.rateLimited++;
					if (++consecutive429 >= REFRESH_MAX_CONSECUTIVE_429) {
						logger.warn('[WcaBackfill] Refresh stopped for tonight: WCA keeps answering 429');
						break;
					}
					await new Promise((r) => setTimeout(r, rateLimitPauseMs));
					continue;
				}
				logger.warn(`[WcaBackfill] Refresh failed user=${int.user_id} wca_id=${int.wca_id}: ${e?.message}`);
				result.refreshError++;
			}
		}
	}

	// ES log mapping indexes "error" field as object — rename to avoid integer collision
	const {error: errorCount, ...logSafeResult} = result;
	logger.info('[WcaBackfill] Done', {...logSafeResult, errorCount});
	return result;
}
