import { resourceUri } from '../client/util/storage';

export type IntegrationType = 'wca' | 'zkt';

export interface LinkedServiceData {
	id: string;
	name: string;
	description: string;
	logoSrc: string;
	clientId: string;
	authEndpoint: string;
	tokenEndpoint: string;
	meEndpoint: string;
	revokeEndpoint: string;
	responseType: string;
	scope: string[];
}

export const getWcaRedirectUri = () => {
	// Server-side only function, client should use window.location.origin + '/oauth/wca'
	if (typeof process === 'undefined') {
		return 'http://localhost:3000/oauth/wca';
	}
	return (process.env.BASE_URI_DEV || 'http://localhost:3000') + '/oauth/wca';
};

export const getWcaLoginRedirectUri = () => {
	if (typeof process === 'undefined') {
		return 'http://localhost:3000/oauth/wca/login';
	}
	return (process.env.BASE_URI_DEV || 'http://localhost:3000') + '/oauth/wca/login';
};

/**
 * Origin of the Zeka Kupu Turkiye federation, which is now an identity provider
 * as well as a data source. Env-aware default for the same reason
 * ZktFederationService has one: local dev talks to the federation on port 4000.
 */
export const getZktOrigin = (): string => {
	// No `typeof process` guard on purpose: both names are inlined as string
	// literals by esbuild (see esbuild.js define), so nothing named `process`
	// survives into the browser bundle. A guard here would instead make the
	// browser silently fall back to the production origin while running against
	// a local federation.
	const configured = process.env.ZKT_FEDERATION_ORIGIN;
	if (configured) return configured.replace(/\/+$/, '');
	return process.env.NODE_ENV === 'production'
		? 'https://zekakuputurkiye.com'
		: 'http://localhost:4000';
};

export const getZktRedirectUri = () => {
	if (typeof process === 'undefined') {
		return 'http://localhost:3000/oauth/zkt';
	}
	return (process.env.BASE_URI_DEV || 'http://localhost:3000') + '/oauth/zkt';
};

export const getZktLoginRedirectUri = () => {
	if (typeof process === 'undefined') {
		return 'http://localhost:3000/oauth/zkt/login';
	}
	return (process.env.BASE_URI_DEV || 'http://localhost:3000') + '/oauth/zkt/login';
};

export const LINKED_SERVICES: Record<IntegrationType, LinkedServiceData> = {
	wca: {
		id: 'wca',
		name: 'WCA',
		description: 'WCA hesabınızı ekleyerek ve resmi derecelerinizi göstererek güvenilirliği artırın.',
		logoSrc: resourceUri('/images/logos/wca_logo.svg'),
		tokenEndpoint: 'https://www.worldcubeassociation.org/oauth/token',
		revokeEndpoint: 'https://www.worldcubeassociation.org/oauth/revoke',
		authEndpoint: 'https://www.worldcubeassociation.org/oauth/authorize',
		meEndpoint: 'https://www.worldcubeassociation.org/api/v0/me',
		clientId: process.env.WCA_CLIENT_ID || '',
		responseType: 'code',
		scope: ['public', 'email'],
	},
	// The federation's own OAuth. Members sign in with the ZKT account they
	// already use to enter competitions, and Zkt Timer learns their ZKT ID —
	// which is what its competition surfaces are keyed on now that WCA is no
	// longer the shared identity between the two sites.
	zkt: {
		id: 'zkt',
		name: 'Zeka Küpü Türkiye',
		description:
			'ZKT hesabını bağlayarak ZKT yarışmalarını, derecelerini ve rekorlarını Zkt Timer içinde gör.',
		// PNG, not SVG: an <img> pointing at an external SVG does not render in the
		// native shell (see the WCA logo's history), and 160px is plenty for the
		// 48px slots this appears in.
		logoSrc: resourceUri('/images/logos/zkt_logo.png'),
		// Trailing slashes are load-bearing: the federation runs Next.js with
		// `trailingSlash: true`, so a slash-less POST is answered with a 308 to the
		// canonical form. That works only because axios follows redirects and Node
		// preserves the body on 308; any client that does not would silently send
		// an empty token request. Ask for the canonical URL in the first place.
		authEndpoint: `${getZktOrigin()}/oauth/authorize/`,
		tokenEndpoint: `${getZktOrigin()}/api/oauth/token/`,
		meEndpoint: `${getZktOrigin()}/api/oauth/userinfo/`,
		revokeEndpoint: `${getZktOrigin()}/api/oauth/revoke/`,
		clientId: process.env.ZKT_CLIENT_ID || 'zkt-timer',
		responseType: 'code',
		scope: ['profile', 'email'],
	},
};
