import {PublicUserAccount, UserAccount, UserAccountForAdmin} from '../../server/schemas/UserAccount.schema';

/**
 * Central Pro feature configuration
 * Set PRO_ENABLED=true in environment to enable Pro features
 * Note: esbuild replaces process.env.PRO_ENABLED at build time (see esbuild.js define)
 */
export const isProEnabled = (): boolean => {
	return process.env.PRO_ENABLED === 'true';
};

export function isPro(user?: UserAccount | PublicUserAccount | UserAccountForAdmin): boolean {
	return user?.is_pro || user?.is_premium || false;
}

export function isNotPro(user?: UserAccount | PublicUserAccount | UserAccountForAdmin): boolean {
	return !isPro(user);
}

export function isLoggedInAndPro(user?: UserAccount): boolean {
	return !!user && isPro(user);
}

export function isLoggedInAndNotPro(user?: UserAccount): boolean {
	return !!user && !isPro(user);
}

export function isPremium(user?: UserAccount | PublicUserAccount | UserAccountForAdmin): boolean {
	return user?.is_premium ?? false;
}

export function isNotPremium(user?: UserAccount | PublicUserAccount | UserAccountForAdmin): boolean {
	return !isPremium(user);
}

export function isLoggedInAndPremium(user?: UserAccount): boolean {
	return !!user && isPremium(user);
}

export function isLoggedInAndNotPremium(user?: UserAccount): boolean {
	return !!user && !isPremium(user);
}

/**
 * React hook for Pro status
 * Returns consistent Pro state for components
 */
export function usePro(user?: UserAccount | PublicUserAccount | UserAccountForAdmin) {
	return {
		enabled: isProEnabled(),
		isPro: isPro(user),
		isNotPro: isNotPro(user),
		isPremium: isPremium(user),
		isNotPremium: isNotPremium(user)
	};
}
