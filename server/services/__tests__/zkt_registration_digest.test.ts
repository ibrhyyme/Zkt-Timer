import {digestBody, groupFeedEvents, namesSummary, type ZktFeedEvent} from '../zkt_registration_digest';

const comp = (id: string, name: string) => ({id, slug: id, name});
const ev = (type: ZktFeedEvent['type'], competition: ZktFeedEvent['competition'], name: string): ZktFeedEvent => ({
	id: `${competition.id}-${name}-${type}`,
	at: '2026-10-19T12:00:00.000Z',
	type,
	competition,
	name,
});

describe('zkt registration digest', () => {
	const bursa = comp('bursa', 'Bursa Summer 2026');
	const ist = comp('ist', 'ZKT İstanbul Ağustos 2026');

	it('folds a burst into one digest per competition, in feed order', () => {
		const digests = groupFeedEvents([
			ev('registered', bursa, 'Ahmet'),
			ev('registered', ist, 'Zeynep'),
			ev('registered', bursa, 'Mehmet'),
			ev('withdrawn', bursa, 'Ali'),
		]);
		expect(digests.map((d) => d.competition.id)).toEqual(['bursa', 'ist']);
		expect(digests[0]).toEqual({competition: bursa, registered: ['Ahmet', 'Mehmet'], withdrawn: ['Ali']});
	});

	it('lists a person once even if they flip-flopped within one poll', () => {
		const [d] = groupFeedEvents([
			ev('registered', bursa, 'Perf Test'),
			ev('withdrawn', bursa, 'Perf Test'),
			ev('registered', bursa, 'Perf Test'),
			ev('withdrawn', bursa, 'Perf Test'),
		]);
		expect(digestBody(d)).toBe('Yeni kayıt: Perf Test. Kaydını çekti: Perf Test');
	});

	it('names at most three people and counts the rest', () => {
		expect(namesSummary(['A', 'B'])).toBe('A, B');
		expect(namesSummary(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C +2');
	});

	it('reads naturally for one, many, and mixed events', () => {
		expect(digestBody({competition: bursa, registered: ['Ahmet Yılmaz'], withdrawn: []})).toBe('Yeni kayıt: Ahmet Yılmaz');
		expect(digestBody({competition: bursa, registered: ['A', 'B', 'C', 'D', 'E'], withdrawn: []})).toBe(
			'5 yeni kayıt: A, B, C +2'
		);
		expect(digestBody({competition: bursa, registered: [], withdrawn: ['Ali Veli']})).toBe('Kaydını çekti: Ali Veli');
		expect(digestBody({competition: bursa, registered: ['A', 'B'], withdrawn: ['C', 'D']})).toBe(
			'2 yeni kayıt: A, B. 2 kişi kaydını çekti: C, D'
		);
	});
});
