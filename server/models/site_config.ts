import {getPrisma} from '../database';
import {fetchDataFromCache, createRedisKey, RedisNamespace, setKeyInRedis, deleteKeyInRedis} from '../services/redis';
import {logger} from '../services/logger';

const SITE_CONFIG_TTL = 30; // 30s
const SITE_CONFIG_CACHE_KEY = createRedisKey(RedisNamespace.PRO_DATA, 'site_config:singleton');

export interface FeatureOverrideUserData {
	id: string;
	username: string;
}

export interface FeatureOverrideEntryData {
	feature: string;
	mode: string;
	users: FeatureOverrideUserData[];
}

export interface SiteConfigData {
	id: string;
	maintenance_mode: boolean;
	trainer_enabled: boolean;
	community_enabled: boolean;
	leaderboards_enabled: boolean;
	rooms_enabled: boolean;
	battle_enabled: boolean;
	pro_enabled: boolean;
	feature_overrides: Record<string, {mode: string; users: FeatureOverrideUserData[]}>;
	featureOverrides: FeatureOverrideEntryData[];
	updated_at: Date;
}

const DEFAULT_CONFIG: Omit<SiteConfigData, 'id' | 'updated_at' | 'featureOverrides'> = {
	maintenance_mode: false,
	trainer_enabled: true,
	community_enabled: true,
	leaderboards_enabled: true,
	rooms_enabled: true,
	battle_enabled: true,
	pro_enabled: false,
	feature_overrides: {},
};

export async function getSiteConfig(): Promise<SiteConfigData> {
	// Acil durum kill switch
	if (process.env.EMERGENCY_MAINTENANCE === 'true') {
		return {
			id: 'singleton',
			maintenance_mode: true,
			trainer_enabled: false,
			community_enabled: false,
			leaderboards_enabled: false,
			rooms_enabled: false,
			battle_enabled: false,
			pro_enabled: false,
			feature_overrides: {},
			featureOverrides: [],
			updated_at: new Date(),
		};
	}

	const cached = await fetchDataFromCache<SiteConfigData>(
		SITE_CONFIG_CACHE_KEY,
		async () => {
			const prisma = getPrisma();
			let config = await prisma.siteConfig.findUnique({
				where: {id: 'singleton'},
			});

			// Ilk seferde otomatik olustur (singleton row)
			if (!config) {
				config = await prisma.siteConfig.create({
					data: {
						id: 'singleton',
						...(DEFAULT_CONFIG as any),
					},
				});
				logger.info('[SiteConfig] Singleton row olusturuldu');
			}

			return config as unknown as SiteConfigData;
		},
		SITE_CONFIG_TTL
	);

	const rawOverrides = (cached.feature_overrides as Record<string, any>) || {};
	const featureOverrides: FeatureOverrideEntryData[] = Object.entries(rawOverrides).map(([feature, data]) => ({
		feature,
		mode: data?.mode ?? 'ALL',
		users: Array.isArray(data?.users) ? data.users : [],
	}));

	// Redis'ten gelen JSON'da Date string olur — type-graphql Date instance bekliyor
	return {
		...cached,
		feature_overrides: rawOverrides,
		featureOverrides,
		updated_at: new Date(cached.updated_at),
	};
}

export async function updateSiteConfig(
	updates: Partial<Omit<SiteConfigData, 'id' | 'updated_at' | 'featureOverrides'>>,
	userId?: string
): Promise<SiteConfigData> {
	const prisma = getPrisma();

	// Upsert: row yoksa olustur, varsa update et — tek atomik islem
	const updated = await prisma.siteConfig.upsert({
		where: {id: 'singleton'},
		update: {
			...(updates as any),
			updated_by: userId,
		},
		create: {
			id: 'singleton',
			...(DEFAULT_CONFIG as any),
			...(updates as any),
			updated_by: userId,
		},
	});

	logger.info('[SiteConfig] Updated', {updates, userId, result: updated});

	// Cache'i yeni deger ile DOGRUDAN overwrite et (delete sonra fetch yerine)
	// Boylece sonraki istek anlik fresh deger gorur, race condition yok
	try {
		await setKeyInRedis(
			SITE_CONFIG_CACHE_KEY,
			JSON.stringify(updated),
			SITE_CONFIG_TTL
		);
	} catch (err: any) {
		logger.warn('[SiteConfig] Cache write failed, trying delete', {error: err?.message});
		// Fallback: delete et, sonraki cagri DB'den okur
		try {
			await deleteKeyInRedis(SITE_CONFIG_CACHE_KEY);
		} catch {}
	}

	const rawOverrides = (updated.feature_overrides as Record<string, any>) || {};
	const featureOverrides: FeatureOverrideEntryData[] = Object.entries(rawOverrides).map(([feature, data]) => ({
		feature,
		mode: data?.mode ?? 'ALL',
		users: Array.isArray(data?.users) ? data.users : [],
	}));

	return {
		...(updated as any),
		feature_overrides: rawOverrides,
		featureOverrides,
	} as SiteConfigData;
}
