import {buildGoogleCalendarUrl, buildIcsCalendar, IcsEvent, safeFileName} from '../services/ics';
import {WcaApiService} from '../services/WcaApiService';
import {ZktFederationService} from '../services/ZktFederationService';
import {isZktCompetitionId, zktSlugOf} from '../services/ZktWcaAdapter';
import {createI18nInstance} from '../i18n_server';
import {createRedisKey, fetchDataFromCache, RedisNamespace} from '../services/redis';
import {logger} from '../services/logger';

const SUPPORTED_LANGS = ['tr', 'en', 'es', 'ru', 'zh'];
const DEFAULT_LANG = 'tr';

// One i18n instance per language, built on first use. The calendar export reads
// a single string; spinning up a fresh instance per request would be wasteful.
const translatorCache = new Map<string, (key: string, opts?: any) => string>();

function translator(lang: string) {
	const lng = SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
	let translate = translatorCache.get(lng);
	if (!translate) {
		const instance = createI18nInstance(lng);
		translate = (key: string, opts?: any) => instance.t(key, opts) as string;
		translatorCache.set(lng, translate);
	}
	return translate;
}

function readLang(req: any): string {
	// i18next hands out region-tagged codes on some browsers (en-US, tr-TR), so
	// match on the base language or the description falls back to Turkish.
	const raw = String(req.query?.lang || '').toLowerCase().split('-')[0];
	return SUPPORTED_LANGS.includes(raw) ? raw : DEFAULT_LANG;
}

/**
 * Absolute URL for links written into the calendar entry. Behind nginx the Host
 * header is the internal one, so production is pinned to the public domain and
 * only local development falls back to the request host.
 */
function publicBaseUrl(req: any): string {
	if (process.env.PUBLIC_BASE_URL) {
		return process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
	}
	if (process.env.NODE_ENV === 'production') {
		return 'https://zktimer.app';
	}
	const host = req.get?.('host') || 'localhost:3000';
	return `${req.protocol || 'http'}://${host}`;
}

/** Both ZKT slugs/UUIDs and WCA competition ids are plain identifiers. */
function isValidId(id: string): boolean {
	return typeof id === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(id);
}

/**
 * `@db.Date` columns and WCA's "YYYY-MM-DD" strings both land on UTC midnight,
 * which is what the DATE-value writer expects.
 */
function toDate(value: any): Date | null {
	if (!value) return null;
	const date =
		value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
	return isNaN(date.getTime()) ? null : date;
}

