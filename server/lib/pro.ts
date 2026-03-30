import {InternalUserAccount} from '../schemas/UserAccount.schema';

/**
 * Central Pro feature configuration for server-side
 * Set PRO_ENABLED=true in environment to enable Pro features
 */
export const isProEnabled = (): boolean => {
	return process.env.PRO_ENABLED === 'true';
};

export function isPro(user?: InternalUserAccount): boolean {
	if (user?.pro_expires_at && new Date() > new Date(user.pro_expires_at)) return false;
	if (user?.premium_expires_at && new Date() > new Date(user.premium_expires_at)) return false;
	return user?.is_pro || user?.is_premium || false;
}

export function isNotPro(user?: InternalUserAccount): boolean {
	return !isPro(user);
}

export function isLoggedInAndPro(user?: InternalUserAccount): boolean {
	return !!user && isPro(user);
}

export function isLoggedInAndNotPro(user?: InternalUserAccount): boolean {
	return !!user && !isPro(user);
}

export function isPremium(user?: InternalUserAccount): boolean {
	if (user?.premium_expires_at && new Date() > new Date(user.premium_expires_at)) return false;
	return user?.is_premium ?? false;
}

export function isNotPremium(user?: InternalUserAccount): boolean {
	return !isPremium(user);
}

export function isLoggedInAndPremium(user?: InternalUserAccount): boolean {
	return !!user && isPremium(user);
}

export function isLoggedInAndNotPremium(user?: InternalUserAccount): boolean {
	return !!user && !isPremium(user);
}
