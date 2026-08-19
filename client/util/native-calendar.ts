import {Capacitor, registerPlugin} from '@capacitor/core';
import {isNative} from './platform';
import {getApiBase} from './api-base';

/**
 * Adds a competition to the phone's own calendar app.
 *
 * The native side opens the system "new event" sheet (Android: an ACTION_INSERT
 * intent into whichever calendar app the phone uses; iOS: EKEventEditViewController)
 * so the event lands next to the user's birthdays and public holidays instead of
 * arriving as a downloaded file.
 *
 * Dates stay as "YYYY-MM-DD" strings all the way down: the two platforms anchor
 * an all-day event differently, so each one places it itself.
 */
export interface NativeCalendarEvent {
	title: string;
	startDate: string;
	endDate: string;
	location?: string;
	notes?: string;
	url?: string;
}

interface NativeCalendarNativePlugin {
	isAvailable(): Promise<{available: boolean}>;
	addEvent(event: NativeCalendarEvent): Promise<{saved?: boolean; opened?: boolean}>;
}

// Registered behind the native guard so the handle is null on web. This is not
// cosmetic: the competition page is server-rendered, so an unconditional
// registerPlugin at module scope would run inside Node on every server boot.
const NativeCalendar = isNative()
	? registerPlugin<NativeCalendarNativePlugin>('NativeCalendar')
	: null;

// An unregistered plugin normally rejects, but Capacitor's iOS bridge has a path
// where it logs and returns without settling the promise. Cap the probe so a
// hung bridge cannot freeze the button.
const PROBE_TIMEOUT_MS = 1500;
const META_TIMEOUT_MS = 8000;

/**
 * Cheap synchronous gate. Keeps the web path free of any probe or network call.
 *
 * Android: `isPluginAvailable` is reliable because the plugin is explicitly
 * registered in MainActivity (`registerPlugin(NativeCalendarPlugin.class)`).
 *
 * iOS: the plugin is registered in ZKTBridgeViewController's `capacitorDidLoad`.
 * Capacitor does NOT auto-discover app-target plugins and `isPluginAvailable` is
 * unreliable for them, so on iOS we gate on platform only and let the async
 * probe below be the real check.
 */
export function isNativeCalendarAvailable(): boolean {
	if (!isNative()) return false;
	if (Capacitor.getPlatform() === 'ios') return true;
	return Capacitor.isPluginAvailable('NativeCalendar');
}

/**
 * The real gate. An app binary built before this plugin existed has no bridge
 * entry, so the call rejects and the caller falls back to the web sheet.
 */
export async function probeNativeCalendar(): Promise<boolean> {
	if (!NativeCalendar) return false;

	try {
		const result = await Promise.race([
			NativeCalendar.isAvailable(),
			new Promise<null>((resolve) => setTimeout(() => resolve(null), PROBE_TIMEOUT_MS)),
		]);
		return result?.available === true;
	} catch (e) {
		// Old binary without the plugin. Expected, not an error worth logging.
		return false;
	}
}

export interface CompetitionCalendarMeta {
	title: string;
	startDate: string;
	endDate: string;
	location: string;
	notes: string;
	url: string;
	cancelled: boolean;
}

/** Event fields for a competition, from the same server loader the .ics uses. */
export async function fetchCompetitionCalendarMeta(
	competitionId: string,
	lang: string
): Promise<CompetitionCalendarMeta | null> {
	const url =
		`${getApiBase()}/calendar/competition/${encodeURIComponent(competitionId)}/meta` +
		`?lang=${encodeURIComponent(lang)}`;

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), META_TIMEOUT_MS);

	try {
		// Public data, and omitting credentials keeps the request out of the
		// credentialed-CORS class entirely.
		const res = await fetch(url, {credentials: 'omit', signal: controller.signal});
		if (!res.ok) {
			return null;
		}
		return (await res.json()) as CompetitionCalendarMeta;
	} catch (e) {
		// Offline, aborted, or CORS. The caller falls back to the web sheet.
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

export type NativeCalendarResult =
	| 'saved'
	| 'opened'
	| 'cancelled'
	| 'denied'
	| 'unavailable'
	| 'error';

/**
 * Opens the system event sheet.
 *
 * `saved` and `cancelled` come from iOS, which knows what the user chose.
 * Android can only report `opened`: ACTION_INSERT returns RESULT_CANCELED even
 * after a successful save, so claiming a save there would be a lie.
 */
export async function addCompetitionToNativeCalendar(
	meta: CompetitionCalendarMeta,
	cancelledPrefix: string
): Promise<NativeCalendarResult> {
	if (!NativeCalendar) return 'unavailable';

	// Neither an ACTION_INSERT extra nor an EKEvent has a "cancelled" field, so
	// the title is the only channel for it. The .ics path uses STATUS:CANCELLED.
	const title = meta.cancelled ? `${cancelledPrefix}: ${meta.title}` : meta.title;

	try {
		const result = await NativeCalendar.addEvent({
			title,
			startDate: meta.startDate,
			endDate: meta.endDate,
			location: meta.location || undefined,
			notes: meta.notes || undefined,
			url: meta.url || undefined,
		});

		if (result?.opened === true) return 'opened';
		return result?.saved === true ? 'saved' : 'cancelled';
	} catch (e: any) {
		const code: string = e?.code || '';
		const message: string = e?.message || '';

		if (code === 'UNIMPLEMENTED') {
			return 'unavailable';
		}
		if (message.includes('PERMISSION_DENIED')) {
			return 'denied';
		}
		if (message.includes('NO_CALENDAR_APP') || message.includes('NO_PRESENTER')) {
			return 'unavailable';
		}

		console.warn('[NativeCalendar] addEvent failed:', message || code);
		return 'error';
	}
}
