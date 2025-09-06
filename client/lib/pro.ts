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
 * PRO sistemi kaldırıldı - herkes otomatik PRO
 */
export function isPro(user?: UserAccount | PublicUserAccount): boolean {
	// PRO sistemi kaldırıldı - herkes otomatik PRO
	return true;
}

/**
 * Check if user does NOT have Pro status
 * PRO sistemi kaldırıldı - kimse NOT-PRO değil
 */
export function isNotPro(user?: UserAccount | PublicUserAccount): boolean {
	// PRO sistemi kaldırıldı - kimse NOT-PRO değil
	return false;
}

/**
 * Check if user is logged in AND has Pro status
 * PRO sistemi kaldırıldı - giriş yapan herkes PRO
 */
export function isLoggedInAndPro(user?: UserAccount): boolean {
	// Kullanıcı giriş yapmışsa PRO
	return !!user;
}

/**
 * Check if user is logged in and does NOT have Pro status
 * PRO sistemi kaldırıldı - kimse NOT-PRO değil
 */
export function isLoggedInAndNotPro(user?: UserAccount): boolean {
	// PRO sistemi kaldırıldı - kimse NOT-PRO değil
	return false;
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
