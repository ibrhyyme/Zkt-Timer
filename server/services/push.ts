import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import { getPrisma } from '../database';
import { logger } from './logger';

let firebaseInitialized = false;

export interface PushResult {
	successCount: number; // Devices FCM accepted delivery to
	failureCount: number;
	totalTokens: number; // Total target tokens at send time
}

const EMPTY_PUSH_RESULT: PushResult = { successCount: 0, failureCount: 0, totalTokens: 0 };

// FCM multicast limit.
const BATCH_SIZE = 500;

const INVALID_TOKEN_CODES = new Set([
	'messaging/registration-token-not-registered',
	'messaging/invalid-registration-token',
]);

export function initFirebase(): void {
	const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
	if (!serviceAccountPath) {
		logger.warn('[Push] FIREBASE_SERVICE_ACCOUNT_PATH not set, push notifications disabled');
		return;
	}

	const absolutePath = path.resolve(serviceAccountPath);
	if (!fs.existsSync(absolutePath)) {
		logger.warn(`[Push] Service account file not found at ${absolutePath}, push notifications disabled`);
		return;
	}

	try {
		const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
		admin.initializeApp({
			credential: admin.credential.cert(serviceAccount),
		});
		firebaseInitialized = true;
		logger.info('[Push] Firebase Admin SDK initialized');
	} catch (error) {
		logger.error('[Push] Firebase init failed:', error);
	}
}

function multicastMessage(tokens: string[], title: string, body: string, data?: Record<string, string>) {
	return {
		tokens,
		notification: { title, body },
		data: data || {},
		apns: {
			payload: {
				aps: {
					sound: 'default',
				},
			},
		},
		android: {
			notification: {
				sound: 'default',
			},
		},
	};
}

/**
 * Send one message to many tokens in FCM-sized batches. A failed batch is logged
 * and skipped; the rest still go out. Returns the tokens FCM reported as dead.
 */
async function sendInBatches(
	tokenStrings: string[],
	title: string,
	body: string,
	data?: Record<string, string>
): Promise<{ success: number; failure: number; invalid: string[] }> {
	let success = 0;
	let failure = 0;
	const invalid: string[] = [];

	for (let i = 0; i < tokenStrings.length; i += BATCH_SIZE) {
		const batch = tokenStrings.slice(i, i + BATCH_SIZE);

		try {
			const response = await admin.messaging().sendEachForMulticast(multicastMessage(batch, title, body, data));

			success += response.successCount;
			failure += response.failureCount;

			response.responses.forEach((resp, idx) => {
				if (resp.error && INVALID_TOKEN_CODES.has(resp.error.code)) {
					invalid.push(batch[idx]);
				}
			});
		} catch (batchError) {
			logger.error(`[Push] Batch send error (batch ${i / BATCH_SIZE + 1}):`, batchError);
		}
	}

	return { success, failure, invalid };
}

async function removeInvalidTokens(tokens: string[]): Promise<void> {
	if (tokens.length === 0) return;
	await getPrisma().pushToken.deleteMany({
		where: { token: { in: tokens } },
	});
	logger.info(`[Push] Removed ${tokens.length} invalid tokens`);
}

/**
 * Send push notifications to all registered devices.
 * Fire-and-forget: on error, only log without blocking the notification process.
 */
export async function sendPushToAll(title: string, body: string, data?: Record<string, string>): Promise<PushResult> {
	if (!firebaseInitialized) {
		logger.warn('[Push] Firebase not initialized, skipping push notification');
		return EMPTY_PUSH_RESULT;
	}

	try {
		const tokens = await getPrisma().pushToken.findMany({
			select: { token: true },
		});

		if (tokens.length === 0) {
			logger.info('[Push] No registered tokens, skipping');
			return EMPTY_PUSH_RESULT;
		}

		const tokenStrings = tokens.map((t) => t.token);
		const { success, failure, invalid } = await sendInBatches(tokenStrings, title, body, data);
		await removeInvalidTokens(invalid);

		logger.info(`[Push] Sent: ${success} success, ${failure} failure, ${tokenStrings.length} total`);
		return { successCount: success, failureCount: failure, totalTokens: tokenStrings.length };
	} catch (error) {
		logger.error('[Push] sendPushToAll error:', error);
		return EMPTY_PUSH_RESULT;
	}
}

/**
 * Send push notifications to devices on specific platforms.
 */
