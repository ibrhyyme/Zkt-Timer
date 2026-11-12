/**
 * KLIPY GIF API, called straight from the user's device.
 *
 * Why not through our server like YouTube search (/api/yt-thumb): KLIPY's integration
 * requirements say API requests and media loads "must originate from the user's mobile
 * app, desktop app, or web browser", and proxying needs their written approval. So this
 * module is the only place that talks to api.klipy.com, and media URLs are used exactly
 * as returned (no rewriting, no copies, nothing persisted).
 *
 * What KLIPY receives: the search text, the UI language as a coarse locale, and the
 * device's IP like any image load. No account id: `customer_id` is optional and is left
 * out on purpose (feedback: nothing about the user leaves for a third party unless the
 * feature needs it). The content filter is pinned to "high" (G only) here as well as in
 * the Partner Panel, because children use the app.
 */

import {GIF_PROVIDER_KLIPY} from '../../shared/gif';

const API_BASE = 'https://api.klipy.com/api/v1';
const PAGE_SIZE = 24;
// KLIPY's documented minimum for per_page is 8; a lookup batch above this is split.
const LOOKUP_BATCH = 24;
// Collects the GIFs of one rendered thread into a single items request.
const LOOKUP_DELAY_MS = 30;
// The test key allows 100 calls an hour, so reopening the picker must not refetch
// trending every time. Short enough that "trending" still means now.
const TRENDING_TTL_MS = 5 * 60 * 1000;

export interface GifItem {
	slug: string;
	title: string;
	/** Small rendition for the picker grid. */
	previewUrl: string;
	/** Medium rendition for a message bubble. */
	url: string;
	width: number;
	height: number;
	/** Tiny inline JPEG KLIPY ships for a placeholder, when present. */
	blur: string | null;
}

/** Minutes to show for a cooldown, rounded up so "0 minutes" never appears. */
export function gifWaitMinutes(seconds: number): number {
	return Math.max(1, Math.ceil(seconds / 60));
}

export interface GifPage {
	items: GifItem[];
	hasNext: boolean;
}

function apiKey(): string {
	return process.env.KLIPY_API_KEY || '';
}

/** False when the build has no key or this is SSR: the GIF button then does not render. */
export function isGifSearchAvailable(): boolean {
	return typeof window !== 'undefined' && Boolean(apiKey());
}

/**
 * KLIPY's locale is an ISO 3166 country code. The UI language is the only signal used:
 * no geolocation, and the five app languages map onto their main market.
 */
const LANGUAGE_TO_COUNTRY: Record<string, string> = {tr: 'tr', en: 'us', es: 'es', ru: 'ru', zh: 'cn'};

export function klipyLocale(language: string | undefined): string {
	const base = (language || 'tr').slice(0, 2).toLowerCase();
	return LANGUAGE_TO_COUNTRY[base] || 'tr';
}

function pickRendition(size: any): {url: string; width: number; height: number} | null {
	if (!size) return null;
	// webp first: a fraction of the gif's weight for the same frames.
	const file = size.webp?.url ? size.webp : size.gif;
	if (!file?.url) return null;
	// Only webp carries no dimensions in some responses; the gif of the same size does.
	const width = Number(file.width || size.gif?.width || size.jpg?.width) || 0;
	const height = Number(file.height || size.gif?.height || size.jpg?.height) || 0;
	return {url: String(file.url), width, height};
}

/** Exported for tests. Returns null for anything that cannot be drawn. */
export function parseGifItem(raw: any): GifItem | null {
	if (!raw || typeof raw.slug !== 'string' || !raw.file) return null;
	const small = pickRendition(raw.file.sm) || pickRendition(raw.file.xs);
	const medium = pickRendition(raw.file.md) || small;
	if (!small || !medium) return null;

	const dims = medium.width && medium.height ? medium : small;
	return {
		slug: raw.slug,
		title: typeof raw.title === 'string' ? raw.title : '',
		previewUrl: small.url,
		url: medium.url,
		width: dims.width || 1,
		height: dims.height || 1,
		blur: typeof raw.blur_preview === 'string' && raw.blur_preview.startsWith('data:image/') ? raw.blur_preview : null,
	};
}

/** Exported for tests. Keeps KLIPY's order: their terms forbid reordering results. */
export function parseGifPage(json: any): GifPage {
	const data = json?.data;
	const list: any[] = Array.isArray(data?.data) ? data.data : [];
	return {
		items: list.map(parseGifItem).filter(Boolean) as GifItem[],
		hasNext: Boolean(data?.has_next),
	};
}

async function getJson(path: string, params: Record<string, string>): Promise<any> {
	const query = new URLSearchParams(params).toString();
	const res = await fetch(`${API_BASE}/${encodeURIComponent(apiKey())}/${path}?${query}`, {
		// No cookies, no referrer path: KLIPY gets the request and nothing else.
		credentials: 'omit',
		referrerPolicy: 'no-referrer',
	});
	if (!res.ok) throw new Error(`KLIPY ${res.status}`);
	return res.json();
}

