import axios from 'axios';
import {getPrisma} from '../database';
import {getZktOrigin} from '../../shared/integration';
import {logger} from './logger';

/**
 * Fills in `zkt_id` for ZKT integrations that do not have one yet.
 *
 * A member who has never competed has no ZKT ID: the federation mints it when
 * their first competition's results are published. Zkt-Timer only ever learns
 * the ID at sign-in or account link time, so without this the ID stays null
 * until that member happens to sign in with ZKT again, and their ZKT profile,
 * results and records stay invisible in the meantime.
 *
 * Deliberately much smaller than the WCA equivalent (WcaBackfillService). There
 * the app must speak to a third party once per user, with token refresh, revoke
 * handling and rate-limit backoff. The federation is ours, so one bulk request
 * answers for every pending member at once and none of that machinery applies.
 */

export interface ZktBackfillResult {
	total: number;
	filled: number;
	stillNull: number;
	conflict: number;
	error: number;
}

export interface ZktBackfillOptions {
	/** Subjects per request. Must stay at or below the federation's own cap. */
	chunkSize?: number;
}

interface ZktIdLookupResponse {
	ids?: Record<string, string | null>;
}

// Trailing slash is load-bearing: the federation runs Next.js with
// `trailingSlash: true`, so a slash-less POST is answered with a 308. axios
// follows it and Node preserves the body, but asking for the canonical URL
// costs nothing and does not depend on that holding.
function lookupEndpoint(): string {
	return `${getZktOrigin()}/api/internal/v1/zkt-ids/`;
}

async function fetchZktIds(subs: string[], secret: string): Promise<Record<string, string | null>> {
	const res = await axios.post<ZktIdLookupResponse>(
		lookupEndpoint(),
		{subs},
		{
			headers: {Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json'},
			timeout: 15000,
		},
	);
	return res.data?.ids || {};
}

export async function runZktBackfill(opts: ZktBackfillOptions = {}): Promise<ZktBackfillResult> {
	const {chunkSize = 1000} = opts;
	const prisma = getPrisma();

	const result: ZktBackfillResult = {total: 0, filled: 0, stillNull: 0, conflict: 0, error: 0};

	const secret = process.env.ZKT_INTERNAL_API_SECRET;
	if (!secret) {
		logger.warn('[ZktBackfill] ZKT_INTERNAL_API_SECRET is not set, skipping run');
		return result;
	}

	// `revoked_at: null` keeps members who unlinked their ZKT account out of it —
	// they asked us to stop tracking their federation identity.
	const pending = await prisma.integration.findMany({
		where: {
			service_name: 'zkt',
			revoked_at: null,
			zkt_id: null,
			zkt_user_id: {not: null},
		},
		select: {id: true, user_id: true, zkt_user_id: true},
		orderBy: {created_at: 'asc'},
	});

	result.total = pending.length;
	if (pending.length === 0) return result;

	for (let offset = 0; offset < pending.length; offset += chunkSize) {
		const batch = pending.slice(offset, offset + chunkSize);
		const subs = batch.map((row) => row.zkt_user_id as string);

		let ids: Record<string, string | null>;
		try {
			ids = await fetchZktIds(subs, secret);
		} catch (e: any) {
			// A batch that failed is retried on the next run rather than row by row:
			// the federation being down is not a per-member problem.
			const status = e?.response?.status;
			logger.warn('[ZktBackfill] lookup failed', {
				count: subs.length,
				status,
				message: e?.message,
			});
			result.error += batch.length;
			continue;
		}

		for (const row of batch) {
			const zktId = ids[row.zkt_user_id as string];
			if (!zktId) {
				result.stillNull++;
				continue;
			}

			try {
				await prisma.integration.update({
					where: {id: row.id},
					data: {zkt_id: zktId, last_synced_at: new Date()},
				});
				result.filled++;
				logger.info(`[ZktBackfill] Filled user=${row.user_id} zkt_id=${zktId}`);
			} catch (e: any) {
				// `zkt_id` is unique. A collision means the same federation identity is
				// already attached to another local account, which is a data problem a
				// human has to resolve — surface it instead of retrying forever.
				if (e?.code === 'P2002') {
					result.conflict++;
					logger.warn('[ZktBackfill] zkt_id already taken by another account', {
						userId: row.user_id,
						zktId,
					});
					continue;
				}
				result.error++;
				logger.warn('[ZktBackfill] write failed', {userId: row.user_id, message: e?.message});
			}
		}
	}

	// The ES log mapping indexes an "error" field as an object, so an integer
	// under that name collides — same rename WcaBackfillService does.
	const {error: errorCount, ...logSafeResult} = result;
	logger.info('[ZktBackfill] Done', {...logSafeResult, errorCount});
	return result;
}
