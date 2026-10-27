import CompetitionGroupsPublishedNotification from '../competition_groups_published';
import CompetitionScheduleChangedNotification from '../competition_schedule_changed';
import CompetitionResultsOfficialNotification from '../competition_results_official';
import {buildZktAnnouncementText, ZktAnnouncementStage} from '../zkt_competition_announced';
import {lifecycleCompetitionPath, lifecyclePersonPath} from '../competition_lifecycle_base';
import {NotificationType} from '../../../@types/enums';
import {TimelineEntry} from '../../../services/CompetitionLifecycle';

// Everything but send() is pure; send() is never called here.
const stubInput: any = {user: {id: 'u1'}, triggeringUser: {id: 'u1'}, sendEmail: false};
const LOCALES = ['tr', 'en', 'es', 'ru', 'zh'];

function entry(activityCode: string, assignmentCode: string, start: string): TimelineEntry {
	return {key: `${activityCode}|${assignmentCode}`, activityCode, assignmentCode, name: null, start, end: start};
}

function meta(over: any = {}) {
	return {
		source: 'wca' as const,
		competitionId: 'TestComp2026',
		competitionName: 'Test Comp 2026',
		registrantId: 7,
		timezone: 'Europe/Istanbul',
		locale: 'tr',
		...over,
	};
}

const summary = {
	competing: [entry('333-r1-g2', 'competitor', '2026-11-07T07:30:00Z')],
	duties: {judge: 2, scrambler: 1, runner: 0, other: 0},
};

const diff = {
	changed: [
		{
			before: entry('333-r1-g2', 'competitor', '2026-11-07T07:30:00Z'),
			after: entry('333-r1-g2', 'competitor', '2026-11-07T08:00:00Z'),
		},
		{
			before: entry('222-r1-g1', 'staff-judge', '2026-11-07T09:00:00Z'),
			after: entry('222-r1-g1', 'staff-judge', '2026-11-07T09:30:00Z'),
		},
	],
	added: [],
	removed: [],
};

function all(locale: string, source: 'wca' | 'zkt' = 'wca') {
	const competitionId = source === 'zkt' ? 'zkt-ornek-yarisma' : 'TestComp2026';
	const m = meta({locale, source, competitionId});
	return [
		new CompetitionGroupsPublishedNotification(stubInput, {...m, summary}),
		new CompetitionScheduleChangedNotification(stubInput, {...m, diff}),
		new CompetitionResultsOfficialNotification(stubInput, {...m, rankLines: [{eventId: '333', type: 'average', best: 1124, before: 45, after: 38}]}),
		new CompetitionResultsOfficialNotification(stubInput, {...m, pbs: [{eventId: '333fm', type: 'single', best: 28}]}),
		new CompetitionResultsOfficialNotification(stubInput, m),
	];
}

