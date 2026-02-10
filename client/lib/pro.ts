import {PublicUserAccount, UserAccount} from '../../server/schemas/UserAccount.schema';

/**
 * Central Pro feature configuration
 * Set PRO_ENABLED=true in environment to enable Pro features
 */
export const isProEnabled = (): boolean => {
	if (typeof process !== 'undefined' && process.env) {
		return process.env.PRO_ENABLED === 'true';
	}
	// Default to disabled
	return false;
};

export function isPro(user?: UserAccount | PublicUserAccount): boolean {
	return user?.is_pro ?? false;
}

export function isNotPro(user?: UserAccount | PublicUserAccount): boolean {
	return !user?.is_pro;
}

export function isLoggedInAndPro(user?: UserAccount): boolean {
	return !!user && !!user.is_pro;
}

export function isLoggedInAndNotPro(user?: UserAccount): boolean {
	return !!user && !user.is_pro;
}

/**
 * React hook for Pro status
 * Returns consistent Pro state for components
 */
export function usePro(user?: UserAccount | PublicUserAccount) {
	return {
		enabled: isProEnabled(),
		isPro: isPro(user),
		isNotPro: isNotPro(user)
	};
}
