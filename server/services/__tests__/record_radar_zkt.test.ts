import {isZktCompActiveForRadar} from '../cron_wca_records';

// `to` = today+1, `from` = today-3 (the finalize tail). Fixed strings so the test
// does not drift with the clock.
const TO = '2026-09-10';
const FROM = '2026-09-06';
const WATCHED = new Set(['333', '444']);

const comp = (over: any = {}) => ({
	id: 'uuid',
	slug: 'ornek-yarisma',
	name: 'Ornek Yarisma',
	// The federation serialises dates with toISOString(), not as YYYY-MM-DD.
	startDate: '2026-09-08T00:00:00.000Z',
	endDate: '2026-09-09T00:00:00.000Z',
	status: 'ONGOING',
	eventIds: ['333'],
	...over,
});

describe('isZktCompActiveForRadar', () => {
	it('accepts a competition running right now', () => {
		expect(isZktCompActiveForRadar(comp(), TO, FROM, WATCHED)).toBe(true);
	});

	// Comparing "2026-09-09T00:00:00.000Z" >= "2026-09-06" as raw strings happens
	// to work, but "2026-09-08T..." <= "2026-09-10" does too and the reverse case
	// does not — the dates have to be sliced before comparing.
	it('compares only the date part of a full ISO timestamp', () => {
		const sameDay = comp({
			startDate: '2026-09-10T21:00:00.000Z',
			endDate: '2026-09-10T21:00:00.000Z',
		});
		expect(isZktCompActiveForRadar(sameDay, TO, FROM, WATCHED)).toBe(true);
	});

	// The radar must see a competition BEFORE it produces records, so first-sight
	// seeding happens against an empty set and the first real record still fires.
	it('picks up a competition that starts tomorrow', () => {
		const tomorrow = comp({startDate: '2026-09-10T00:00:00.000Z', endDate: '2026-09-10T00:00:00.000Z'});
		expect(isZktCompActiveForRadar(tomorrow, TO, FROM, WATCHED)).toBe(true);
	});

	it('rejects a competition that has not started yet', () => {
		const later = comp({startDate: '2026-09-12T00:00:00.000Z', endDate: '2026-09-13T00:00:00.000Z'});
		expect(isZktCompActiveForRadar(later, TO, FROM, WATCHED)).toBe(false);
	});

	// ZKT records are written when a round is FINISHED, and organizers routinely
	// finalize the last rounds the next morning. A ±1 day window would drop those.
	it('keeps scanning a competition that ended two days ago', () => {
		const ended = comp({startDate: '2026-09-06T00:00:00.000Z', endDate: '2026-09-07T00:00:00.000Z'});
		expect(isZktCompActiveForRadar(ended, TO, FROM, WATCHED)).toBe(true);
	});

	it('stops scanning once the finalize tail has passed', () => {
		const old = comp({startDate: '2026-09-01T00:00:00.000Z', endDate: '2026-09-04T00:00:00.000Z'});
		expect(isZktCompActiveForRadar(old, TO, FROM, WATCHED)).toBe(false);
	});

	it('skips a cancelled competition, which can never produce a record', () => {
		expect(isZktCompActiveForRadar(comp({status: 'CANCELLED'}), TO, FROM, WATCHED)).toBe(false);
		expect(isZktCompActiveForRadar(comp({status: 'cancelled'}), TO, FROM, WATCHED)).toBe(false);
	});

	it('skips a competition whose events nobody is watching', () => {
		expect(isZktCompActiveForRadar(comp({eventIds: ['555', 'pyram']}), TO, FROM, WATCHED)).toBe(false);
	});

	// 333ni is a ZKT-only event. RecordWatch validates against WCA event ids, so it
	// can never be watched and a 333ni-only competition is correctly skipped.
	it('skips a competition holding only non-WCA events', () => {
		expect(isZktCompActiveForRadar(comp({eventIds: ['333ni']}), TO, FROM, WATCHED)).toBe(false);
	});

	it('survives a malformed or empty item', () => {
		expect(isZktCompActiveForRadar(null, TO, FROM, WATCHED)).toBe(false);
		expect(isZktCompActiveForRadar(comp({startDate: null, endDate: null}), TO, FROM, WATCHED)).toBe(false);
		expect(isZktCompActiveForRadar(comp({eventIds: undefined}), TO, FROM, WATCHED)).toBe(false);
	});
});
