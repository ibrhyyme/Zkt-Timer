import axios from 'axios';
import {LINKED_SERVICES, getZktRedirectUri, getZktLoginRedirectUri} from '../../shared/integration';
import {updateIntegration} from '../models/integration';
import {logger} from '../services/logger';

// OAuth client for the Zeka Kupu Turkiye federation, which runs its own
// authorization server (see the federation repo, app/api/oauth/*).
//
// Kept apart from integrations/oauth.ts rather than folded into its generic
// branch: that branch hard-codes `${BASE_URI}/oauth/${type}` as the redirect and
// has no notion of a second, login-specific callback. The two flows here differ
// only in which redirect_uri they present, and the federation compares it
// byte-for-byte, so the difference has to be explicit.

export interface ZktProfile {
	/** Federation user id — the OAuth subject. Always present. */
	sub: string;
	/** Competition identity, null until the member's first result is published. */
	zktId: string | null;
	memberNo: number | null;
	name: string | null;
	firstName: string | null;
	lastName: string | null;
	email: string | null;
	emailVerified: boolean;
	avatarUrl: string | null;
	countryIso2: string | null;
	/** The member's WCA id if they linked one on the federation side. */
	wcaId: string | null;
}

export interface ZktTokenSet {
	accessToken: string;
	refreshToken: string | null;
	expiresAt: number;
}

function clientCredentials(): {clientId: string; clientSecret: string} {
	return {
		clientId: process.env.ZKT_CLIENT_ID || 'zkt-timer',
		clientSecret: process.env.ZKT_SECRET || '',
	};
}

async function postToken(body: URLSearchParams): Promise<ZktTokenSet> {
	const service = LINKED_SERVICES.zkt;
	const {clientId, clientSecret} = clientCredentials();
	body.append('client_id', clientId);
	body.append('client_secret', clientSecret);

	try {
		const res = await axios.post(service.tokenEndpoint, body, {
			headers: {'Content-Type': 'application/x-www-form-urlencoded'},
			timeout: 15000,
		});
		return {
			accessToken: res.data.access_token,
			refreshToken: res.data.refresh_token ?? null,
			// Absolute epoch ms, which is what the Integration row stores.
			expiresAt: Date.now() + (Number(res.data.expires_in) || 3600) * 1000,
		};
	} catch (error: any) {
		// The federation answers with RFC error codes; surface the code, never the
		// request body (it carries the client secret).
		const detail = error?.response?.data?.error_description || error?.response?.data?.error;
		logger.warn('[ZktOAuth] token exchange failed', {
			status: error?.response?.status,
			detail,
		});
		throw new Error(detail || 'ZKT token exchange failed');
	}
}

/** Exchange an authorization code from the ACCOUNT LINKING callback. */
export function exchangeZktLinkCode(code: string): Promise<ZktTokenSet> {
	return postToken(
		new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: getZktRedirectUri(),
		})
	);
}

/** Exchange an authorization code from the LOGIN/SIGNUP callback. */
export function exchangeZktLoginCode(code: string): Promise<ZktTokenSet> {
	return postToken(
		new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: getZktLoginRedirectUri(),
		})
	);
}

export function refreshZktToken(refreshToken: string): Promise<ZktTokenSet> {
	return postToken(
		new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
		})
	);
}

/**
 * Hand a grant straight back to the federation.
 *
 * Every abandoned login path has to call this. The flow reaches them AFTER the
 * member approved on the consent screen and after the code was exchanged, so
 * the federation already believes this app holds a live grant — while we, having
 * refused the sign-in, keep no record of it at all. Two things then go wrong:
 * the token sits there unreachable until it expires, and `hasLiveGrant` treats
 * it as standing approval, so the NEXT connection skips the consent screen
 * entirely. The member approved a sign-in that never happened and the approval
 * outlived it.
 *
 * One call is enough to kill the whole grant: access and refresh hashes live on
 * the same row, and the endpoint revokes on either (RFC 7009).
 *
 * Best-effort and never throws. Callers are already on their way to reporting a
 * different, more useful error, and losing that error to a network blip on the
 * cleanup would be a bad trade.
 */
