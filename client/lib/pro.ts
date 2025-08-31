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

/**
 * Check if user has Pro status
 * Returns false when Pro features are disabled
 */
export function isPro(user?: UserAccount | PublicUserAccount): boolean {
	if (!isProEnabled()) {
		return false;
	}

	if (!user) {
		return false;
	}

	// Development: Enable Pro features for all users when enabled
	if (process.env.NODE_ENV !== 'production' || (typeof window !== 'undefined' && window.location.hostname === 'localhost')) {
		return true;
	}

	return !!user.is_pro;
}

/**
 * Check if user does NOT have Pro status
 * Returns true when Pro features are disabled
 */
export function isNotPro(user?: UserAccount | PublicUserAccount): boolean {
	return !isPro(user);
}

/**
 * Check if user is logged in AND has Pro status
 * Returns false when Pro features are disabled
 */
export function isLoggedInAndPro(user?: UserAccount): boolean {
	if (!isProEnabled()) {
		return false;
	}

	if (!user) {
		return false;
	}

	// Development: Enable Pro features for all logged in users when enabled
	if (process.env.NODE_ENV !== 'production' || (typeof window !== 'undefined' && window.location.hostname === 'localhost')) {
		return true;
	}

	return user.is_pro;
}

/**
 * Check if user is logged in and does NOT have Pro status
 * Returns true when Pro features are disabled
 */
export function isLoggedInAndNotPro(user?: UserAccount): boolean {
	if (!isProEnabled()) {
		return true;
	}

	if (!user) {
		return true;
	}

	return !user.is_pro;
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
