/**
 * The two modes on the /battle landing (ranking-battle 5.2) and every launch decision that
 * hangs off the `online_battle_enabled` site flag (5.1, 7.1 step 7, 7.4).
 *
 * Pure on purpose: the server seeds the same decision into the SSR store (server/router.tsx),
 * the client re-derives it from the live config, and Jest pins both without a DOM.
 */
import type {Icon} from 'phosphor-react';
import {Globe, UsersThree} from 'phosphor-react';
import type {ModeAccent} from '../trainer/landing_modes';

export type BattleModeId = 'online' | 'offline';

export interface BattleMode {
	id: BattleModeId;
	link: string;
	titleKey: string;
	descKey: string;
	/** Short label at the card's top right: what the mode needs. */
	tagKey: string;
	ctaKey: string;
	Icon: Icon;
	/** Card colour, from the trainer's palette: the hub draws the trainer's own cards. */
	accent: ModeAccent;
	/** The card's "What's inside" list. */
	featureKeys: string[];
}

export const ONLINE_BATTLE_PATH = '/battle/online';
export const OFFLINE_BATTLE_PATH = '/battle/offline';

export const BATTLE_MODES: BattleMode[] = [
	{
		id: 'online',
		link: ONLINE_BATTLE_PATH,
		titleKey: 'battle_landing.online_title',
		descKey: 'battle_landing.online_desc',
		tagKey: 'battle_landing.online_tag',
		ctaKey: 'battle_landing.online_cta',
		Icon: Globe,
		accent: 'blue',
		featureKeys: [
			'battle_landing.online_f1',
			'battle_landing.online_f2',
			'battle_landing.online_f3',
			'battle_landing.online_f4',
		],
	},
	{
		id: 'offline',
		link: OFFLINE_BATTLE_PATH,
		titleKey: 'battle_landing.offline_title',
		descKey: 'battle_landing.offline_desc',
		tagKey: 'battle_landing.offline_tag',
		ctaKey: 'battle_landing.offline_cta',
		Icon: UsersThree,
		accent: 'orange',
		featureKeys: [
			'battle_landing.offline_f1',
			'battle_landing.offline_f2',
			'battle_landing.offline_f3',
			'battle_landing.offline_f4',
		],
	},
];

// ── Launch flags ────────────────────────────────────────────────────────────

/** Key of the decision the server seeds into the `ssr` slice for the first render. */
export const BATTLE_LAUNCH_SSR_KEY = 'battle_launch';

/**
 * `launched`: Online Battle is public (flag on). Drives everything a visitor or a crawler
 * sees: the Sıralama menu entry, /ranks indexing, sitemap, help and landing copy.
 * `open`: this user may play (admin, flag on, or on the flag's access list). Drives the
 * /battle landing, mirroring FeatureGuard and the server's isOnlineBattleOpen.
 */
export interface BattleLaunch {
	launched: boolean;
	open: boolean;
}

/** The slice of the site config these decisions read; the server and the client shapes both fit. */
export interface BattleLaunchConfig {
	leaderboards_enabled?: boolean | null;
	online_battle_enabled?: boolean | null;
	featureOverrides?: ReadonlyArray<{feature?: string | null; users?: ReadonlyArray<{id?: string | null} | null> | null} | null> | null;
}

export interface BattleLaunchUser {
	id?: string | null;
	admin?: boolean | null;
}

/** Public launch: the leaderboard page is on and Online Battle is on. Admins do not bypass it. */
export function isOnlineBattleLaunched(config: BattleLaunchConfig | null | undefined): boolean {
	return !!config?.online_battle_enabled && config?.leaderboards_enabled !== false;
}

/** Same rule as FeatureGuard for `online_battle_enabled`. */
export function canOpenOnlineBattle(
	config: BattleLaunchConfig | null | undefined,
	user: BattleLaunchUser | null | undefined
): boolean {
	if (user?.admin) return true;
	if (!config) return false;
	if (config.online_battle_enabled) return true;
	if (!user?.id) return false;
	const override = config.featureOverrides?.find((o) => o?.feature === 'online_battle_enabled');
	return !!override?.users?.some((u) => u?.id === user.id);
}

