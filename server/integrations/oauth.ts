import { createIntegration, getIntegration, getIntegrationByWcaId, getIntegrationByWcaUserId, updateIntegration } from '../models/integration';
import axios from 'axios';
import { InternalUserAccount, UserAccount } from '../schemas/UserAccount.schema';
import { IntegrationType, LINKED_SERVICES, LinkedServiceData, getWcaRedirectUri, getWcaLoginRedirectUri } from '../../shared/integration';
import { Integration } from '../schemas/Integration.schema';
import { updateUserProfile } from '../models/profile';
import { getUserById } from '../models/user_account';

// WCA /me response sekli — tum OAuth path'lerinde tek nokta sync icin
// Her path'in kendi field-by-field updateIntegration cagrisi yerine bunu kullanmalidir.
// Idempotent: bos update obj'si no-op, mevcut wca_id NEVER nullable'a dusurulmez.
// Parametre `any` — Prisma model ile GraphQL Integration tipi arasinda yapisal uyum tam degil,
// bu fonksiyon sadece integration.id'yi (updateIntegration uzerinden) kullaniyor.
export async function syncWcaProfileToIntegration(
	integration: any,
	wcaData: any,
): Promise<any> {
	if (!wcaData) return integration;

	const update: any = {};

	if (wcaData.id) {
		update.wca_user_id = String(wcaData.id);
	}
	if (wcaData.wca_id) {
		update.wca_id = wcaData.wca_id;
	}
	if (wcaData.name) {
		update.wca_name = wcaData.name;
	}
	const avatarUrl = wcaData.avatar?.thumb_url || wcaData.avatar?.url || null;
	if (avatarUrl) {
		update.wca_avatar_url = avatarUrl;
	}
	if (wcaData.country_iso2) {
		update.wca_country_iso2 = wcaData.country_iso2;
	}

	if (Object.keys(update).length === 0) return integration;

	// Anlamli sync var → revoked_at mark'i temizle (kullanici WCA'ya geri bagland)
	// Idempotent: zaten null ise no-op (DB last-write-wins, problem yok)
	update.revoked_at = null;
	// last_synced_at her basarili sync sonunda set edilir (schema bu alani icermek zorunda)
	update.last_synced_at = new Date();

	return await updateIntegration(integration, update);
}


export async function linkOAuthAccount(intType: IntegrationType, user: InternalUserAccount, code: string) {
	const int = await getIntegration(user, intType);
	const service = LINKED_SERVICES[intType];

	const { accessToken, refreshToken, expiresIn, createdAt } = await getOAuthPostRequest(
		service,
		service.tokenEndpoint,
		{
			grant_type: 'authorization_code',
			code,
		}
	);

	if (int) {
		await updateIntegration(int, {
			auth_token: accessToken,
			refresh_token: refreshToken,
			auth_expires_at: createdAt + expiresIn * 1000,
		});

		if (intType === 'wca') {
			try {
				const res = await axios.get(service.meEndpoint, {
					headers: { Authorization: 'Bearer ' + accessToken },
				});
				const wcaData = res?.data?.me || res?.data;
				await syncWcaProfileToIntegration(int, wcaData);
			} catch (error) {
				console.warn('Failed to fetch WCA ID on re-link:', error.message);
			}
		}

		// Guncel integration'i dondur (wca_id dahil)
		const updated = await getIntegration(user, intType);
		return updated || int;
	}

	// WCA icin: kullanici bilgilerini al, sonra integration olustur
	if (intType === 'wca') {
		const res = await axios.get(service.meEndpoint, {
			headers: {Authorization: 'Bearer ' + accessToken},
		});
		const wcaData = res?.data?.me || res?.data;
		const wcaId = wcaData?.wca_id || null;
		const wcaUserId = wcaData?.id ? String(wcaData.id) : null;

		// Baska kullaniciya bagli kontrolu — wca_user_id (newcomer dahil her zaman var) ve wca_id (yarismaya katilanlar)
		let conflict: Integration | null = null;
		if (wcaUserId) {
			const byUser = await getIntegrationByWcaUserId(wcaUserId);
			if (byUser && byUser.user_id !== user.id) conflict = byUser;
		}
		if (!conflict && wcaId) {
			const byId = await getIntegrationByWcaId(wcaId);
			if (byId && byId.user_id !== user.id) conflict = byId;
		}
		if (conflict) {
			const owner = await getUserById(conflict.user_id);
			throw new Error(JSON.stringify({
				code: 'WCA_ACCOUNT_ALREADY_LINKED',
				ownerUsername: owner?.username ?? null,
			}));
		}

		let integration = await createIntegration(user, intType, accessToken, refreshToken, createdAt + expiresIn * 1000);
		integration = await syncWcaProfileToIntegration(integration, wcaData);
		return integration;
	}

	return await createIntegration(user, intType, accessToken, refreshToken, createdAt + expiresIn * 1000);
}