/** Inverse of toDate: the calendar day as "YYYY-MM-DD", read in UTC. */
function isoDay(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function sendIcs(res: any, name: string, event: IcsEvent) {
	const body = buildIcsCalendar(name, [event]);
	const safe = safeFileName(name);
	const ascii = safe.replace(/[^\x20-\x7e]/g, '') || 'competition';
	const encoded = encodeURIComponent(safe);

	res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
	res.setHeader(
		'Content-Disposition',
		`attachment; filename="${ascii}.ics"; filename*=UTF-8''${encoded}.ics`
	);
	// Public data, no auth involved, so it is safe for edge caching. An hour is short
	// enough that a corrected date reaches anyone who downloads it again.
	res.setHeader('Cache-Control', 'public, max-age=3600');
	res.send(body);
}

/**
 * Federation (zekakuputurkiye) competitions ride the WCA competition route as
 * `zkt-<slug>`, so they land on the same endpoint and are split off by prefix.
 */
async function loadFederationEvent(
	req: any,
	competitionId: string
): Promise<{event: IcsEvent; name: string} | null> {
	const detail = (await ZktFederationService.fetchCompetitionDetail(
		zktSlugOf(competitionId)
	)) as any;

	if (!detail || !detail.name) return null;
	if (detail.status === 'DRAFT' || detail.status === 'CONFIRMED') return null;

	const start = toDate(detail.startDate);
	const end = toDate(detail.endDate) || start;
	if (!start || !end) return null;

	const t = translator(readLang(req));
	const url = `${publicBaseUrl(req)}/competitions/${competitionId}`;

	return {
		name: detail.name,
		event: {
			uid: `zkt-federation-${detail.id || zktSlugOf(competitionId)}@zktimer.app`,
			summary: detail.name,
			startDate: start,
			endDate: end,
			location:
				[detail.location, detail.locationAddress].filter(Boolean).join(', ') || undefined,
			description: `${t('add_to_calendar.event_description')}\n${url}`,
			url,
			geo:
				typeof detail.latitude === 'number' && typeof detail.longitude === 'number'
					? {lat: detail.latitude, lng: detail.longitude}
					: undefined,
			cancelled: detail.status === 'CANCELLED',
		},
	};
}

/**
 * One competition, whichever federation owns it. WCA competitions come from the
 * WCA API (cached, so repeated adds cost nothing); Zeka Kupu Turkiye competitions
 * are addressed as `zkt-<slug>`, exactly as the competition page addresses them,
 * and are read from the federation API instead.
 */
async function loadCompetitionEvent(req: any, id: string): Promise<{event: IcsEvent; name: string} | null> {
	if (isZktCompetitionId(id)) {
		return loadFederationEvent(req, id);
	}

	const info = await fetchDataFromCache(
		createRedisKey(RedisNamespace.WCA_COMP_INFO, id),
		() => WcaApiService.fetchCompetitionInfo(id),
		60 * 60 * 6
	);

	if (!info || !info.id) return null;

	const start = toDate(info.start_date);
	const end = toDate(info.end_date) || start;
	if (!start || !end) return null;

	const t = translator(readLang(req));
	const url = `${publicBaseUrl(req)}/competitions/${info.id}`;
	const location = [info.venue_address, info.city].filter(Boolean).join(', ');

	return {
		name: info.name || info.id,
		event: {
			uid: `wca-competition-${info.id}@zktimer.app`,
			summary: info.name || info.id,
			startDate: start,
			endDate: end,
			location: location || info.venue || undefined,
			description: `${t('add_to_calendar.event_description')}\n${url}`,
			url,
			geo:
				typeof info.latitude_degrees === 'number' && typeof info.longitude_degrees === 'number'
					? {lat: info.latitude_degrees, lng: info.longitude_degrees}
					: undefined,
			cancelled: Boolean(info.cancelled_at),
		},
	};
}

type CalendarLoader = (req: any, id: string) => Promise<{event: IcsEvent; name: string} | null>;

function register(path: string, loader: CalendarLoader) {
	global.app.get(`${path}.ics`, async (req, res) => {
		const id = String(req.params.id || '');
		if (!isValidId(id)) {
			res.status(400).end();
			return;
		}
		try {
			const loaded = await loader(req, id);
			if (!loaded) {
				res.status(404).end();
				return;
			}
			sendIcs(res, loaded.name, loaded.event);
		} catch (e) {
			logger.warn('Calendar export failed', {path, id, error: e?.message});
			res.status(502).end();
		}
	});

	// Plain event fields for the native calendar plugin. The plugin writes into the
	// phone's own calendar, so it needs the values, not a file: dates stay as a
	// plain calendar day because each platform anchors an all-day event
	// differently, and only the platform knows which anchor its calendar wants.
	global.app.get(`${path}/meta`, async (req, res) => {
		const id = String(req.params.id || '');
		if (!isValidId(id)) {
			res.status(400).end();
			return;
		}
		try {
			const loaded = await loader(req, id);
			if (!loaded) {
				res.status(404).end();
				return;
			}
			const {event} = loaded;

			// This route is fetched by XHR from the native shell, whose origin is
			// capacitor://localhost, while the browser fetches it from the site
			// origin. The global cors() middleware runs with credentials:true and
			// therefore echoes a per-origin Allow-Origin header, and the edge cache
			// rule ("cache everything for requests without a session cookie") does
			// not vary on Origin. A cached copy would hand one origin the other
			// origin's header and break CORS for hours.
			//
			// Two guards: never store it, and make the header origin-independent so
			// a cached copy could not poison anything even if it happened. The data
			// is public and carries no credentials.
			res.setHeader('Cache-Control', 'private, no-store');
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.removeHeader('Access-Control-Allow-Credentials');
			res.json({
				title: event.summary,
				startDate: isoDay(event.startDate),
				endDate: isoDay(event.endDate),
				location: event.location || '',
				notes: event.description || '',
				url: event.url || '',
				cancelled: Boolean(event.cancelled),
			});
		} catch (e) {
			logger.warn('Calendar meta failed', {path, id, error: e?.message});
			res.status(502).end();
		}
	});

	global.app.get(`${path}/google`, async (req, res) => {
		const id = String(req.params.id || '');
		if (!isValidId(id)) {
			res.status(400).end();
			return;
		}
		try {
			const loaded = await loader(req, id);
			if (!loaded) {
				res.status(404).end();
				return;
			}
			res.redirect(302, buildGoogleCalendarUrl(loaded.event));
		} catch (e) {
			logger.warn('Google calendar redirect failed', {path, id, error: e?.message});
			res.status(502).end();
		}
	});
}

/**
 * "Add to calendar" endpoints for the competition page. Everything served here
 * is already public competition data, so no auth is required.
 */
export function exposeCompetitionCalendars() {
	register('/calendar/competition/:id', loadCompetitionEvent);
}
