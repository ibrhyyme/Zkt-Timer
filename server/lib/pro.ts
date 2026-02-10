import {InternalUserAccount} from '../schemas/UserAccount.schema';

/**
 * Central Pro feature configuration for server-side
 * Set PRO_ENABLED=true in environment to enable Pro features
 */
export const isProEnabled = (): boolean => {
	return process.env.PRO_ENABLED === 'true';
};

export function isPro(user?: InternalUserAccount): boolean {
	return user?.is_pro ?? false;
}

export function isNotPro(user?: InternalUserAccount): boolean {
	return !user?.is_pro;
}

export function isLoggedInAndPro(user?: InternalUserAccount): boolean {
	return !!user && !!user.is_pro;
}

export function isLoggedInAndNotPro(user?: InternalUserAccount): boolean {
	return !!user && !user.is_pro;
}
