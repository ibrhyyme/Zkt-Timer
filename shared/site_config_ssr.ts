/** Key in the Redux `ssr` slice under which the server seeds the viewer's site config. */
export const SITE_CONFIG_SSR_KEY = 'site_config';

/**
 * The scalar fields of the client's `siteConfig` query (client/graphql/queries.graphql).
 *
 * The SSR seed carries exactly these plus `featureOverrides`, so the server-rendered
 * frame, the first client frame and the first fetch all hold the same shape. Listing
 * them by hand also keeps the raw `feature_overrides` map (every access list, admin
 * data) out of the page. A test compares this list against the query.
 */
export const SITE_CONFIG_SCALAR_FIELDS = [
	'id',
	'maintenance_mode',
	'trainer_enabled',
	'community_enabled',
	'leaderboards_enabled',
	'rooms_enabled',
	'battle_enabled',
	'messaging_enabled',
	'presence_enabled',
	'pro_enabled',
	'wca_backfill_enabled',
	'zkt_backfill_enabled',
	'smart_telemetry_enabled',
	'magnet_telemetry_enabled',
	'online_battle_enabled',
	'method_steps_version',
	'updated_at',
] as const;