function listParams(page: number, language: string): Record<string, string> {
	return {
		page: String(page),
		per_page: String(PAGE_SIZE),
		locale: klipyLocale(language),
		content_filter: 'high',
		format_filter: 'webp,gif,jpg',
	};
}

let trendingCache: {at: number; language: string; page: GifPage} | null = null;

export async function fetchTrendingGifs(page: number, language: string): Promise<GifPage> {
	const cacheable = page === 1;
	if (
		cacheable &&
		trendingCache &&
		trendingCache.language === language &&
		Date.now() - trendingCache.at < TRENDING_TTL_MS
	) {
		return trendingCache.page;
	}

	const result = parseGifPage(await getJson('gifs/trending', listParams(page, language)));
	if (cacheable) trendingCache = {at: Date.now(), language, page: result};
	return result;
}

export async function searchGifs(q: string, page: number, language: string): Promise<GifPage> {
	return parseGifPage(await getJson('gifs/search', {...listParams(page, language), q}));
}

/**
 * Tells KLIPY a GIF was sent, which their ranking uses. Fire and forget: a failure here
 * must never hold up or fail the message itself.
 */
export function reportGifShare(slug: string, q: string): void {
	if (!isGifSearchAvailable()) return;
	const body = q ? JSON.stringify({q}) : '{}';
	void fetch(`${API_BASE}/${encodeURIComponent(apiKey())}/gifs/share/${encodeURIComponent(slug)}`, {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body,
		credentials: 'omit',
		referrerPolicy: 'no-referrer',
	}).catch(() => {});
}

// ---------------------------------------------------------------------------
// Resolving stored ids back to media, batched.
//
// A thread can hold a dozen GIFs; one items request for all of them instead of a
// dozen keeps the test key's hourly budget and the reader's battery. Results live in
// memory for this page load only, which is rendering, not storage: nothing is written
// to disk, and a reload asks KLIPY again so a GIF they removed disappears.
// ---------------------------------------------------------------------------

/**
 * Pairs each requested slug with the item KLIPY returned for it. Exported for tests.
 *
 * Search and trending hand out slugs with a suffix ("rubik-cube-1980s--kOxbjG4Q5"),
 * while the items endpoint answers with the bare one ("rubik-cube-1980s"). Measured on
 * 2026-11-12; the docs do not mention it. So an exact match is tried first, then the
 * bare slug the stored one starts with.
 */
export function matchLookups(requested: string[], items: GifItem[]): Map<string, GifItem> {
	const bySlug = new Map(items.map((item) => [item.slug, item]));
	const matched = new Map<string, GifItem>();
	for (const slug of requested) {
		const exact = bySlug.get(slug);
		if (exact) {
			matched.set(slug, exact);
			continue;
		}
		// Longest bare slug wins, so "cube" never claims "cube-win--x" over "cube-win".
		let best: GifItem | null = null;
		for (const item of items) {
			if (slug.startsWith(`${item.slug}-`) && (!best || item.slug.length > best.slug.length)) {
				best = item;
			}
		}
		if (best) matched.set(slug, best);
	}
	return matched;
}

const lookups = new Map<string, Promise<GifItem | null>>();
let pending: Map<string, (item: GifItem | null) => void> | null = null;

async function flushLookups(batch: Map<string, (item: GifItem | null) => void>) {
	const slugs = Array.from(batch.keys());
	for (let i = 0; i < slugs.length; i += LOOKUP_BATCH) {
		const chunk = slugs.slice(i, i + LOOKUP_BATCH);
		let found = new Map<string, GifItem>();
		try {
			const page = parseGifPage(await getJson('gifs/items', {slugs: chunk.join(',')}));
			found = matchLookups(chunk, page.items);
		} catch {
			// Leave them unresolved; drop the cache entries so a later render can retry.
			for (const slug of chunk) lookups.delete(slug);
		}
		for (const slug of chunk) batch.get(slug)?.(found.get(slug) || null);
	}
}

export function resolveGif(provider: string | null | undefined, slug: string): Promise<GifItem | null> {
	if (provider !== GIF_PROVIDER_KLIPY || !slug || !isGifSearchAvailable()) return Promise.resolve(null);

	const known = lookups.get(slug);
	if (known) return known;

	const promise = new Promise<GifItem | null>((resolve) => {
		if (!pending) {
			pending = new Map();
			setTimeout(() => {
				const batch = pending;
				pending = null;
				if (batch) void flushLookups(batch);
			}, LOOKUP_DELAY_MS);
		}
		pending.set(slug, resolve);
	});
	lookups.set(slug, promise);
	return promise;
}

/** A GIF just picked already has its media; seed it so the sender's bubble needs no lookup. */
export function rememberGif(item: GifItem): void {
	lookups.set(item.slug, Promise.resolve(item));
}
