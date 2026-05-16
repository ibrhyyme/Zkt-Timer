import axios from 'axios';
import {getPrisma} from '../database';
import {LINKED_SERVICES} from '../../shared/integration';
import {updateIntegration} from '../models/integration';
import {fetchAndSaveWcaRecords} from '../models/wca_record';
import {getOAuthPostRequest, syncWcaProfileToIntegration, WCA_TOKEN_REVOKED} from '../integrations/oauth';
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
}

export interface WcaBackfillOptions {
	batchSize?: number;
	requestDelayMs?: number;
	includeRecords?: boolean;
}

/**
 * WCA Integration tablosundaki eksik alanlari (wca_user_id, wca_id, wca_name, wca_avatar_url, wca_country_iso2)
 * arka planda doldurur. Hem admin mutation hem cron ayni fonksiyonu cagirir.
 *
 * Davranis kurallari:
 *  - Sadece service_name='wca' AND revoked_at IS NULL kayitlari isler.
 *  - Token expired ise refresh dener; refresh kalici hata verirse revoked_at isaretler ve atlanir.
 *  - WCA /me 401/404 dondururse revoked_at isaretler.
 *  - WCA /me 429 (rate limit) dondururse 10s bekler, kaydi atlar (sonraki tick yeniden dener).
 *  - syncWcaProfileToIntegration ile alanlari yazar (idempotent).
 *  - Sonra Phase 2: wca_id var ama kinch_score yok olanlar icin records fetch + ranking compute.
 */
export async function runWcaBackfill(opts: WcaBackfillOptions = {}): Promise<WcaBackfillResult> {
	const {batchSize = 500, requestDelayMs = 300, includeRecords = true} = opts;
	const prisma = getPrisma();
	const wcaService = LINKED_SERVICES['wca'];

	const result: WcaBackfillResult = {
		total: 0, filled: 0, tokenFailed: 0, revoked: 0, noWcaId: 0,
		rateLimited: 0, error: 0,
		recordsTotal: 0, recordsFilled: 0, recordsError: 0,
	};

	// Phase 1: profil alanlari eksik olanlari sirayla doldur
	const needsUpdate = await prisma.integration.findMany({
		where: {
			service_name: 'wca',
			revoked_at: null,
			OR: [{wca_user_id: null}, {wca_id: null}],
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
						// Refresh kalici hata — revoked olarak isaretle, ileride deneme
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

	// Phase 2: wca_id var ama kinch_score yok olanlar — records fetch + ranking compute
	if (includeRecords) {
		const missingRankings = await prisma.integration.findMany({
			where: {
				service_name: 'wca',
				revoked_at: null,
				wca_id: {not: null},
				kinch_score: null,
			},
			include: {user: true},
			take: batchSize,
		});

		result.recordsTotal = missingRankings.length;

		for (const int of missingRankings) {
			try {
				await fetchAndSaveWcaRecords(int.user as any, int as any);
				result.recordsFilled++;
				logger.info(`[WcaBackfill] Records fetched wca_id=${int.wca_id} user=${int.user_id}`);
			} catch (e: any) {
				logger.warn(`[WcaBackfill] Records failed user=${int.user_id}: ${e?.message}`);
				result.recordsError++;
			}
		}
	}

	logger.info('[WcaBackfill] Done', result);
	return result;
}
