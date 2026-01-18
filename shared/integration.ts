import { resourceUri } from '../client/util/storage';

export type IntegrationType = 'wca';

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
		clientId: 'wY1dbmwDjPLkRtZVzLJXAcIGWkap1QNbVnuK-ulkDSY', // Updated to match .docker.env
		responseType: 'code',
		scope: ['public'],
	},
};
