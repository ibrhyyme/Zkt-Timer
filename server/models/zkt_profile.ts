import {getPrisma} from '../database';
import {PublicZktProfile} from '../schemas/PublicZktProfile.schema';
import {ZktFederationService} from '../services/ZktFederationService';

// A member's ZKT career shown on a Zkt-Timer profile. Nothing is mirrored into
// our database: the federation owns these numbers and republishes them the
// moment a result is entered, so a local copy would go stale between syncs and
// there would be nothing to sync it FROM (no webhook). The only local state is
// the set of visibility switches on the integration row.

interface FederationPersonSummary {
	zktId?: string;
	name?: string;
	country?: string;
	competitionCount?: number;
	medals?: {gold?: number; silver?: number; bronze?: number};
	recordCount?: number;
	personalBests?: {eventId: string; single?: string | null; average?: string | null}[];
}

export async function getPublicZktProfile(userId: string): Promise<PublicZktProfile | null> {
	if (!userId) {
		return null;
	}

	const integration = await getPrisma().integration.findFirst({
		where: {user_id: userId, service_name: 'zkt'},
	});

	if (!integration) {
		return null;
	}

	const anyIntegration = integration as any;
	const showCompetitions = anyIntegration.zkt_show_competitions !== false;
	const showMedals = anyIntegration.zkt_show_medals !== false;
	const showRecords = anyIntegration.zkt_show_records !== false;
	const showPbs = anyIntegration.zkt_show_pbs !== false;

	const base: PublicZktProfile = {
		zkt_id: integration.zkt_id || undefined,
		zkt_name: integration.zkt_name || undefined,
		zkt_country_iso2: integration.zkt_country_iso2 || undefined,
		zkt_member_no: integration.zkt_member_no ?? undefined,
		zkt_show_competitions: showCompetitions,
		zkt_show_medals: showMedals,
		zkt_show_records: showRecords,
		zkt_show_pbs: showPbs,
	};

	// No ZKT id means the member has not competed yet — the federation issues it
	// with their first published result. There is nothing to look up, but the
	// linked identity itself is still worth showing.
	if (!integration.zkt_id) {
		return base;
	}

	const summary = (await ZktFederationService.fetchPersonSummary(integration.zkt_id).catch(
		() => null
	)) as FederationPersonSummary | null;

	if (!summary) {
		return base;
	}

	return {
		...base,
		zkt_name: summary.name || base.zkt_name,
		zkt_country_iso2: summary.country || base.zkt_country_iso2,
		zkt_competition_count: showCompetitions ? summary.competitionCount ?? 0 : undefined,
		zkt_medal_gold: showMedals ? summary.medals?.gold ?? 0 : undefined,
		zkt_medal_silver: showMedals ? summary.medals?.silver ?? 0 : undefined,
		zkt_medal_bronze: showMedals ? summary.medals?.bronze ?? 0 : undefined,
		zkt_record_count: showRecords ? summary.recordCount ?? 0 : undefined,
		zkt_personal_bests: showPbs
			? (summary.personalBests || []).map((pb) => ({
					event_id: pb.eventId,
					single: pb.single ?? undefined,
					average: pb.average ?? undefined,
				}))
			: undefined,
	};
}

/**
 * The viewer's own ZKT profile, visibility switches INCLUDED and no section
 * blanked out — this is what the "manage ZKT data" panel edits, so it has to
 * show the owner what a hidden section still contains.
 */
export async function getMyZktProfile(userId: string): Promise<PublicZktProfile | null> {
	const integration = await getPrisma().integration.findFirst({
		where: {user_id: userId, service_name: 'zkt'},
	});
	if (!integration) {
		return null;
	}

	const anyIntegration = integration as any;
	const base: PublicZktProfile = {
		zkt_id: integration.zkt_id || undefined,
		zkt_name: integration.zkt_name || undefined,
		zkt_country_iso2: integration.zkt_country_iso2 || undefined,
		zkt_member_no: integration.zkt_member_no ?? undefined,
		zkt_show_competitions: anyIntegration.zkt_show_competitions !== false,
		zkt_show_medals: anyIntegration.zkt_show_medals !== false,
		zkt_show_records: anyIntegration.zkt_show_records !== false,
		zkt_show_pbs: anyIntegration.zkt_show_pbs !== false,
	};

	if (!integration.zkt_id) {
		return base;
	}

	const summary = (await ZktFederationService.fetchPersonSummary(integration.zkt_id).catch(
		() => null
	)) as FederationPersonSummary | null;

	if (!summary) {
		return base;
	}

	return {
		...base,
		zkt_name: summary.name || base.zkt_name,
		zkt_country_iso2: summary.country || base.zkt_country_iso2,
		zkt_competition_count: summary.competitionCount ?? 0,
		zkt_medal_gold: summary.medals?.gold ?? 0,
		zkt_medal_silver: summary.medals?.silver ?? 0,
		zkt_medal_bronze: summary.medals?.bronze ?? 0,
		zkt_record_count: summary.recordCount ?? 0,
		zkt_personal_bests: (summary.personalBests || []).map((pb) => ({
			event_id: pb.eventId,
			single: pb.single ?? undefined,
			average: pb.average ?? undefined,
		})),
	};
}