export async function sendPushToPlatforms(platforms: string[], title: string, body: string, data?: Record<string, string>): Promise<PushResult> {
	if (!firebaseInitialized) {
		logger.warn('[Push] Firebase not initialized, skipping push notification');
		return EMPTY_PUSH_RESULT;
	}

	if (!platforms || platforms.length === 0) {
		logger.info('[Push] No platforms specified, skipping');
		return EMPTY_PUSH_RESULT;
	}

	try {
		const tokens = await getPrisma().pushToken.findMany({
			where: { platform: { in: platforms as any[] } },
			select: { token: true },
		});

		if (tokens.length === 0) {
			logger.info(`[Push] No tokens for platforms [${platforms.join(', ')}], skipping`);
			return EMPTY_PUSH_RESULT;
		}

		const tokenStrings = tokens.map((t) => t.token);
		const { success, failure, invalid } = await sendInBatches(tokenStrings, title, body, data);
		await removeInvalidTokens(invalid);

		logger.info(`[Push] Sent to [${platforms.join(', ')}]: ${success} success, ${failure} failure, ${tokenStrings.length} total`);
		return { successCount: success, failureCount: failure, totalTokens: tokenStrings.length };
	} catch (error) {
		logger.error('[Push] sendPushToPlatforms error:', error);
		return EMPTY_PUSH_RESULT;
	}
}

/**
 * Broadcast to every device, in each recipient's own language, skipping users
 * who switched this notification type off.
 *
 * `prefKey` is a NotificationPreference column. A user with no preference row
 * has never changed anything and counts as opted in. Tokens are grouped by the
 * owner's `settings.locale` (unknown or missing: `fallbackLocale`) and `build`
 * runs once per language.
 */
export async function sendPushToAllLocalized(args: {
	prefKey: string;
	locales: string[];
	fallbackLocale: string;
	build: (locale: string) => { title: string; body: string };
	data?: Record<string, string>;
}): Promise<PushResult> {
	if (!firebaseInitialized) {
		logger.warn('[Push] Firebase not initialized, skipping localized broadcast');
		return EMPTY_PUSH_RESULT;
	}

	try {
		const rows = await getPrisma().pushToken.findMany({
			where: {
				user: {
					NOT: { notification_preferences: { is: { [args.prefKey]: false } as any } },
				},
			},
			select: { token: true, user: { select: { settings: { select: { locale: true } } } } },
		});

		if (rows.length === 0) {
			logger.info('[Push] Localized broadcast: no eligible tokens', { prefKey: args.prefKey });
			return EMPTY_PUSH_RESULT;
		}

		const byLocale = new Map<string, string[]>();
		for (const row of rows) {
			const raw = (row as any).user?.settings?.locale;
			const locale = raw && args.locales.includes(raw) ? raw : args.fallbackLocale;
			if (!byLocale.has(locale)) byLocale.set(locale, []);
			byLocale.get(locale).push(row.token);
		}

		let success = 0;
		let failure = 0;
		const invalid: string[] = [];
		for (const [locale, tokens] of byLocale) {
			const { title, body } = args.build(locale);
			const res = await sendInBatches(tokens, title, body, args.data);
			success += res.success;
			failure += res.failure;
			invalid.push(...res.invalid);
		}
		await removeInvalidTokens(invalid);

		logger.info('[Push] Localized broadcast sent', {
			prefKey: args.prefKey,
			success,
			failure,
			total: rows.length,
			locales: [...byLocale.keys()],
		});
		return { successCount: success, failureCount: failure, totalTokens: rows.length };
	} catch (error) {
		logger.error('[Push] sendPushToAllLocalized error:', error);
		return EMPTY_PUSH_RESULT;
	}
}

/**
 * Send push notifications to all devices of a specific user.
 */
export async function sendPushToUser(userId: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
	if (!firebaseInitialized) return;

	try {
		const prisma = getPrisma();
		const tokens = await prisma.pushToken.findMany({
			where: { userId },
			select: { token: true },
		});

		if (tokens.length === 0) return;

		const tokenStrings = tokens.map((t) => t.token);
		const response = await admin.messaging().sendEachForMulticast(multicastMessage(tokenStrings, title, body, data));

		// Clean up invalid tokens
		const tokensToRemove: string[] = [];
		response.responses.forEach((resp, idx) => {
			if (resp.error) {
				const code = resp.error.code;
				logger.warn('[Push] sendPushToUser token error', {
					userId,
					tokenIdx: idx,
					errorCode: code,
					errorMessage: resp.error.message,
				});
				if (INVALID_TOKEN_CODES.has(code)) {
					tokensToRemove.push(tokenStrings[idx]);
				}
			}
		});

		if (tokensToRemove.length > 0) {
			await prisma.pushToken.deleteMany({
				where: { token: { in: tokensToRemove } },
			});
		}
	} catch (error) {
		logger.error(`[Push] sendPushToUser error (userId: ${userId}):`, error);
	}
}