describe('competition lifecycle notifications', () => {
	it('never leaks a translation key, in any language', () => {
		for (const locale of LOCALES) {
			for (const n of [...all(locale, 'wca'), ...all(locale, 'zkt')]) {
				expect(n.subject()).not.toContain('my_schedule.');
				expect(n.inAppMessage()).not.toContain('my_schedule.');
				expect(n.subject()).toContain('Test Comp 2026');
			}
		}
	});

	it('reads naturally in Turkish', () => {
		const [groups, schedule, rank, pb, plain] = all('tr');
		expect(groups.subject()).toBe('Test Comp 2026: gruplar açıklandı');
		expect(groups.detail()).toBe('İlk grubun: 3x3 1. Tur Grup 2 (Cmt 10:30) · Hakemlik: 2 · Karıştırma: 1');
		expect(schedule.subject()).toBe('Test Comp 2026: programın değişti');
		expect(schedule.detail()).toBe('3x3 1. Tur Grup 2: Cmt 10:30 → Cmt 11:00 (+1 değişiklik daha)');
		expect(rank.detail()).toBe('3x3 ortalama: ülke sıralaman 45 → 38');
		expect(pb.detail()).toBe('Yeni kişisel rekorun resmileşti: FMC tekli 28');
		expect(plain.detail()).toBe('Sonuçların resmi kayıtlara işlendi.');
	});

	it('puts the duty in front of a staff assignment', () => {
		const n = new CompetitionScheduleChangedNotification(stubInput, {
			...meta({locale: 'en'}),
			diff: {changed: [diff.changed[1]], added: [], removed: []},
		});
		expect(n.detail()).toBe('Judge · 2x2 Round 1 Group 1: Sat 12:00 → Sat 12:30');
	});

	it('inbox text stands alone: the inbox row never shows the subject', () => {
		const [groups, schedule, rank] = all('tr');
		expect(rank.inAppMessage()).toBe('Test Comp 2026: sonuçlar resmileşti · 3x3 ortalama: ülke sıralaman 45 → 38');
		expect(schedule.inAppMessage().startsWith('Test Comp 2026: programın değişti · ')).toBe(true);
		expect(groups.message()).toBe(groups.inAppMessage());
	});

	it('uses the notification types that double as preference columns', () => {
		const [groups, schedule, rank] = all('en');
		expect(groups.notificationType()).toBe(NotificationType.COMPETITION_GROUPS_PUBLISHED);
		expect(schedule.notificationType()).toBe(NotificationType.COMPETITION_SCHEDULE_CHANGED);
		expect(rank.notificationType()).toBe(NotificationType.COMPETITION_RESULTS_OFFICIAL);
	});

	it('routes to the person page on the shared competition page', () => {
		const [wcaGroups, , wcaRank] = all('en', 'wca');
		expect(wcaGroups.relativeLink()).toBe('/competitions/TestComp2026/persons/7');
		expect(wcaRank.relativeLink()).toBe('/competitions/TestComp2026/persons/7/results');

		const [zktGroups, , zktRank] = all('en', 'zkt');
		expect(zktGroups.relativeLink()).toBe('/competitions/zkt-ornek-yarisma/persons/7');
		expect(zktRank.relativeLink()).toBe('/competitions/zkt-ornek-yarisma/persons/7');
		expect(zktGroups.categoryName()).toBe('ZKT');
		expect(wcaGroups.categoryName()).toBe('WCA');
	});

	it('push data is all strings and carries the relative link', () => {
		for (const n of all('en', 'zkt')) {
			const data = n.pushData();
			for (const value of Object.values(data)) expect(typeof value).toBe('string');
			expect(data.link.startsWith('/')).toBe(true);
		}
	});

	it('falls back to the competition page without a registrant id', () => {
		expect(lifecyclePersonPath('TestComp2026', null)).toBe('/competitions/TestComp2026');
		expect(lifecycleCompetitionPath('zkt-ornek')).toBe('/competitions/zkt-ornek');
	});

	it('groups without a competing slot still say something useful', () => {
		const n = new CompetitionGroupsPublishedNotification(stubInput, {
			...meta({locale: 'en'}),
			summary: {competing: [], duties: {judge: 0, scrambler: 0, runner: 0, other: 0}},
		});
		expect(n.detail()).toBe('Tap to see your groups and duties.');
	});
});

describe('buildZktAnnouncementText', () => {
	const stages: ZktAnnouncementStage[] = ['announced', 'announced_open', 'announced_no_date', 'reminder', 'opened'];
	const openAt = new Date('2026-10-12T17:00:00Z'); // 20:00 in Istanbul

	it('never leaks a translation key, in any language or stage', () => {
		for (const locale of LOCALES) {
			for (const stage of stages) {
				const {title, body} = buildZktAnnouncementText(locale, {stage, competitionName: 'ZKT Ankara', openAt, timezone: 'Europe/Istanbul'});
				expect(title).not.toContain('my_schedule.');
				expect(body).not.toContain('my_schedule.');
				expect(title).toContain('ZKT Ankara');
			}
		}
	});

	it('gives the opening in Istanbul time, without a Turkish suffix on the value', () => {
		const a = buildZktAnnouncementText('tr', {stage: 'announced', competitionName: 'ZKT Ankara', openAt, timezone: 'Europe/Istanbul'});
		expect(a.title).toBe('Yeni ZKT yarışması: ZKT Ankara');
		expect(a.body).toBe('Kayıt açılışı: 12 Ekim 20:00');
		const r = buildZktAnnouncementText('tr', {stage: 'reminder', competitionName: 'ZKT Ankara', openAt, timezone: null});
		expect(r.body).toBe('Kayıt açılışı: 20:00');
	});

	it('falls back to English for an unknown locale', () => {
		const a = buildZktAnnouncementText('de', {stage: 'opened', competitionName: 'ZKT Ankara', openAt, timezone: null});
		expect(a.title).toBe('ZKT Ankara: registration is open');
	});
});
