import {v4 as uuid} from 'uuid';
import {getPrisma} from '../database';
import {UserAccount} from '../schemas/UserAccount.schema';
import {Integration} from '../schemas/Integration.schema';
import {IntegrationType} from '../../shared/integration';

/**
 * The columns behind the GraphQL Integration type, i.e. everything except the
 * OAuth credentials (auth_token, refresh_token) and the ranking internals. Use
 * this whenever an integration is loaded alongside a user that may be shown to
 * someone else, so the tokens never leave the database on a read path that has
 * no use for them. Code that needs the tokens (refresh, WCA / ZKT API calls)
 * loads the row by owner through getIntegration and friends.
 */
export const publicIntegrationSelect = {
	id: true,
	user_id: true,
	service_name: true,
	auth_expires_at: true,
	wca_id: true,
	wca_user_id: true,
	wca_name: true,
	wca_avatar_url: true,
	wca_country_iso2: true,
	wca_competition_count: true,
	wca_medal_gold: true,
	wca_medal_silver: true,
	wca_medal_bronze: true,
	wca_record_nr: true,
	wca_record_cr: true,
	wca_record_wr: true,
	wca_show_competitions: true,
	wca_show_medals: true,
	wca_show_records: true,
	wca_show_rank: true,
	wca_show_results: true,
	zkt_user_id: true,
	zkt_id: true,
	zkt_member_no: true,
	zkt_name: true,
	zkt_avatar_url: true,
	zkt_country_iso2: true,
	zkt_show_competitions: true,
	zkt_show_medals: true,
	zkt_show_records: true,
	zkt_show_pbs: true,
	revoked_at: true,
	last_synced_at: true,
	created_at: true,
} as const;

export function createIntegration(user: UserAccount, serviceName, authToken, refreshToken, authExpiresAt) {
	return getPrisma().integration.create({
		data: {
			id: uuid(),
			user_id: user.id,
			service_name: serviceName,
			auth_token: authToken,
			refresh_token: refreshToken,
			auth_expires_at: authExpiresAt,
		},
	});
}

export function updateIntegration(integration: Integration, params) {
	delete params.id;
	delete params.created_at;
	delete params.user_id;

	return getPrisma().integration.update({
		where: {
			id: integration.id,
		},
		data: params,
	});
}

export async function getIntegration(user: UserAccount, intType: IntegrationType): Promise<Integration> {
	return getPrisma().integration.findFirst({
		where: {
			user_id: user.id,
			service_name: intType,
		},
	});
}

export async function getIntegrationByWcaId(wcaId: string): Promise<Integration> {
	return getPrisma().integration.findFirst({
		where: {
			wca_id: wcaId,
			service_name: 'wca',
		},
	});
}

export async function getIntegrationByWcaUserId(wcaUserId: string): Promise<Integration> {
	return getPrisma().integration.findFirst({
		where: {
			wca_user_id: wcaUserId,
			service_name: 'wca',
		},
	});
}

/**
 * Find a ZKT link by the federation's OAuth subject. This is the identity that
 * is always present — zkt_id only exists once the member has competed — so it
 * is the lookup every ZKT login path starts from.
 */
export async function getIntegrationByZktUserId(zktUserId: string): Promise<Integration> {
	return getPrisma().integration.findFirst({
		where: {
			zkt_user_id: zktUserId,
			service_name: 'zkt',
		},
	});
}

/** Find a ZKT link by competition identity (e.g. 2013ISAZ01). */
export async function getIntegrationByZktId(zktId: string): Promise<Integration> {
	return getPrisma().integration.findFirst({
		where: {
			zkt_id: zktId,
			service_name: 'zkt',
		},
	});
}