export async function revokeZktGrant(accessToken: string | null | undefined): Promise<void> {
	if (!accessToken) return;
	const service = LINKED_SERVICES.zkt;
	const {clientId, clientSecret} = clientCredentials();
	try {
		await axios.post(
			service.revokeEndpoint,
			new URLSearchParams({token: accessToken, client_id: clientId, client_secret: clientSecret}),
			{headers: {'Content-Type': 'application/x-www-form-urlencoded'}, timeout: 10000}
		);
	} catch (error: any) {
		logger.warn('[ZktOAuth] grant revoke failed', {status: error?.response?.status});
	}
}

export async function fetchZktProfile(accessToken: string): Promise<ZktProfile> {
	const service = LINKED_SERVICES.zkt;
	const res = await axios.get(service.meEndpoint, {
		headers: {Authorization: `Bearer ${accessToken}`},
		timeout: 15000,
	});
	const data = res.data || {};
	return {
		sub: String(data.sub),
		zktId: data.zkt_id ?? null,
		memberNo: typeof data.zkt_member_no === 'number' ? data.zkt_member_no : null,
		name: data.name ?? null,
		firstName: data.first_name ?? null,
		lastName: data.last_name ?? null,
		email: data.email ?? null,
		emailVerified: data.email_verified === true,
		avatarUrl: data.avatar_url ?? null,
		countryIso2: data.country_iso2 ?? null,
		wcaId: data.wca_id ?? null,
	};
}

/**
 * Write the federation profile onto an Integration row.
 *
 * `zkt_id` is written even when it arrives null: a member who competed and then
 * had their ID reissued must not keep the stale one, and null is the honest
 * answer for someone who has not competed yet. Everything else keeps its
 * previous value when the federation has nothing to say, so a partial profile
 * cannot blank a name we already have.
 */
export async function syncZktProfileToIntegration(integration: any, profile: ZktProfile): Promise<any> {
	const update: any = {
		zkt_user_id: profile.sub,
		zkt_id: profile.zktId,
		revoked_at: null,
		last_synced_at: new Date(),
	};
	if (profile.memberNo != null) update.zkt_member_no = profile.memberNo;
	if (profile.name) update.zkt_name = profile.name;
	if (profile.avatarUrl) update.zkt_avatar_url = profile.avatarUrl;
	if (profile.countryIso2) update.zkt_country_iso2 = profile.countryIso2;
	return updateIntegration(integration, update);
}

/**
 * A valid access token for this integration, refreshing it when it has run out.
 *
 * Returns null instead of throwing when the grant is gone (member revoked it on
 * the federation side): the callers are read paths that should degrade to "no
 * ZKT data" rather than fail the whole screen.
 */
export async function getValidZktAccessToken(integration: any): Promise<string | null> {
	if (!integration) return null;
	const expiresAt = Number(integration.auth_expires_at || 0);
	// One minute of slack, so a token that expires mid-request is refreshed now
	// rather than failing the call it was about to make.
	if (integration.auth_token && expiresAt > Date.now() + 60_000) {
		return integration.auth_token;
	}
	if (!integration.refresh_token) return null;

	try {
		const tokens = await refreshZktToken(integration.refresh_token);
		await updateIntegration(integration, {
			auth_token: tokens.accessToken,
			refresh_token: tokens.refreshToken ?? integration.refresh_token,
			auth_expires_at: tokens.expiresAt,
		});
		return tokens.accessToken;
	} catch (error: any) {
		logger.warn('[ZktOAuth] refresh failed, marking integration revoked', {
			integrationId: integration.id,
		});
		// The refresh token is dead: rotation means a replay also lands here. Mark
		// it so the UI can offer a reconnect instead of retrying forever.
		await updateIntegration(integration, {revoked_at: new Date()}).catch(() => undefined);
		return null;
	}
}
