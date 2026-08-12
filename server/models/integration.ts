import {v4 as uuid} from 'uuid';
import {getPrisma} from '../database';
import {UserAccount} from '../schemas/UserAccount.schema';
import {Integration} from '../schemas/Integration.schema';
import {IntegrationType} from '../../shared/integration';

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
