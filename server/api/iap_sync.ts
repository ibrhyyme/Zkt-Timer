import {Request, Response} from 'express';
import {getMe} from '../util/auth';
import {syncEntitlementFromRevenueCat} from '../models/iap';
import {checkRateLimit} from '../services/rate_limit';

/**
 * POST /api/iap/sync
 *
 * Queries the RevenueCat REST API server-side, updates the DB if the user's `pro`
 * entitlement is active. Called after restore and purchase — provides instant
 * synchronization independent of webhook delays.
 *
 * Rule: only INCREASES (grants Pro), never DECREASES.
 * Revocation only happens through webhook.
 */
export async function iapSyncHandler(req: Request, res: Response): Promise<void> {
	const me = await getMe(req as any);
	if (!me) {
		res.status(401).json({error: 'unauthorized'});
		return;
	}

	// Throttle per user — each sync hits the RevenueCat REST API; cap the quota burn.
	const limit = await checkRateLimit(`iap_sync:user:${me.id}`, 10, 3600);
	if (!limit.allowed) {
		res.status(429).json({error: 'rate_limited'});
		return;
	}

	const result = await syncEntitlementFromRevenueCat(me.id);
	res.status(200).json(result);
}
