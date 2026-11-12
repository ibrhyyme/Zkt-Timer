/**
 * GIF attachments in direct messages and room chat.
 *
 * A message stores only which provider the GIF came from and that provider's id for it,
 * never a media URL and never the media itself: KLIPY's terms forbid storing, mirroring
 * or rewriting their media, and the URLs they hand out carry delivery data that has to
 * stay intact. The reader's client resolves the id back to media when it renders.
 *
 * Shared because the server validates exactly what the client is allowed to send.
 */

export const GIF_PROVIDER_KLIPY = 'klipy';

export type GifProvider = typeof GIF_PROVIDER_KLIPY;

export const GIF_PROVIDERS: readonly string[] = [GIF_PROVIDER_KLIPY];

/**
 * KLIPY identifies an item for later lookup by its slug ("hello-hi-662"). The numeric
 * `id` in their responses is above 2^53, so it cannot survive a round trip through a
 * JavaScript number and is never used.
 *
 * The pattern is deliberately strict: whatever passes here ends up in a URL query on
 * every reader's device, so anything that is not a plain slug is refused.
 */
const KLIPY_SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/;

export function isValidGifRef(provider: unknown, gifId: unknown): boolean {
	if (typeof provider !== 'string' || typeof gifId !== 'string') return false;
	if (provider === GIF_PROVIDER_KLIPY) return KLIPY_SLUG_PATTERN.test(gifId);
	return false;
}
