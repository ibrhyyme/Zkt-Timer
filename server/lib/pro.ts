import {InternalUserAccount} from '../schemas/UserAccount.schema';

/**
 * Central Pro feature configuration for server-side
 * Set PRO_ENABLED=true in environment to enable Pro features
 */
export const isProEnabled = (): boolean => {
	return process.env.PRO_ENABLED === 'true';
};

/**
 * Check if user has Pro status
 * Returns false when Pro features are disabled
 */
export function isPro(user?: InternalUserAccount): boolean {
	if (!isProEnabled()) {
		return false;
	}

	if (!user) {
		return false;
	}

	// Development: Enable Pro features for all users when enabled
	if (process.env.NODE_ENV !== 'production') {
		return true;
	}

	return !!user.is_pro;
}

/**
 * Check if user does NOT have Pro status
 * Returns true when Pro features are disabled
 */
export function isNotPro(user?: InternalUserAccount): boolean {
	return !isPro(user);
}

/**
 * Check if user is logged in AND has Pro status
 * Returns false when Pro features are disabled
 */
export function isLoggedInAndPro(user?: InternalUserAccount): boolean {
	if (!isProEnabled()) {
		return false;
	}

	if (!user) {
		return false;
	}

	// Development: Enable Pro features for all logged in users when enabled
	if (process.env.NODE_ENV !== 'production') {
		return true;
	}

	return user.is_pro;
}

/**
 * Check if user is logged in and does NOT have Pro status
 * Returns true when Pro features are disabled
 */
export function isLoggedInAndNotPro(user?: InternalUserAccount): boolean {
	if (!isProEnabled()) {
		return true;
	}

	if (!user) {
		return true;
	}

	return !user.is_pro;
}
