import {Request, Response} from 'express';
import {logger} from '../services/logger';
import {
	applyIapPurchase,
	revokeIapPro,
	markCancellation,
	clearCancellation,
	markBillingIssue,
	pauseSubscription,
	isEventProcessed,
	markEventProcessed,
	IapPlatform,
} from '../models/iap';

interface RCEvent {
	id: string;
	type: string;
	app_user_id: string;
	original_app_user_id?: string;
	product_id?: string;
	period_type?: string;
	purchased_at_ms?: number;
	expiration_at_ms?: number | null;
	original_transaction_id?: string;
	store?: string; // APP_STORE | PLAY_STORE | ...
	environment?: string;
	entitlement_ids?: string[];
	cancel_reason?: string;
	expiration_reason?: string;
}

interface RCWebhookBody {
	event: RCEvent;
	api_version?: string;
}

function getPlatform(store?: string): IapPlatform | null {
	if (store === 'APP_STORE' || store === 'MAC_APP_STORE') return 'ios';
	if (store === 'PLAY_STORE') return 'android';
	return null;
}

function toDate(ms?: number | null): Date | null {
	if (!ms) return null;
	return new Date(ms);
}

/**
 * RevenueCat webhook endpoint: POST /api/iap/revenuecat-webhook
 * Auth: `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`
 */
export async function revenueCatWebhookHandler(req: Request, res: Response): Promise<void> {
	const expectedSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
	const authHeader = req.headers.authorization || '';
	const providedSecret = authHeader.replace(/^Bearer\s+/i, '').trim();

	if (!expectedSecret || providedSecret !== expectedSecret) {
		logger.warn('[RC-Webhook] Unauthorized webhook attempt');
		res.status(401).json({error: 'unauthorized'});
		return;
	}

	const body = req.body as RCWebhookBody;
	const event = body?.event;
	if (!event?.id || !event?.type || !event?.app_user_id) {
		logger.warn('[RC-Webhook] Invalid payload', {body});
		res.status(400).json({error: 'invalid_payload'});
		return;
	}

	// Idempotency check
	if (await isEventProcessed(event.id)) {
		logger.info('[RC-Webhook] Duplicate event, skipping', {eventId: event.id, type: event.type});
		res.status(200).json({status: 'duplicate'});
		return;
	}

	const userId = event.app_user_id;
	const platform = getPlatform(event.store);
	const productId = event.product_id || null;
	const originalTxId = event.original_transaction_id || null;
	const expiresAt = toDate(event.expiration_at_ms);
	const eventAt = toDate(event.purchased_at_ms) || new Date();

	try {
		switch (event.type) {
			case 'INITIAL_PURCHASE':
			case 'RENEWAL':
			case 'PRODUCT_CHANGE': {
				if (!platform || !productId) {
					logger.warn('[RC-Webhook] Missing platform/product', {event});
					break;
				}
				await applyIapPurchase(
					{
						userId,
						platform,
						productId,
						originalTxId,
						expiresAt,
						eventAt,
					},
					event.type === 'INITIAL_PURCHASE' || event.type === 'PRODUCT_CHANGE'
				);
				break;
			}
			case 'NON_RENEWING_PURCHASE': {
				// Lifetime satin alma — expires_at null
				if (!platform || !productId) break;
				await applyIapPurchase(
					{
						userId,
						platform,
						productId,
						originalTxId,
						expiresAt: null,
						eventAt,
					},
					true
				);
				break;
			}
			case 'CANCELLATION': {
				// Kullanici iptal etti ama period devam ediyor
				await markCancellation(userId, eventAt);
				break;
			}
			case 'UNCANCELLATION': {
				await clearCancellation(userId);
				break;
			}
			case 'EXPIRATION': {
				await revokeIapPro(userId, 'expiration');
				break;
			}
			case 'BILLING_ISSUE': {
				await markBillingIssue(userId, eventAt);
				break;
			}
			case 'SUBSCRIPTION_PAUSED': {
				const pausedUntil = expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
				await pauseSubscription(userId, pausedUntil);
				break;
			}
			case 'REFUND': {
				await revokeIapPro(userId, 'refund');
				break;
			}
			case 'TRANSFER': {
				// Nadiren olur — eski kullanicinin entitlement'i yeniye gecti.
				// RevenueCat otomatik halleder, biz sadece log'larız.
				logger.info('[RC-Webhook] TRANSFER event', {userId, originalTxId});
				break;
			}
			case 'TEST': {
				logger.info('[RC-Webhook] Test event received');
				break;
			}
			default: {
				logger.info('[RC-Webhook] Unhandled event type', {type: event.type, id: event.id});
				break;
			}
		}

		await markEventProcessed(event.id);
		res.status(200).json({status: 'ok'});
	} catch (err) {
		logger.error('[RC-Webhook] Handler error', {err, eventId: event.id, type: event.type});
		// 5xx dondur ki RevenueCat retry yapsin
		res.status(500).json({error: 'internal_error'});
	}
}
