import {gql} from '@apollo/client';

// Admin queries for the competition Pro gift (server/resolvers/CompetitionProGift.resolver.ts).

export const GET_COMPETITION_GIFT_DATA = gql`
	query GetCompetitionGiftData {
		competitionProCampaigns {
			id
			zkt_competition_id
			competition_slug
			competition_name
			competition_date
			newcomer_days
			returning_days
			status
			processed_at
			granted_count
			waiting_count
			other_count
		}
	}
`;

export const GET_PRO_GIFT_COMPETITIONS = gql`
	query GetProGiftCompetitions {
		proGiftCompetitions {
			zkt_competition_id
			slug
			name
			date_start
			date_end
			status
			results_published
			campaign_id
		}
	}
`;

export const GET_COMPETITION_PRO_GIFTS = gql`
	query GetCompetitionProGifts($campaignId: String!) {
		competitionProGifts(campaignId: $campaignId) {
			id
			name
			username
			kind
			days
			status
			skip_reason
			granted_at
			pro_until
		}
	}
`;

export const CREATE_COMPETITION_PRO_CAMPAIGN = gql`
	mutation CreateCompetitionProCampaign($input: CompetitionProCampaignInput!) {
		createCompetitionProCampaign(input: $input)
	}
`;

export const UPDATE_COMPETITION_PRO_CAMPAIGN = gql`
	mutation UpdateCompetitionProCampaign($id: String!, $newcomerDays: Int!, $returningDays: Int!) {
		updateCompetitionProCampaign(id: $id, newcomerDays: $newcomerDays, returningDays: $returningDays)
	}
`;

export const DELETE_COMPETITION_PRO_CAMPAIGN = gql`
	mutation DeleteCompetitionProCampaign($id: String!) {
		deleteCompetitionProCampaign(id: $id)
	}
`;

export interface CompetitionCampaign {
	id: string;
	zkt_competition_id: string;
	competition_slug?: string | null;
	competition_name: string;
	competition_date: string;
	newcomer_days: number;
	returning_days: number;
	status: 'armed' | 'processing' | 'done';
	processed_at?: string | null;
	granted_count: number;
	waiting_count: number;
	other_count: number;
}

export interface GiftCompetitionOption {
	zkt_competition_id: string;
	slug?: string | null;
	name: string;
	date_start: string;
	date_end: string;
	status: string;
	results_published: boolean;
	campaign_id?: string | null;
}

export interface CompetitionGift {
	id: string;
	name: string;
	username?: string | null;
	kind: 'newcomer' | 'returning';
	days: number;
	status: 'pending_link' | 'deferred_store' | 'granted' | 'skipped' | 'expired';
	skip_reason?: string | null;
	granted_at?: string | null;
	pro_until?: string | null;
}

const KNOWN_ERRORS = [
	'invalid_days',
	'results_already_published',
	'campaign_exists',
	'campaign_locked',
	'competition_not_found',
	'federation_unreachable',
];

/** Translation key for a server error, under admin_competition_gift. */
export function giftErrorKey(e: any): string {
	const msg = String(e?.message ?? '');
	const code = KNOWN_ERRORS.find((k) => msg.includes(k));
	return code ? `error_${code}` : 'error_generic';
}
