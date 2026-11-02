import {getPrisma} from '../database';
import {PublicZktProfile, ZktEventPb, ZktRankPosition} from '../schemas/PublicZktProfile.schema';
import {ZktPersonResults} from '../schemas/ZktPersonResults.schema';
import {ZktFederationService} from '../services/ZktFederationService';

// A member's ZKT career shown on a Zkt-Timer profile. Nothing is mirrored into
// our database: the federation owns these numbers and republishes them the
// moment a result is entered, so a local copy would go stale between syncs and
// there would be nothing to sync it FROM (no webhook). The only local state is
// the set of visibility switches on the integration row.

interface FederationRank {
	rank: number;
	total: number;
}

interface FederationPb {
	eventId: string;
	single?: string | null;
	average?: string | null;
	singleRank?: FederationRank | null;
	averageRank?: FederationRank | null;
}

export interface FederationPersonSummary {
	zktId?: string;
	name?: string;
	country?: string;
	competitionCount?: number;
	medals?: {gold?: number; silver?: number; bronze?: number};
	recordCount?: number;
	personalBests?: FederationPb[];
}

/** The integration columns this module reads. */
export interface ZktIntegrationRow {
	zkt_id?: string | null;
	zkt_name?: string | null;
	zkt_country_iso2?: string | null;
	zkt_avatar_url?: string | null;
	zkt_member_no?: number | null;
	zkt_show_competitions?: boolean | null;
	zkt_show_medals?: boolean | null;
	zkt_show_records?: boolean | null;
	zkt_show_pbs?: boolean | null;
	zkt_show_rank?: boolean | null;
	zkt_show_results?: boolean | null;
}

function toRank(position?: FederationRank | null): ZktRankPosition | undefined {
	return position && position.rank > 0 ? {rank: position.rank, total: position.total} : undefined;
}

/** Federation PBs in our GraphQL shape; ranks only when the member shows them. */
export function mapFederationPbs(pbs: FederationPb[] | undefined, showRank: boolean): ZktEventPb[] {
	return (pbs || []).map((pb) => ({
		event_id: pb.eventId,
		single: pb.single ?? undefined,
		average: pb.average ?? undefined,
		single_rank: showRank ? toRank(pb.singleRank) : undefined,
		average_rank: showRank ? toRank(pb.averageRank) : undefined,
	}));
}

/**
 * The member's best ranking position across every event, single or average,
 * as the federation's own cuber page shows it. On a tie the first event in the
 * federation's order wins, same as best_world_rank on the WCA side.
 */
export function bestZktRank(pbs: FederationPb[] | undefined): {rank: number; eventId: string} | null {
	let best: {rank: number; eventId: string} | null = null;
	for (const pb of pbs || []) {
		for (const position of [pb.singleRank, pb.averageRank]) {
			if (position && position.rank > 0 && (best === null || position.rank < best.rank)) {
				best = {rank: position.rank, eventId: pb.eventId};
			}
		}
	}
	return best;
}

/**
 * The profile from the integration row and the federation summary.
 *
 * `public` blanks every section the member switched off, so hidden data never
 * reaches another viewer's browser, and never carries the member number.
 * `owner` returns everything: the manage panel has to show what a hidden
 * section still holds.
 */
export function buildZktProfile(
	row: ZktIntegrationRow,
	summary: FederationPersonSummary | null,
	audience: 'public' | 'owner'
): PublicZktProfile {
	const visible = {
		competitions: row.zkt_show_competitions !== false,
		medals: row.zkt_show_medals !== false,
		records: row.zkt_show_records !== false,
		pbs: row.zkt_show_pbs !== false,
		rank: row.zkt_show_rank !== false,
		results: row.zkt_show_results !== false,
	};
	const show = (on: boolean) => audience === 'owner' || on;

	const base: PublicZktProfile = {
		zkt_id: row.zkt_id || undefined,
		zkt_name: row.zkt_name || undefined,
		zkt_country_iso2: row.zkt_country_iso2 || undefined,
		zkt_avatar_url: row.zkt_avatar_url || undefined,
		zkt_member_no: audience === 'owner' ? row.zkt_member_no ?? undefined : undefined,
		zkt_show_competitions: visible.competitions,
		zkt_show_medals: visible.medals,
		zkt_show_records: visible.records,
		zkt_show_pbs: visible.pbs,
		zkt_show_rank: visible.rank,
		zkt_show_results: visible.results,
	};

	// No summary: either no ZKT id yet (the federation issues it with the first
	// published result) or the federation could not answer. Every number stays
	// undefined so the profile shows nothing rather than a false zero.
	if (!summary) {
		return base;
	}

	const best = show(visible.rank) ? bestZktRank(summary.personalBests) : null;

	return {
		...base,
		zkt_name: summary.name || base.zkt_name,
		zkt_country_iso2: summary.country || base.zkt_country_iso2,
		zkt_competition_count: show(visible.competitions) ? summary.competitionCount ?? 0 : undefined,
		zkt_medal_gold: show(visible.medals) ? summary.medals?.gold ?? 0 : undefined,
		zkt_medal_silver: show(visible.medals) ? summary.medals?.silver ?? 0 : undefined,
		zkt_medal_bronze: show(visible.medals) ? summary.medals?.bronze ?? 0 : undefined,
		zkt_record_count: show(visible.records) ? summary.recordCount ?? 0 : undefined,
		zkt_personal_bests: show(visible.pbs)
			? mapFederationPbs(summary.personalBests, show(visible.rank))
			: undefined,
		zkt_best_rank: best?.rank,
		zkt_best_rank_event: best?.eventId,
	};
}

function loadZktIntegration(userId: string) {
	return getPrisma().integration.findFirst({
		where: {user_id: userId, service_name: 'zkt'},
	});
}

async function loadSummary(zktId: string | null | undefined): Promise<FederationPersonSummary | null> {
	if (!zktId) return null;
	return (await ZktFederationService.fetchPersonSummary(zktId).catch(
		() => null
	)) as FederationPersonSummary | null;
}

export async function getPublicZktProfile(userId: string): Promise<PublicZktProfile | null> {
	if (!userId) {
		return null;
	}
	const integration = await loadZktIntegration(userId);
	if (!integration) {
		return null;
	}
	return buildZktProfile(integration, await loadSummary(integration.zkt_id), 'public');
}

/** The viewer's own ZKT profile, every section present regardless of its switch. */
export async function getMyZktProfile(userId: string): Promise<PublicZktProfile | null> {
	const integration = await loadZktIntegration(userId);
	if (!integration) {
		return null;
	}
	return buildZktProfile(integration, await loadSummary(integration.zkt_id), 'owner');
}

/**
 * The member's result-by-result ZKT history for the profile tab. Null when the
 * account is not linked, has no ZKT id yet, or the member switched the history
 * off. A federation failure throws, so the caller can tell it from "nothing".
 */
export async function getPublicZktResults(userId: string): Promise<ZktPersonResults | null> {
	if (!userId) {
		return null;
	}
	const integration = await loadZktIntegration(userId);
	if (!integration?.zkt_id || integration.zkt_show_results === false) {
		return null;
	}
	return (await ZktFederationService.fetchPersonResults(integration.zkt_id)) as ZktPersonResults | null;
}
