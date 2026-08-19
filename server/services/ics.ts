/**
 * Minimal RFC 5545 (iCalendar) writer.
 *
 * No dependency on purpose: the surface we need is a single all-day VEVENT per
 * competition, and every library in this space drags in a timezone database.
 * All-day events carry no time component, so there is no timezone to get wrong.
 */

export interface IcsEvent {
	/** Stable across regenerations. Changing it makes calendars drop and re-add the event. */
	uid: string;
	summary: string;
	/** Inclusive first day. DTSTART is written as a DATE value (no time, no timezone). */
	startDate: Date;
	/** Inclusive last day. DTEND is written exclusive (last day + 1) per the spec. */
	endDate: Date;
	description?: string;
	location?: string;
	url?: string;
	geo?: {lat: number; lng: number};
	cancelled?: boolean;
	/** Increment when the organizer edits the event so clients accept the update. */
	sequence?: number;
}

const CRLF = '\r\n';

/** TEXT values escape backslash, semicolon, comma and newline (RFC 5545 section 3.3.11). */
function escapeText(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r?\n/g, '\\n');
}

/**
 * Content lines are limited to 75 octets. Longer lines continue on the next line
 * prefixed with a single space. Folding counts octets, not characters, so a
 * Turkish name near the limit must not be split in the middle of a UTF-8
 * sequence, so split on the encoded buffer and cut only at byte boundaries.
 */
function foldLine(line: string): string {
	const bytes = Buffer.from(line, 'utf8');
	if (bytes.length <= 75) return line;

	const parts: string[] = [];
	let offset = 0;
	let limit = 75;

	while (offset < bytes.length) {
		let end = Math.min(offset + limit, bytes.length);
		// Walk back off a continuation byte (10xxxxxx) so we never split a character.
		while (end > offset && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
			end--;
		}
		parts.push(bytes.slice(offset, end).toString('utf8'));
		offset = end;
		limit = 74; // continuation lines lose one octet to the leading space
	}

	return parts.join(`${CRLF} `);
}

function pad(n: number): string {
	return n < 10 ? `0${n}` : String(n);
}

/** DATE value: YYYYMMDD, read in UTC because @db.Date columns land at midnight UTC. */
function formatDate(date: Date): string {
	return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

/** DATE-TIME value in UTC: YYYYMMDDTHHMMSSZ. */
function formatDateTime(date: Date): string {
	return (
		`${formatDate(date)}T` +
		`${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
	);
}

function addDays(date: Date, days: number): Date {
	const copy = new Date(date.getTime());
	copy.setUTCDate(copy.getUTCDate() + days);
	return copy;
}

function buildEvent(event: IcsEvent, stamp: Date): string[] {
	const lines: string[] = ['BEGIN:VEVENT'];

	lines.push(`UID:${escapeText(event.uid)}`);
	lines.push(`DTSTAMP:${formatDateTime(stamp)}`);
	lines.push(`DTSTART;VALUE=DATE:${formatDate(event.startDate)}`);
	lines.push(`DTEND;VALUE=DATE:${formatDate(addDays(event.endDate, 1))}`);
	lines.push(`SUMMARY:${escapeText(event.summary)}`);

	if (event.location) {
		lines.push(`LOCATION:${escapeText(event.location)}`);
	}
	if (event.description) {
		lines.push(`DESCRIPTION:${escapeText(event.description)}`);
	}
	if (event.url) {
		lines.push(`URL:${escapeText(event.url)}`);
	}
	if (event.geo && Number.isFinite(event.geo.lat) && Number.isFinite(event.geo.lng)) {
		lines.push(`GEO:${event.geo.lat.toFixed(6)};${event.geo.lng.toFixed(6)}`);
	}

	lines.push(`STATUS:${event.cancelled ? 'CANCELLED' : 'CONFIRMED'}`);
	lines.push('TRANSP:TRANSPARENT');
	lines.push(`SEQUENCE:${event.sequence ?? 0}`);
	lines.push('END:VEVENT');

	return lines;
}

/**
 * Serialize a calendar. `calendarName` shows up as the file/calendar label in
 * Apple Calendar and Outlook via the de-facto X-WR-CALNAME property.
 */
export function buildIcsCalendar(calendarName: string, events: IcsEvent[]): string {
	const stamp = new Date();

	const lines: string[] = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Zkt Timer//Competition Calendar//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${escapeText(calendarName)}`,
	];

	for (const event of events) {
		lines.push(...buildEvent(event, stamp));
	}

	lines.push('END:VCALENDAR');

	return lines.map(foldLine).join(CRLF) + CRLF;
}

/**
 * Google Calendar cannot import an .ics from a URL, so its users get a prefilled
 * "create event" screen instead. Dates are all-day and the end is exclusive,
 * same convention as DTEND.
 */
export function buildGoogleCalendarUrl(event: IcsEvent): string {
	const params = new URLSearchParams({
		action: 'TEMPLATE',
		text: event.summary,
		dates: `${formatDate(event.startDate)}/${formatDate(addDays(event.endDate, 1))}`,
	});

	if (event.description) params.set('details', event.description);
	if (event.location) params.set('location', event.location);

	return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Windows and macOS both choke on these in filenames; keep the name readable otherwise. */
export function safeFileName(name: string): string {
	return (
		name
			.replace(/[\\/:*?"<>|]/g, '')
			.replace(/\s+/g, '-')
			.slice(0, 80) || 'competition'
	);
}
