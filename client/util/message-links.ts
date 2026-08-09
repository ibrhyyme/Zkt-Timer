/**
 * Turning message text into links.
 *
 * Message bodies are stored and rendered as plain text, never as HTML, and that does
 * not change here: this splits a string into pieces and the renderer decides what to
 * do with each one. Nothing built here is ever fed to dangerouslySetInnerHTML, so a
 * message containing markup stays inert no matter what this function returns.
 */

export type MessageSegment = {type: 'text'; value: string} | {type: 'link'; href: string; label: string};

// Deliberately narrow: an explicit http(s) scheme, or a bare `www.` host. Matching
// every dotted word would turn "3.  Sonra U R U' R'" and file names into links.
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;

// Trailing punctuation almost always belongs to the sentence, not the address.
const TRAILING_JUNK = /[.,;:!?'"]+$/;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_PATH = /^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com']);

/**
 * Closing brackets are only stripped when nothing opened them, so a Wikipedia URL
 * ending in `(disambiguation)` survives while "(bak buraya: example.com)" does not
 * swallow the parenthesis that closes the sentence.
 */
function trimTrailing(raw: string): string {
	let out = raw.replace(TRAILING_JUNK, '');

	while (out.length > 0) {
		const last = out[out.length - 1];
		const open = last === ')' ? '(' : last === ']' ? '[' : null;
		if (!open) break;

		const opens = out.split(open).length - 1;
		const closes = out.split(last).length - 1;
		if (closes <= opens) break;

		out = out.slice(0, -1).replace(TRAILING_JUNK, '');
	}

	return out;
}

/**
 * The address to actually navigate to, or null if it is not one we will open.
 *
 * Only http and https survive. The match cannot start with anything else, but this is
 * checked rather than assumed: it is the single place standing between a message body
 * and a browser navigation, and it costs nothing to make that explicit.
 */
export function toSafeHref(raw: string): string | null {
	const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

	try {
		const url = new URL(candidate);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		// A real top level label, so "3.gunde" and "dosya.txt" are not offered as links.
		// Starts with a letter, which also lets punycode (xn--p1ai) through.
		if (!/\.[a-z][a-z0-9-]+$/i.test(url.hostname)) return null;
		return url.toString();
	} catch {
		return null;
	}
}

/** Splits a message body into plain runs and links, in order, losing nothing. */
export function parseMessageBody(body: string): MessageSegment[] {
	if (!body) return [];

	const segments: MessageSegment[] = [];
	let cursor = 0;

	URL_PATTERN.lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = URL_PATTERN.exec(body)) !== null) {
		const label = trimTrailing(match[0]);
		const href = label ? toSafeHref(label) : null;

		// Rewind so the punctuation that was trimmed off is still rendered as text.
		URL_PATTERN.lastIndex = match.index + (label.length || match[0].length);

		if (!href) continue;

		if (match.index > cursor) {
			segments.push({type: 'text', value: body.slice(cursor, match.index)});
		}
		segments.push({type: 'link', href, label});
		cursor = match.index + label.length;
	}

	if (cursor < body.length) {
		segments.push({type: 'text', value: body.slice(cursor)});
	}

	return segments;
}

/** The video id inside a YouTube address, or null for anything else. */
export function youtubeVideoId(href: string): string | null {
	try {
		const url = new URL(href);
		const host = url.hostname.replace(/^www\./i, '').toLowerCase();

		if (host === 'youtu.be') {
			const id = url.pathname.slice(1).split('/')[0];
			return YOUTUBE_ID.test(id) ? id : null;
		}

		if (!YOUTUBE_HOSTS.has(host)) return null;

		const v = url.searchParams.get('v');
		if (v && YOUTUBE_ID.test(v)) return v;

		const path = url.pathname.match(YOUTUBE_PATH);
		return path ? path[1] : null;
	} catch {
		return null;
	}
}

/**
 * The first YouTube video in a message, which is the only one that gets a card.
 * Showing one card per link would let a single message fill the whole thread.
 */
export function firstYoutubeVideo(segments: MessageSegment[]): {id: string; href: string} | null {
	for (const segment of segments) {
		if (segment.type !== 'link') continue;
		const id = youtubeVideoId(segment.href);
		if (id) return {id, href: segment.href};
	}
	return null;
}

/**
 * Cover image for a video, served by us rather than by Google.
 *
 * Pointing straight at img.youtube.com would hand Google the reader's IP address and
 * the id of a video someone sent them privately, which is a slice of the message
 * content leaving the conversation. The messages screen promises that does not
 * happen, so the image comes through our own host instead.
 */
export function youtubeThumbnail(id: string): string {
	return `/api/yt-thumb/${id}`;
}
