import {buildGoogleCalendarUrl, buildIcsCalendar, IcsEvent, safeFileName} from '../ics';

function makeEvent(overrides: Partial<IcsEvent> = {}): IcsEvent {
	return {
		uid: 'zkt-competition-abc@zktimer.app',
		summary: 'Bursa Yaz Yarismasi 2026',
		startDate: new Date('2026-09-01T00:00:00Z'),
		endDate: new Date('2026-09-02T00:00:00Z'),
		location: 'Nilufer Spor Salonu, Bursa',
		url: 'https://zktimer.app/zkt-competitions/bursayaz2026',
		...overrides,
	};
}

function lines(ics: string): string[] {
	return ics.split('\r\n');
}

describe('ics calendar writer', () => {
	it('writes an all-day range with an exclusive end date', () => {
		const out = lines(buildIcsCalendar('Cal', [makeEvent()]));

		// A competition running 1-2 September must not bleed into the 3rd, and the
		// last day must be included: DTEND is exclusive, so it reads 0903.
		expect(out).toContain('DTSTART;VALUE=DATE:20260901');
		expect(out).toContain('DTEND;VALUE=DATE:20260903');
	});

	it('covers a single-day competition', () => {
		const out = lines(
			buildIcsCalendar('Cal', [
				makeEvent({endDate: new Date('2026-09-01T00:00:00Z')}),
			])
		);

		expect(out).toContain('DTSTART;VALUE=DATE:20260901');
		expect(out).toContain('DTEND;VALUE=DATE:20260902');
	});

	it('escapes comma, semicolon, backslash and newline in TEXT values', () => {
		const out = buildIcsCalendar('Cal', [
			makeEvent({
				summary: 'Yarisma, 2026; A\\B',
				description: 'first\nsecond',
			}),
		]);

		expect(out).toContain('SUMMARY:Yarisma\\, 2026\\; A\\\\B');
		expect(out).toContain('DESCRIPTION:first\\nsecond');
	});

	it('folds long lines without splitting a UTF-8 character', () => {
		const summary = 'Cok Uzun Turkce Yarisma Ismi Ornegi Suguoc '.repeat(4) + 'Sampiyonasi';
		const out = buildIcsCalendar('Cal', [makeEvent({summary})]);

		for (const line of lines(out)) {
			expect(Buffer.from(line, 'utf8').length).toBeLessThanOrEqual(75);
		}

		// Unfolding (drop CRLF + one leading space) must give the original value back.
		const unfolded = out.replace(/\r\n /g, '');
		expect(unfolded).toContain(`SUMMARY:${summary}`);
	});

	it('keeps Turkish characters intact across a fold boundary', () => {
		const summary = 'ÇĞİÖŞÜçğıöşü '.repeat(8);
		const out = buildIcsCalendar('Cal', [makeEvent({summary})]);
		const unfolded = out.replace(/\r\n /g, '');

		expect(unfolded).toContain(`SUMMARY:${summary}`);
		expect(unfolded).not.toContain('�');
	});

	it('marks cancelled competitions so calendars strike them through', () => {
		const out = lines(buildIcsCalendar('Cal', [makeEvent({cancelled: true})]));
		expect(out).toContain('STATUS:CANCELLED');
	});

	it('omits optional properties that are not provided', () => {
		const out = buildIcsCalendar('Cal', [
			makeEvent({location: undefined, url: undefined, description: undefined}),
		]);

		expect(out).not.toContain('LOCATION:');
		expect(out).not.toContain('URL:');
		expect(out).not.toContain('DESCRIPTION:');
		expect(out).not.toContain('GEO:');
	});

	it('skips a GEO line when coordinates are not finite', () => {
		const out = buildIcsCalendar('Cal', [makeEvent({geo: {lat: NaN, lng: 29}})]);
		expect(out).not.toContain('GEO:');
	});

	it('terminates every line with CRLF, including the last one', () => {
		const out = buildIcsCalendar('Cal', [makeEvent()]);

		expect(out.endsWith('END:VCALENDAR\r\n')).toBe(true);
		expect(out.replace(/\r\n/g, '')).not.toContain('\n');
	});
});

describe('google calendar url', () => {
	it('uses the same exclusive end date as DTEND', () => {
		const url = buildGoogleCalendarUrl(makeEvent());
		const dates = new URL(url).searchParams.get('dates');

		expect(dates).toBe('20260901/20260903');
	});

	it('carries name and location through', () => {
		const params = new URL(buildGoogleCalendarUrl(makeEvent())).searchParams;

		expect(params.get('action')).toBe('TEMPLATE');
		expect(params.get('text')).toBe('Bursa Yaz Yarismasi 2026');
		expect(params.get('location')).toBe('Nilufer Spor Salonu, Bursa');
	});
});

describe('safeFileName', () => {
	it('strips characters Windows and macOS reject', () => {
		// The colon/slash/question mark go away; the remaining space becomes a dash.
		expect(safeFileName('Bursa: Yaz/Yarisma?2026')).toBe('Bursa-YazYarisma2026');
	});

	it('falls back when nothing usable is left', () => {
		expect(safeFileName('///')).toBe('competition');
	});
});
