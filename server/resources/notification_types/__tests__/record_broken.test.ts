import RecordBrokenNotification, {RecordSource} from '../record_broken';
import {NotificationType} from '../../../@types/enums';

// subject/inAppMessage/link/categoryName are pure — only send() touches the DB,
// and it is never called here.
const stubInput: any = {user: {id: 'u1'}, triggeringUser: {id: 'u1'}, sendEmail: false};

function notif(source: RecordSource, over: any = {}) {
	return new RecordBrokenNotification(stubInput, {
		source,
		competitionId: source === 'ZKT' ? 'zkt-ornek-yarisma' : 'TestComp2026',
		competitionName: 'Ornek Yarisma',
		eventId: '333',
		eventName: '3x3',
		recordTag: 'NR',
		resultText: '6.42',
		personName: 'Ornek Yarismaci',
		roundNumber: 2,
		locale: 'tr',
		...over,
	});
}

describe('RecordBrokenNotification', () => {
	describe('source is spelled out in the visible text', () => {
		it('labels a ZKT record as a ZKT record (tr)', () => {
			const n = notif('ZKT');
			expect(n.subject()).toContain('ZKT Türkiye Rekoru');
			expect(n.inAppMessage()).toContain('ZKT Türkiye Rekoru');
		});

		it('labels a WCA national record as a WCA one (tr)', () => {
			const n = notif('WCA');
			expect(n.subject()).toContain('WCA Ülke Rekoru');
		});

		it('distinguishes the two in English too', () => {
			expect(notif('ZKT', {locale: 'en'}).subject()).toContain('ZKT Turkish Record');
			expect(notif('WCA', {locale: 'en'}).subject()).toContain('WCA National Record');
		});

		it('covers every WCA scope', () => {
			expect(notif('WCA', {recordTag: 'WR', locale: 'en'}).subject()).toContain('WCA World Record');
			expect(notif('WCA', {recordTag: 'CR', locale: 'en'}).subject()).toContain('WCA Continental Record');
		});

		// A missing key makes i18next echo the key back. Rendering
		// "Yeni my_schedule.record_label_zkt_wr" to a user is worse than the raw tag.
		it('falls back to the raw tag for a source/tag pair with no label', () => {
			const n = notif('ZKT', {recordTag: 'WR'});
			expect(n.subject()).not.toContain('my_schedule.');
			expect(n.subject()).toContain('WR');
		});

		it('never leaks a translation key into the body', () => {
			for (const locale of ['tr', 'en', 'es', 'ru', 'zh']) {
				for (const source of ['WCA', 'ZKT'] as RecordSource[]) {
					const n = notif(source, {locale});
					expect(n.subject()).not.toContain('my_schedule.');
					expect(n.inAppMessage()).not.toContain('my_schedule.');
				}
			}
		});
	});

	describe('routing', () => {
		// ZKT and WCA share the competition page; ZKT Live is its wca-live route.
		it('sends a ZKT record to the live round on the shared competition page', () => {
			expect(notif('ZKT').relativeLink()).toBe('/competitions/zkt-ornek-yarisma/wca-live/333/2');
		});

		it('leaves the WCA route untouched', () => {
			expect(notif('WCA').relativeLink()).toBe('/competitions/TestComp2026/wca-live/333/2');
		});

		// Push payloads carry relativeLink(), because the client hands an absolute
		// http link to the in-app browser instead of navigating in-app.
		it('keeps relativeLink origin-free while link() is absolute', () => {
			process.env.BASE_URI = 'https://example.test';
			const n = notif('ZKT');
			expect(n.relativeLink().startsWith('/')).toBe(true);
			expect(n.link()).toBe(`https://example.test${n.relativeLink()}`);
		});
	});

	describe('classification', () => {
		it('types and categorises each source separately', () => {
			expect(notif('ZKT').notificationType()).toBe(NotificationType.ZKT_RECORD_BROKEN);
			expect(notif('ZKT').categoryName()).toBe('ZKT');
			expect(notif('WCA').notificationType()).toBe(NotificationType.WCA_RECORD_BROKEN);
			expect(notif('WCA').categoryName()).toBe('WCA');
		});

		// The inbox maps the category string to a tone; it already accepts 'zkt'.
		it('keeps the category matchable by the inbox', () => {
			expect(notif('ZKT').categoryName().toLowerCase()).toContain('zkt');
		});

		it('records the source in customData for later consumers', () => {
			expect(notif('ZKT').customData()).toMatchObject({source: 'ZKT'});
		});
	});
});