export function battleLaunchFromConfig(
	config: BattleLaunchConfig | null | undefined,
	user: BattleLaunchUser | null | undefined
): BattleLaunch {
	return {launched: isOnlineBattleLaunched(config), open: canOpenOnlineBattle(config, user)};
}

/** Reads a seeded value back out of the store; anything malformed counts as unknown. */
export function readSeededBattleLaunch(value: unknown): BattleLaunch | null {
	if (!value || typeof value !== 'object') return null;
	const v = value as Record<string, unknown>;
	if (typeof v.launched !== 'boolean' || typeof v.open !== 'boolean') return null;
	return {launched: v.launched, open: v.open};
}

// ── Landing ─────────────────────────────────────────────────────────────────

/**
 * What /battle draws. Until Online Battle is open to this user it is exactly the offline
 * battle of today (5.1). Unknown config: wait like FeatureGuard does, except offline, where
 * the local battle is the only thing that can work.
 */
export type BattleLandingView = 'cards' | 'offline' | 'wait';

export function pickBattleLandingView(launch: BattleLaunch | null, networkOnline: boolean): BattleLandingView {
	if (launch) return launch.open ? 'cards' : 'offline';
	return networkOnline ? 'wait' : 'offline';
}

export interface LandingRating {
	rating: number;
	provisional: boolean;
	games: number;
}

/**
 * The online card's rating line (5.2): the rating for someone who has one, the first match
 * invitation for a signed-in player without one, nothing while unknown or signed out.
 */
export type RatingLine = {kind: 'rating'; rating: number; provisional: boolean} | {kind: 'first_match'} | null;

export function ratingLine(signedIn: boolean, rating: LandingRating | null | undefined, loaded: boolean): RatingLine {
	if (!signedIn || !loaded) return null;
	if (rating && rating.games > 0 && Number.isFinite(rating.rating)) {
		return {kind: 'rating', rating: Math.round(rating.rating), provisional: !!rating.provisional};
	}
	return {kind: 'first_match'};
}

/** "Searching now" hides at 0 so an empty queue does not greet the visitor (5.2). */
export function showSearchingCount(count: number | null | undefined): count is number {
	return typeof count === 'number' && count > 0;
}

// ── SEO ─────────────────────────────────────────────────────────────────────

/**
 * Indexing rules that depend on the launch (7.4). /battle/online is a signed-in live screen
 * and never indexed. /ranks stays out until launch; an unknown flag keeps it out.
 */
export function isLaunchNoIndexPath(path: string, launched: boolean | null): boolean {
	if (path === ONLINE_BATTLE_PATH || path.startsWith(`${ONLINE_BATTLE_PATH}/`)) return true;
	if (path === '/ranks' || path.startsWith('/ranks/')) return launched !== true;
	return false;
}

/**
 * Canonical path for a battle page. Before launch /battle draws the same offline battle as
 * /battle/offline, so the latter points at /battle (7.4).
 */
export function battleCanonicalPath(path: string, launched: boolean | null): string {
	if (path === OFFLINE_BATTLE_PATH && launched !== true) return '/battle';
	return path;
}

/**
 * Sitemap paths that wait for the launch (7.4): /ranks (noindex until then) and
 * /battle/offline (canonical to /battle until then). /battle/online never goes in.
 */
export function sitemapLaunchExclusions(launched: boolean): string[] {
	return launched ? [ONLINE_BATTLE_PATH] : [ONLINE_BATTLE_PATH, OFFLINE_BATTLE_PATH, '/ranks'];
}

const LAUNCH_BLOCK = /<!-- launch:online_battle -->\r?\n([\s\S]*?)<!-- \/launch:online_battle -->\r?\n?/g;

/**
 * llms.txt keeps its launch-only lines between `<!-- launch:online_battle -->` markers. The
 * /llms.txt route drops the block before launch and only the markers after (7.4), so the
 * lines appear with the flag and no deploy.
 */
export function applyLaunchBlocks(text: string, launched: boolean): string {
	return text.replace(LAUNCH_BLOCK, (_all, inner: string) => (launched ? inner : ''));
}
