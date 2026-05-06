import {Request, Response} from 'express';
import {getMe} from '../util/auth';
import {syncEntitlementFromRevenueCat} from '../models/iap';

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
	const me = await getMe(req as any);
	if (!me) {
		res.status(401).json({error: 'unauthorized'});
		return;
	}

	const result = await syncEntitlementFromRevenueCat(me.id);
	res.status(200).json(result);
}
