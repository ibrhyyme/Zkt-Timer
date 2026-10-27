import {watchMatchesRecord, WatchRule, RecordCandidate} from '../record_radar_match';
import {COUNTRY_TO_CONTINENT} from '../../../shared/wca_geo';

// Sanity: the test countries map to the continents these cases assume.
describe('wca_geo continent mapping (test assumptions)', () => {
	it('TR and DE are Europe, JP is Asia', () => {
		expect(COUNTRY_TO_CONTINENT.TR).toBe('_Europe');
		expect(COUNTRY_TO_CONTINENT.DE).toBe('_Europe');
		expect(COUNTRY_TO_CONTINENT.JP).toBe('_Asia');
	});
});

const rec = (tag: string, country?: string, eventId = '333'): RecordCandidate => ({
	eventId,
	tag,
	personCountryIso2: country,
});

describe('watchMatchesRecord — WR scope', () => {
	const wr: WatchRule = {events: ['333'], scope: 'WR', region: ''};

	it('matches a world record in the watched event, any country', () => {
		expect(watchMatchesRecord(wr, rec('WR', 'DE'))).toBe(true);
		expect(watchMatchesRecord(wr, rec('WR', undefined))).toBe(true);
	});
	it('does not match CR/NR (they are not world records)', () => {
		expect(watchMatchesRecord(wr, rec('CR', 'DE'))).toBe(false);
		expect(watchMatchesRecord(wr, rec('NR', 'TR'))).toBe(false);
	});
	it('does not match a different event', () => {
		expect(watchMatchesRecord(wr, rec('WR', 'DE', '444'))).toBe(false);
	});
});

describe('watchMatchesRecord — NR scope (Turkey)', () => {
	const nrTr: WatchRule = {events: ['333'], scope: 'NR', region: 'TR'};

	it('matches a Turkish WR / CR / NR (higher tags count as NR too)', () => {
		expect(watchMatchesRecord(nrTr, rec('WR', 'TR'))).toBe(true);
		expect(watchMatchesRecord(nrTr, rec('CR', 'TR'))).toBe(true);
		expect(watchMatchesRecord(nrTr, rec('NR', 'TR'))).toBe(true);
	});
	it('does not match a foreign national record', () => {
		expect(watchMatchesRecord(nrTr, rec('NR', 'DE'))).toBe(false);
		expect(watchMatchesRecord(nrTr, rec('WR', 'DE'))).toBe(false);
	});
	it('does not match when country is unknown', () => {
		expect(watchMatchesRecord(nrTr, rec('WR', undefined))).toBe(false);
	});
	it('does not match a different event', () => {
		expect(watchMatchesRecord(nrTr, rec('WR', 'TR', '222'))).toBe(false);
	});
});

describe('watchMatchesRecord — CR scope (Europe)', () => {
	const crEu: WatchRule = {events: ['333'], scope: 'CR', region: '_Europe'};

	it('matches a WR/CR set by a European', () => {
		expect(watchMatchesRecord(crEu, rec('WR', 'DE'))).toBe(true);
		expect(watchMatchesRecord(crEu, rec('CR', 'TR'))).toBe(true);
	});
	it('does not match a national record (NR is not a CR)', () => {
		expect(watchMatchesRecord(crEu, rec('NR', 'DE'))).toBe(false);
	});
	it('does not match a WR/CR from another continent', () => {
		expect(watchMatchesRecord(crEu, rec('WR', 'JP'))).toBe(false);
	});
	it('does not match when country is unknown', () => {
		expect(watchMatchesRecord(crEu, rec('WR', undefined))).toBe(false);
	});
});
