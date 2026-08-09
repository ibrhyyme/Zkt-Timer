import {Request, Response} from 'express';
import {logger} from '../services/logger';

/**
 * Serves YouTube cover images for links shared in direct messages.
 *
 * This exists for one reason: privacy. Rendering `img.youtube.com` directly in a chat
 * would tell Google the reader's IP address and which video someone sent them, which
 * is a piece of a private conversation leaving the conversation. The messages screen
 * promises we do not do that, so the bytes come from here instead.
 *
 * It is not a general image proxy and must never become one. The only thing a caller
 * controls is an 11 character video id, and the address fetched is built here from a
 * constant host, so there is no request an attacker can aim anywhere.
 */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

// hqdefault is the only size YouTube guarantees for every video. maxresdefault is
// missing on older uploads and answers 404, which would show a broken card.
const SOURCE = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

const FETCH_TIMEOUT_MS = 5000;
// A cover image never changes, and the id is part of the path, so this can be cached
// hard. Without it every thread open would re-fetch the same picture.
const CACHE_SECONDS = 60 * 60 * 24 * 30;
// hqdefault is around 15 KB. Anything an order of magnitude past that is not the
// image we asked for.
const MAX_BYTES = 2 * 1024 * 1024;

export async function youtubeThumbnailHandler(req: Request, res: Response) {
	const id = String(req.params.id || '');

	if (!VIDEO_ID.test(id)) {
		res.status(400).end();
		return;
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

	try {
		const upstream = await fetch(SOURCE(id), {
			signal: controller.signal,
			// Never forward the caller's cookies or headers; this is our request, not theirs.
			headers: {Accept: 'image/jpeg,image/*'},
			redirect: 'follow',
		});

		if (!upstream.ok) {
			// A deleted or private video has no cover. The client hides the card.
			res.status(404).end();
			return;
		}

		const type = upstream.headers.get('content-type') || '';
		if (!type.startsWith('image/')) {
			logger.warn('[YouTubeThumb] upstream returned a non-image', {id, type});
			res.status(404).end();
			return;
		}

		const buffer = Buffer.from(await upstream.arrayBuffer());
		if (buffer.byteLength > MAX_BYTES) {
			logger.warn('[YouTubeThumb] upstream image too large', {id, bytes: buffer.byteLength});
			res.status(404).end();
			return;
		}

		res.setHeader('Content-Type', type);
		res.setHeader('Cache-Control', `public, max-age=${CACHE_SECONDS}, immutable`);
		// The bytes are a picture, never a document: stops any content-sniffing surprise.
		res.setHeader('X-Content-Type-Options', 'nosniff');
		res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
		res.end(buffer);
	} catch (e: any) {
		// Upstream being slow or unreachable is not an error worth alerting on; the
		// card simply does not appear and the link still works.
		res.status(404).end();
	} finally {
		clearTimeout(timer);
	}
}
