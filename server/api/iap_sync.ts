import {Response} from 'express';
import {Request} from 'express-serve-static-core';
import {getMe} from '../util/auth';
import {getPrisma} from '../database';
import {logger} from '../services/logger';
import {applyIapPurchase, IapPlatform} from '../models/iap';

/**
 * POST /api/iap/sync
 *
 * RevenueCat REST API'yi sunucu tarafından sorgular, kullanicinin `pro`
 * entitlement'i aktifse DB'yi gunceller. Restore ve satin alma sonrasi
 * cagrilir — webhook gecikmesinden bagimsiz ani senkronizasyon saglar.
 *
 * Kural: sadece YUKSELIR (Pro verir), hicbir zaman DUSURULMEZ.
 * Revokasyon sadece webhook uzerinden yapilir.
 */
export async function iapSyncHandler(req: Request, res: Response): Promise<void> {
	const me = await getMe(req);
	if (!me) {
		res.status(401).json({error: 'unauthorized'});
		return;
	}

	const prisma = getPrisma();
	const user = await prisma.userAccount.findUnique({
		where: {id: me.id},
		select: {revenuecat_user_id: true},
	});

	if (!user?.revenuecat_user_id) {
		res.status(200).json({synced: false, isPro: false});
		return;
	}

	const secretKey = process.env.REVENUECAT_SECRET_KEY;
	if (!secretKey) {
		logger.error('[IAP-Sync] REVENUECAT_SECRET_KEY env var eksik');
		res.status(500).json({error: 'config_error'});
		return;
	}

	const rcUserId = encodeURIComponent(user.revenuecat_user_id);
	let rcData: any;
	try {
		const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${rcUserId}`, {
			headers: {
				Authorization: `Bearer ${secretKey}`,
				'Content-Type': 'application/json',
			},
		});
		if (!response.ok) {
			logger.warn('[IAP-Sync] RevenueCat API hatasi', {status: response.status, userId: me.id});
			res.status(502).json({error: 'revenuecat_error'});
			return;
		}
		rcData = await response.json();
	} catch (err) {
		logger.error('[IAP-Sync] RevenueCat API istegi basarisiz', {err, userId: me.id});
		res.status(502).json({error: 'network_error'});
		return;
	}

	const proEnt = rcData?.subscriber?.entitlements?.pro;
	const now = new Date();
	// expires_date === null → lifetime (sonsuz); varsa gelecekte mi kontrolu
	const isActive = !!proEnt && (proEnt.expires_date === null || new Date(proEnt.expires_date) > now);

	if (isActive) {
		const storeRaw: string = proEnt.store || '';
		const platform: IapPlatform = storeRaw === 'play_store' ? 'android' : 'ios';
		const productId: string = proEnt.product_identifier || '';
		const expiresAt: Date | null = proEnt.expires_date ? new Date(proEnt.expires_date) : null;

		await applyIapPurchase(
			{
				userId: me.id,
				platform,
				productId,
				originalTxId: null,
				expiresAt,
				eventAt: now,
			},
			false, // kullanici zaten biliyor, push gonderme
		);

		logger.info('[IAP-Sync] Pro geri yuklendi', {userId: me.id, platform, productId});
		res.status(200).json({synced: true, isPro: true});
	} else {
		// Aktif entitlement yok — admin-granted Pro korunur, DB degistirilmez
		logger.info('[IAP-Sync] Aktif RevenueCat entitlement yok', {userId: me.id});
		res.status(200).json({synced: true, isPro: false});
	}
}
