import type {Store} from 'redux';
import {getSiteConfig, siteConfigForViewer, SiteConfigData} from '../models/site_config';
import {logger} from './logger';
import {setSsrValue} from '../../client/actions/ssr';
import {SITE_CONFIG_SCALAR_FIELDS, SITE_CONFIG_SSR_KEY} from '../../shared/site_config_ssr';

/**
 * The viewer's site config in the shape the client's `siteConfig` query returns: the same
 * fields, missing nullable columns as null, the date as an ISO string, and the access
 * lists already filtered to this viewer.
 */
export function toSiteConfigSeed(full: SiteConfigData, viewer: {id?: string; admin?: boolean} | null | undefined) {
	const config = siteConfigForViewer(full, viewer) as any;
	const seed: Record<string, any> = {};
	for (const field of SITE_CONFIG_SCALAR_FIELDS) {
		const value = config[field];
		seed[field] = value instanceof Date ? value.toISOString() : value ?? null;
	}
	seed.featureOverrides = (config.featureOverrides || []).map((entry: any) => ({
		feature: entry.feature,
		mode: entry.mode,
		users: (entry.users || []).map((u: any) => ({id: u.id, username: u.username})),
	}));
	return seed;
}

/**
 * Seeds the site config into the SSR store, so the first frame of a page already knows the
 * feature flags (FeatureGuard, maintenance mode) instead of drawing nothing until the first
 * `siteConfig` request returns. The client adopts it in useSiteConfig.ts.
 *
 * getSiteConfig is Redis cached (30 s). A failure leaves the value unset and the client
 * falls back to fetching, as before.
 */
export async function seedSiteConfig(store: Store<any>, me: {id?: string; admin?: boolean} | null | undefined): Promise<void> {
	try {
		const full = await getSiteConfig();
		if (!full) return;
		store.dispatch(setSsrValue(SITE_CONFIG_SSR_KEY, toSiteConfigSeed(full, me)));
	} catch (e) {
		logger.warn('SSR site config seed failed', {error: (e as Error)?.message || e});
	}
}
