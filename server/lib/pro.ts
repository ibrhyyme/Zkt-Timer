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
 * PRO sistemi kaldırıldı - herkes otomatik PRO
 */
export function isPro(user?: InternalUserAccount): boolean {
	// PRO sistemi kaldırıldı - herkes otomatik PRO
	return true;
}

/**
 * Check if user does NOT have Pro status
 * PRO sistemi kaldırıldı - kimse NOT-PRO değil
 */
export function isNotPro(user?: InternalUserAccount): boolean {
	// PRO sistemi kaldırıldı - kimse NOT-PRO değil
	return false;
}

/**
 * Check if user is logged in AND has Pro status
 * PRO sistemi kaldırıldı - giriş yapan herkes PRO
 */
export function isLoggedInAndPro(user?: InternalUserAccount): boolean {
	// Kullanıcı giriş yapmışsa PRO
	return !!user;
}

/**
 * Check if user is logged in and does NOT have Pro status
 * PRO sistemi kaldırıldı - kimse NOT-PRO değil
 */
export function isLoggedInAndNotPro(user?: InternalUserAccount): boolean {
	// PRO sistemi kaldırıldı - kimse NOT-PRO değil
	return false;
}
