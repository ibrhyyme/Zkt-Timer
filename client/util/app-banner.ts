// Android browser visitors get a strip pointing at the Play app. iOS Safari already shows
// Apple's own Smart App Banner from the `apple-itunes-app` meta, and Chrome ignores the
// `google-play-app` meta, so Android had no prompt at all.

export const APP_BANNER_DISMISSED_KEY = 'zkt_app_banner_dismissed_at';
export const APP_BANNER_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

interface AppBannerContext {
	userAgent: string;
	native: boolean;
	standalone: boolean;
	dismissedAt: number | null;
	now: number;
}

export function shouldOfferAndroidApp(ctx: AppBannerContext): boolean {
	if (ctx.native || ctx.standalone) return false;
	if (!/Android/i.test(ctx.userAgent)) return false;
	if (ctx.dismissedAt !== null && ctx.now - ctx.dismissedAt < APP_BANNER_SNOOZE_MS) return false;
	return true;
}

export function parseDismissedAt(raw: string | null | undefined): number | null {
	if (!raw) return null;
	const n = parseInt(raw, 10);
	return Number.isFinite(n) ? n : null;
}