export async function getOAuthPostRequest(
	service: LinkedServiceData,
	serviceEndpoint: string,
	additionalData: { [key: string]: string } = {},
	overrideRedirectUri?: string
) {
	const intType = service.id;

	// Special handling for WCA
	if (intType === 'wca') {
		const clientId = process.env.WCA_CLIENT_ID || '';
		const clientSecret = process.env.WCA_CLIENT_SECRET || '';
		const redirectUri = overrideRedirectUri || getWcaRedirectUri();

		// Debug logging (secrets redacted — sadece varlik kontrolu)
		console.log('WCA OAuth request details:', {
			clientId: clientId ? 'PRESENT' : 'MISSING',
			clientSecret: clientSecret ? 'PRESENT' : 'MISSING',
			redirectUri,
			endpoint: serviceEndpoint,
			additionalDataKeys: Object.keys(additionalData),
		});

		const body = new URLSearchParams();
		body.append('client_id', clientId);
		body.append('client_secret', clientSecret);
		body.append('redirect_uri', redirectUri);

		// Add additional data (grant_type, code, etc.)
		for (const [key, value] of Object.entries(additionalData)) {
			body.append(key, value);
		}

		try {
			const res = await axios.post(serviceEndpoint, body, {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			});

			console.log('WCA token exchange successful');
			return {
				accessToken: res.data.access_token,
				refreshToken: res.data.refresh_token,
				expiresIn: res.data.expires_in,
				createdAt: new Date().getTime(),
			};
		} catch (error) {
			// Log and re-throw error (request body sirlari icerir, log'lanmaz)
			if (error.response) {
				console.error('WCA token exchange failed:', error.response.status, error.response.data);
				throw new Error(error.response.data?.error_description || error.response.data?.error || 'WCA token exchange failed');
			}
			throw error;
		}
	}

	// Original logic for other services (Discord etc.)
	const secretEnvKey = `${intType.toUpperCase()}_SECRET`;
	const params = new URLSearchParams();
	params.append('client_id', service.clientId);
	params.append('client_secret', process.env[secretEnvKey]);
	params.append('redirect_uri', `${process.env.BASE_URI}/oauth/${intType}`);

	for (const [key, value] of Object.entries(additionalData)) {
		params.append(key, value);
	}

	try {
		const res = await axios.post(serviceEndpoint, params, {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});

		return {
			accessToken: res.data.access_token,
			refreshToken: res.data.refresh_token,
			expiresIn: res.data.expires_in,
			createdAt: new Date().getTime(),
		};
	} catch (error) {
		// Log and re-throw error with response body for debugging
		if (error.response) {
			console.error('OAuth token exchange failed:', error.response.status, error.response.data);
			throw new Error(error.response.data?.error_description || error.response.data?.error || 'OAuth token exchange failed');
		}
		throw error;
	}
}

