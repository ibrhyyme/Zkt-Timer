import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import { getPrisma } from '../database';
import { logger } from './logger';

let firebaseInitialized = false;

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

/**
 * Tum kayitli cihazlara push notification gonder.
 * Fire-and-forget: Hata durumunda sadece log, duyuru islemini bloklamaz.
 */
export async function sendPushToAll(title: string, body: string, data?: Record<string, string>): Promise<void> {
	if (!firebaseInitialized) {
		logger.warn('[Push] Firebase not initialized, skipping push notification');
		return;
	}

	try {
		const prisma = getPrisma();
		const tokens = await prisma.pushToken.findMany({
			select: { token: true },
		});

		if (tokens.length === 0) {
			logger.info('[Push] No registered tokens, skipping');
			return;
		}

		const tokenStrings = tokens.map((t) => t.token);

		// FCM 500'erli batch limiti var
		const BATCH_SIZE = 500;
		let totalSuccess = 0;
		let totalFailure = 0;
		const tokensToRemove: string[] = [];

		for (let i = 0; i < tokenStrings.length; i += BATCH_SIZE) {
			const batch = tokenStrings.slice(i, i + BATCH_SIZE);

			try {
				const response = await admin.messaging().sendEachForMulticast({
					tokens: batch,
					notification: { title, body },
					data: data || {},
				});

				totalSuccess += response.successCount;
				totalFailure += response.failureCount;

				// Gecersiz token'lari temizle
				response.responses.forEach((resp, idx) => {
					if (resp.error) {
						const code = resp.error.code;
						if (
							code === 'messaging/registration-token-not-registered' ||
							code === 'messaging/invalid-registration-token'
						) {
							tokensToRemove.push(batch[idx]);
						}
					}
				});
			} catch (batchError) {
				logger.error(`[Push] Batch send error (batch ${i / BATCH_SIZE + 1}):`, batchError);
			}
		}

		// Gecersiz token'lari DB'den sil
		if (tokensToRemove.length > 0) {
			await prisma.pushToken.deleteMany({
				where: { token: { in: tokensToRemove } },
			});
			logger.info(`[Push] Removed ${tokensToRemove.length} invalid tokens`);
		}

		logger.info(`[Push] Sent: ${totalSuccess} success, ${totalFailure} failure, ${tokenStrings.length} total`);
	} catch (error) {
		logger.error('[Push] sendPushToAll error:', error);
	}
}
