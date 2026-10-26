import {Request, Response} from 'express';
import {logger} from '../services/logger';
import {checkRateLimit} from '../services/rate_limit';
import {extractIp} from '../util/request';

/**
 * Place search for the competitions page ("competitions near ...").
 *
 * The browser used to call nominatim.openstreetmap.org itself, which handed
 * OpenStreetMap the visitor's IP address with every search (and on the web it
 * never worked at all: the CSP does not allow that host). The search now goes
 * through here, so the only thing OpenStreetMap sees is our server and the
 * place name that was typed. Nothing about the visitor is forwarded: no IP, no
 * cookies, no headers of theirs.
 */
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
// Nominatim's usage policy asks for an identifying User-Agent.
const USER_AGENT = 'ZktTimer/1.0 (+https://zktimer.app)';
const FETCH_TIMEOUT_MS = 5000;
const MAX_QUERY = 120;

interface NominatimPlace {
	lat: string;
	lon: string;
	display_name: string;
}

export async function geocodeHandler(req: Request, res: Response) {
	const query = String(req.query.q || '').trim();
	if (query.length < 2 || query.length > MAX_QUERY) {
		res.status(400).json([]);
		return;
	}

	// Nominatim allows about one request a second for the whole server, so one
	// visitor must not be able to spend it for everyone.
	const rate = await checkRateLimit(`geocode:${extractIp(req)}`, 20, 600, {failOpen: true});
	if (!rate.allowed) {
		res.status(429).json([]);
		return;
	}

	try {
		const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=json&limit=5`;
		const upstream = await fetch(url, {
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			headers: {'User-Agent': USER_AGENT, Accept: 'application/json'},
		});
		if (!upstream.ok) {
			res.status(502).json([]);
			return;
		}
		const places = (await upstream.json()) as NominatimPlace[];
		// Only the three fields the page uses travel back.
		const slim = (Array.isArray(places) ? places : []).slice(0, 5).map((p) => ({
			lat: String(p.lat),
			lon: String(p.lon),
			display_name: String(p.display_name),
		}));
		res.setHeader('Cache-Control', 'private, max-age=3600');
		res.json(slim);
	} catch (e) {
		logger.warn('[Geocode] lookup failed', {error: e instanceof Error ? e.message : String(e)});
		res.status(502).json([]);
	}
}