export async function exchangeWcaLoginCode(code: string) {
	const service = LINKED_SERVICES['wca'];
	const redirectUri = getWcaLoginRedirectUri();

	const { accessToken, refreshToken, expiresIn, createdAt } = await getOAuthPostRequest(
		service,
		service.tokenEndpoint,
		{ grant_type: 'authorization_code', code },
		redirectUri
	);

	let wcaData: any;
	try {
		const res = await axios.get(service.meEndpoint, {
			headers: { Authorization: 'Bearer ' + accessToken },
		});
		wcaData = res?.data?.me || res?.data;
	} catch (error) {
		console.error('Failed to fetch WCA user data:', error?.message);
		throw new Error('WCA kullanici bilgileri alinamadi');
	}

	if (!wcaData) {
		throw new Error('WCA kullanici bilgileri alinamadi');
	}

	return {
		email: wcaData.email,
		name: wcaData.name || '',
		wcaId: wcaData.wca_id || null,
		wcaUserId: wcaData.id ? String(wcaData.id) : null,
		wcaAvatarUrl: (wcaData.avatar?.thumb_url || wcaData.avatar?.url || null) as string | null,
		countryIso2: wcaData.country_iso2 || null,
		gender: wcaData.gender,
		accessToken,
		refreshToken,
		expiresAt: createdAt + expiresIn * 1000,
		rawWcaData: wcaData,
	};
}

// Sentinel: token kalici olarak gecersiz (WCA tarafinda revoke edildi veya kullanici sildi)
// Caller'lar bu mesaji yakalayip integration'i revoked_at ile isaretler.
export const WCA_TOKEN_REVOKED = 'WCA_TOKEN_REVOKED';

export async function getAuthToken(intType: IntegrationType, user: UserAccount) {
	const integration = await getIntegration(user, intType);

	if (!integration) {
		throw new Error('Integration not found');
	}

	let authToken: string = integration.auth_token;
	const expiresAt = new Date(Number(integration.auth_expires_at));
	const now = new Date();

	if (expiresAt < now) {
		try {
			authToken = await getNewAuthToken(integration);
		} catch (e: any) {
			// Refresh kalici hata aldi — integration'i revoked olarak isaretle, error'i re-throw et
			if (e?.message === WCA_TOKEN_REVOKED) {
				try {
					await updateIntegration(integration, {revoked_at: new Date()} as any);
				} catch (markErr: any) {
					console.warn('[oauth] Failed to mark integration revoked:', markErr?.message);
				}
			}
			throw e;
		}
	}

	return authToken;
}

async function getNewAuthToken(integration: Integration) {
	const intType = integration.service_name;
	const service = LINKED_SERVICES[intType];

	try {
		const { accessToken, refreshToken, expiresIn, createdAt } = await getOAuthPostRequest(
			service,
			service.tokenEndpoint,
			{
				grant_type: 'refresh_token',
				refresh_token: integration.refresh_token,
			}
		);

		const int = await updateIntegration(integration, {
			auth_token: accessToken,
			auth_expires_at: createdAt + expiresIn * 1000,
			refresh_token: refreshToken,
		});

		return int.auth_token;
	} catch (e: any) {
		const status = e?.response?.status;
		console.warn('Token refresh failed for', integration.service_name, 'status=', status, ':', e?.message);
		// 400/401 -> refresh_token gecersiz, kalici hata. Diger durumlar transient.
		if (status === 400 || status === 401) {
			throw new Error(WCA_TOKEN_REVOKED);
		}
		throw e;
	}
}

export async function getIntegrationGetMe(intType: IntegrationType, user: UserAccount) {
	const authToken = await getAuthToken(intType, user);
	const service = LINKED_SERVICES[intType];

	let res;
	try {
		res = await axios.get(service.meEndpoint, {
			headers: {
				Authorization: 'Bearer ' + authToken,
			},
		});
	} catch (e: any) {
		const status = e?.response?.status;
		// 401: token revoked/invalid (sentinel davranis)
		// 404: WCA hesabi silinmis
		if (status === 401 || status === 404) {
			const integration = await getIntegration(user, intType);
			if (integration) {
				try {
					await updateIntegration(integration, {revoked_at: new Date()} as any);
				} catch (markErr: any) {
					console.warn('[oauth] Failed to mark integration revoked on /me:', markErr?.message);
				}
			}
		}
		throw e;
	}

	const me = res?.data?.me;

	if (me) {
		return me;
	} else if (!me && res?.data) {
		return res.data;
	} else {
		throw new Error('Invalid request');
	}
}

export async function revokeIntegration(intType: IntegrationType, user: UserAccount) {
	const service = LINKED_SERVICES[intType];
	const auth = await getAuthToken(intType, user);

	await getOAuthPostRequest(service, service.revokeEndpoint, {
		token: auth,
	});


}
