// Pure decision logic behind the competition lifecycle notifications:
// groups published, schedule changed, official results (WCA + ZKT, per
// registrant) and ZKT competition announcements (broadcast).
//
// No I/O here on purpose. The crons (cron_competition_lifecycle.ts,
// cron_zkt_announcements.ts) fetch and persist; everything that decides
// WHETHER and WHAT to send lives in this file so it can be tested without a
// database, Redis or the network.

import crypto from 'crypto';
import {flattenActivities, parseActivityCode, WcifData, WcifPerson, WcifVenue} from './WcifTransformer';

export type LifecycleSource = 'wca' | 'zkt';

// --- Timing knobs -----------------------------------------------------------

// A change has to sit still this long before it is announced. Organizers edit
// assignments and times in bursts (ZKT writes them one by one, there is no
// "publish" button); waiting for the burst to end turns ten edits into one push.
export const GROUPS_QUIET_MS = 20 * 60 * 1000;
export const SCHEDULE_QUIET_MS = 20 * 60 * 1000;

// WCA recomputes rankings some time after results are posted. A PB whose rank
// has not caught up yet holds the notification at most this long.
export const RANK_WAIT_MS = 36 * 60 * 60 * 1000;
export const RANK_RECHECK_MS = 2 * 60 * 60 * 1000;

// ZKT registration reminder: sent this long before the planned opening.
export const REGISTRATION_REMINDER_LEAD_MS = 60 * 60 * 1000;
// Past the opening by more than this, a reminder is pointless and is dropped.
export const REGISTRATION_REMINDER_GRACE_MS = 10 * 60 * 1000;

// Announcements go to every user, so they never land at night. The federation
// is Turkish, so its clock decides what "night" is.
export const ANNOUNCE_TIMEZONE = 'Europe/Istanbul';
export const ANNOUNCE_QUIET_START_HOUR = 23;
export const ANNOUNCE_QUIET_END_HOUR = 9;

const DAY_MS = 24 * 60 * 60 * 1000;

// --- WCIF helpers -----------------------------------------------------------

function venuesOf(wcif: WcifData | null | undefined): WcifVenue[] {
	const venues = wcif?.schedule?.venues;
	return Array.isArray(venues) ? venues.filter((v) => v && Array.isArray(v.rooms)) : [];
}

/** Accepted registrants only: the WCA status string, which the ZKT WCIF maps APPROVED onto. */
export function acceptedPersons(wcif: WcifData | null | undefined): WcifPerson[] {
	return (wcif?.persons || []).filter((p) => p?.registration?.status === 'accepted');
}

/** First venue's IANA timezone. Every competition we see has a single venue. */
export function wcifTimezone(wcif: any): string | null {
	const tz = wcif?.schedule?.venues?.[0]?.timezone;
	return typeof tz === 'string' && tz ? tz : null;
}

/** Start/end as UTC-midnight dates, the shape Prisma's @db.Date stores. */
export function wcifDates(wcif: any): {start: Date; end: Date} | null {
	const startStr = String(wcif?.schedule?.startDate || '').slice(0, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(startStr)) return null;
	const start = new Date(`${startStr}T00:00:00.000Z`);
	if (isNaN(start.getTime())) return null;
	const days = Math.max(1, Number(wcif?.schedule?.numberOfDays) || 1);
	return {start, end: new Date(start.getTime() + (days - 1) * DAY_MS)};
}

/** The federation's own competition status, carried in the ZKT WCIF extension. */
export function zktWcifStatus(wcif: any): string | null {
	const ext = (wcif?.extensions || []).find((e: any) => e?.id === 'org.zktimer.zktCompetition.v1');
	const status = ext?.data?.status;
	return typeof status === 'string' ? status : null;
}

export function wcifRegistrationOpenAt(wcif: any): Date | null {
	const raw = wcif?.registrationInfo?.openTime;
	if (!raw) return null;
	const d = new Date(raw);
	return isNaN(d.getTime()) ? null : d;
}

// --- Personal timeline ------------------------------------------------------

/**
 * `assigned`: the person's own groups and duties. `registered`: no groups yet,
 * so the rounds of the events they signed up for stand in for their schedule.
 */
export type TimelineKind = 'assigned' | 'registered';

export interface TimelineEntry {
	// Stable identity inside one person's timeline: activity + role, with an
	// occurrence suffix when the same pair repeats. Never the WCIF activity id,
	// which the federation is free to regenerate.
	key: string;
	activityCode: string;
	assignmentCode: string; // 'competitor' | 'staff-judge' | ... | 'registered'
	name: string | null;
	start: string | null;
	end: string | null;
}

export interface PersonTimeline {
	kind: TimelineKind;
	entries: TimelineEntry[];
}

function instant(iso: string | null | undefined): number | null {
	if (!iso) return null;
	const t = Date.parse(iso);
	return isNaN(t) ? null : t;
}

function withStableKeys(raw: Omit<TimelineEntry, 'key'>[]): TimelineEntry[] {
	const sorted = [...raw].sort(
		(a, b) =>
			(instant(a.start) ?? 0) - (instant(b.start) ?? 0) ||
			a.activityCode.localeCompare(b.activityCode) ||
			a.assignmentCode.localeCompare(b.assignmentCode)
	);
	const seen = new Map<string, number>();
	return sorted.map((e) => {
		const base = `${e.activityCode}|${e.assignmentCode}`;
		const n = (seen.get(base) || 0) + 1;
		seen.set(base, n);
		return {key: n === 1 ? base : `${base}#${n}`, ...e};
	});
}

export function buildPersonTimeline(wcif: WcifData, person: WcifPerson | null | undefined): PersonTimeline {
	const venues = venuesOf(wcif);
	const activityMap = flattenActivities(venues);

	const assigned: Omit<TimelineEntry, 'key'>[] = [];
	for (const a of person?.assignments || []) {
		const act = activityMap.get(a?.activityId);
		if (!act?.activityCode) continue;
		assigned.push({
			activityCode: act.activityCode,
			assignmentCode: a.assignmentCode || 'competitor',
			name: act.name || null,
			start: act.startTime || null,
			end: act.endTime || null,
		});
	}
	if (assigned.length > 0) {
		return {kind: 'assigned', entries: withStableKeys(assigned)};
	}

	// No groups yet: the rounds of every registered event. A round run in
	// parallel rooms appears once per room, so rooms are merged into one span.
	const eventIds = new Set(person?.registration?.eventIds || []);
	const byRound = new Map<string, Omit<TimelineEntry, 'key'>>();
	for (const venue of venues) {
		for (const room of venue.rooms || []) {
			for (const act of room.activities || []) {
				const parsed = parseActivityCode(act?.activityCode || '');
				if (!parsed.roundNumber || !eventIds.has(parsed.eventId)) continue;
				const code = `${parsed.eventId}-r${parsed.roundNumber}`;
				const prev = byRound.get(code);
				if (!prev) {
					byRound.set(code, {
						activityCode: code,
						assignmentCode: 'registered',
						name: act.name || null,
						start: act.startTime || null,
						end: act.endTime || null,
					});
					continue;
				}
				const s = instant(act.startTime);
				const e = instant(act.endTime);
				if (s != null && (instant(prev.start) == null || s < instant(prev.start)!)) prev.start = act.startTime;
				if (e != null && (instant(prev.end) == null || e > instant(prev.end)!)) prev.end = act.endTime;
			}
		}
	}
	return {kind: 'registered', entries: withStableKeys([...byRound.values()])};
}

function sha1(value: unknown): string {
	return crypto.createHash('sha1').update(JSON.stringify(value)).digest('hex');
}

/**
 * Hash of the times that matter for "your schedule changed": each entry's start.
 * End times are left out on purpose: an end-only edit is not worth a push.
 * Starts are hashed as epoch ms so a re-serialised timestamp ("Z" vs "+00:00")
 * is not a change.
 */
export function scheduleHash(timeline: PersonTimeline): string {
	return sha1([timeline.kind, timeline.entries.map((e) => [e.key, instant(e.start) ?? e.start])]);
}

/** Hash of which groups and duties a person has, times excluded. '' = no groups. */
export function groupsHash(timeline: PersonTimeline): string {
	if (timeline.kind !== 'assigned' || timeline.entries.length === 0) return '';
	return sha1(timeline.entries.map((e) => e.key).sort());
}

export interface TimelineChange {
	before: TimelineEntry;
	after: TimelineEntry;
}

export interface TimelineDiff {
	changed: TimelineChange[];
	added: TimelineEntry[];
	removed: TimelineEntry[];
}

/**
 * What changed for this person, ignoring anything already in the past: moving a
 * group that has finished is bookkeeping, not news.
 */
export function diffTimeline(before: PersonTimeline, after: PersonTimeline, now: Date): TimelineDiff {
	const nowMs = now.getTime();
	const isPast = (iso: string | null) => {
		const t = instant(iso);
		return t != null && t < nowMs;
	};
	const beforeMap = new Map(before.entries.map((e) => [e.key, e]));
	const afterMap = new Map(after.entries.map((e) => [e.key, e]));

	const changed: TimelineChange[] = [];
	const added: TimelineEntry[] = [];
	const removed: TimelineEntry[] = [];

	for (const [key, a] of afterMap) {
		const b = beforeMap.get(key);
		if (!b) {
			if (!isPast(a.start)) added.push(a);
			continue;
		}
		if (instant(b.start) === instant(a.start)) continue;
		if (isPast(b.start) && isPast(a.start)) continue;
		changed.push({before: b, after: a});
	}
	for (const [key, b] of beforeMap) {
		if (!afterMap.has(key) && !isPast(b.start)) removed.push(b);
	}

	const byStart = (x: TimelineEntry, y: TimelineEntry) => (instant(x.start) ?? 0) - (instant(y.start) ?? 0);
	changed.sort((x, y) => byStart(x.after, y.after));
	added.sort(byStart);
	removed.sort(byStart);
	return {changed, added, removed};
}

export function diffSize(diff: TimelineDiff): number {
	return diff.changed.length + diff.added.length + diff.removed.length;
}

/**
 * The part of a timeline diff worth a "your schedule changed" push.
 *
 * - An empty baseline means the schedule was just published: that is not a
 *   change, there was nothing to change from.
 * - Before groups exist the timeline is the rounds of the registered events.
 *   Rounds appear and disappear there when the person edits their own
 *   registration, so only moved times count.
 * - Once groups exist, a group added or taken away is exactly the news.
 */
export function scheduleChangeDiff(before: PersonTimeline, after: PersonTimeline, now: Date): TimelineDiff {
	if (before.entries.length === 0) return {changed: [], added: [], removed: []};
	const diff = diffTimeline(before, after, now);
	if (after.kind === 'registered') return {changed: diff.changed, added: [], removed: []};
	return diff;
}

// --- Quiet period -----------------------------------------------------------

export type QuietDecision = 'none' | 'clear' | 'set_pending' | 'fire';

/**
 * One debounce for both groups and schedule.
 *
 * - back at the baseline: drop whatever was pending (an edit that was undone)
 * - a new value: start (or restart) the quiet period
 * - the same value for `quietMs`: send
 *
 * `baseline` null means "nothing announced yet" (groups before publication).
 */
export function decideQuiet(args: {
	current: string;
	baseline: string | null;
	pending: string | null;
	pendingSince: Date | null;
	now: Date;
	quietMs: number;
}): QuietDecision {
	const {current, baseline, pending, pendingSince, now, quietMs} = args;
	if (baseline != null && current === baseline) {
		return pending ? 'clear' : 'none';
	}
	if (current !== pending || !pendingSince) return 'set_pending';
	return now.getTime() - pendingSince.getTime() >= quietMs ? 'fire' : 'none';
}

// --- Groups summary -----------------------------------------------------------

export interface AssignmentSummary {
	competing: TimelineEntry[];
	duties: {judge: number; scrambler: number; runner: number; other: number};
}

export function summarizeAssignments(timeline: PersonTimeline): AssignmentSummary {
	const summary: AssignmentSummary = {competing: [], duties: {judge: 0, scrambler: 0, runner: 0, other: 0}};
	if (timeline.kind !== 'assigned') return summary;
	for (const e of timeline.entries) {
		switch (e.assignmentCode) {
			case 'competitor':
				summary.competing.push(e);
				break;
			case 'staff-judge':
				summary.duties.judge++;
				break;
			case 'staff-scrambler':
				summary.duties.scrambler++;
				break;
			case 'staff-runner':
				summary.duties.runner++;
				break;
			default:
				summary.duties.other++;
		}
	}
	return summary;
}

// --- Official results and rankings ------------------------------------------

export type ResultType = 'single' | 'average';

export interface RankBaselineEntry {
	eventId: string;
	type: ResultType;
	best: number;
	nationalRanking: number | null;
}

/** The person's PBs and national ranks before the competition, from the WCIF. */
export function rankBaselineFromPerson(person: WcifPerson | null | undefined): RankBaselineEntry[] {
	return (person?.personalBests || [])
		.filter((pb) => pb && pb.eventId && (pb.type === 'single' || pb.type === 'average') && pb.best > 0)
		.map((pb) => ({
			eventId: pb.eventId,
			type: pb.type,
			best: pb.best,
			nationalRanking: pb.nationalRanking > 0 ? pb.nationalRanking : null,
		}));
}

export interface OfficialBest {
	eventId: string;
	type: ResultType;
	best: number;
}

/** Best single and average per event at one competition, from /persons/{id}/results rows. */
export function bestsAtCompetition(results: any[], competitionId: string): OfficialBest[] {
	const out = new Map<string, OfficialBest>();
	const offer = (eventId: string, type: ResultType, value: number) => {
		if (!(value > 0)) return;
		const key = `${eventId}:${type}`;
		const prev = out.get(key);
		if (!prev || value < prev.best) out.set(key, {eventId, type, best: value});
	};
	for (const r of results || []) {
		if (!r || r.competition_id !== competitionId || !r.event_id) continue;
		offer(r.event_id, 'single', Number(r.best));
		offer(r.event_id, 'average', Number(r.average));
	}
	return [...out.values()];
}

/** Bests from this competition that beat the pre-competition PB (lower is better for every event). */
export function findNewPbs(baseline: RankBaselineEntry[], bests: OfficialBest[]): OfficialBest[] {
	const before = new Map((baseline || []).map((b) => [`${b.eventId}:${b.type}`, b]));
	return bests.filter((b) => {
		const prev = before.get(`${b.eventId}:${b.type}`);
		return !prev || b.best < prev.best;
	});
}

type PersonalRecords = Record<string, {single?: {best: number; country_rank: number}; average?: {best: number; country_rank: number}}>;

/**
 * WCA's rank tables lag the posting. They have caught up once every new PB is
 * the best the person endpoint reports.
 */
export function ranksReady(pbs: OfficialBest[], personalRecords: PersonalRecords | null | undefined): boolean {
	if (!personalRecords) return false;
	return pbs.every((pb) => personalRecords[pb.eventId]?.[pb.type]?.best === pb.best);
}

export interface RankLine {
	eventId: string;
	type: ResultType;
	best: number;
	before: number | null;
	after: number;
}

export function buildRankLines(
	pbs: OfficialBest[],
	baseline: RankBaselineEntry[],
	personalRecords: PersonalRecords
): RankLine[] {
	const before = new Map((baseline || []).map((b) => [`${b.eventId}:${b.type}`, b.nationalRanking]));
	const lines: RankLine[] = [];
	for (const pb of pbs) {
		const after = personalRecords?.[pb.eventId]?.[pb.type]?.country_rank;
		if (!(after > 0)) continue;
		const prev = before.get(`${pb.eventId}:${pb.type}`) ?? null;
		if (prev != null && prev <= after) continue; // a PB that did not move the rank is not a rank story
		lines.push({eventId: pb.eventId, type: pb.type, best: pb.best, before: prev, after});
	}
	// Biggest climb first; first-ever ranks after the climbs, best rank first.
	return lines.sort((a, b) => {
		if (a.before != null && b.before != null) return b.before - b.after - (a.before - a.after);
		if (a.before != null) return -1;
		if (b.before != null) return 1;
		return a.after - b.after;
	});
}

/**
 * WCA result value as text. FMC singles are move counts and FMC averages are
 * x100; MBLD packs points, time and misses into one integer. A plain
 * centisecond formatter gets both wrong.
 */
export function formatWcaResult(value: number, eventId: string, type: ResultType): string {
	if (!(value > 0)) return value === -1 ? 'DNF' : value === -2 ? 'DNS' : '-';
	if (eventId === '333fm') {
		return type === 'single' ? String(value) : (value / 100).toFixed(2);
	}
	if (eventId === '333mbf') {
		const missed = value % 100;
		const seconds = Math.floor(value / 100) % 100000;
		const points = 99 - (Math.floor(value / 10000000) % 100);
		const solved = points + missed;
		const attempted = solved + missed;
		if (seconds === 99999) return `${solved}/${attempted}`;
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${solved}/${attempted} ${m}:${String(s).padStart(2, '0')}`;
	}
	const totalSeconds = Math.floor(value / 100);
	const centis = String(value % 100).padStart(2, '0');
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}.${centis}` : `${seconds}.${centis}`;
}

// --- Watch pacing -------------------------------------------------------------

/** Groups and schedule stop mattering a day and a half after the last day starts. */
export function isPastCompetition(endDate: Date, now: Date): boolean {
	return now.getTime() > endDate.getTime() + 36 * 60 * 60 * 1000;
}

/** Results can only turn official from the last day on. */
export function resultsWindowOpen(endDate: Date, now: Date): boolean {
	return now.getTime() >= endDate.getTime();
}

/**
 * When to fetch this competition's WCIF next. Close to the competition,
 * assignments and times move every few minutes; months out they do not.
 */
export function computeNextCheckAt(args: {
	start: Date;
	end: Date;
	now: Date;
	hasStates: boolean;
	source: LifecycleSource;
	pendingDue?: Date | null;
}): Date {
	const {start, end, now, hasStates, source, pendingDue} = args;
	const nowMs = now.getTime();
	let delayMs: number;
	if (isPastCompetition(end, now)) {
		// Nothing left to watch in the WCIF; results run on their own clock.
		delayMs = 365 * DAY_MS;
	} else if (!hasStates && source === 'wca') {
		// A WCA competition nobody here is registered for: only new registrants matter.
		delayMs = 12 * 60 * 60 * 1000;
	} else {
		const daysToStart = (start.getTime() - nowMs) / DAY_MS;
		if (daysToStart <= 3) delayMs = 10 * 60 * 1000;
		else if (daysToStart <= 14) delayMs = 60 * 60 * 1000;
		else delayMs = 6 * 60 * 60 * 1000;
	}
	let next = nowMs + delayMs;
	if (pendingDue && pendingDue.getTime() < next) next = Math.max(nowMs + 60 * 1000, pendingDue.getTime());
	return new Date(next);
}

/** How often to ask whether results are official. ZKT publishes within hours, WCA within weeks. */
export function computeResultsNextCheckAt(source: LifecycleSource, end: Date, now: Date): Date {
	const sinceEnd = now.getTime() - end.getTime();
	const delayMs = source === 'zkt' && sinceEnd < 3 * DAY_MS ? 30 * 60 * 1000 : 3 * 60 * 60 * 1000;
	return new Date(now.getTime() + delayMs);
}

export const RESULTS_GIVE_UP_DAYS = 90;

// --- ZKT announcements -----------------------------------------------------------

export const ZKT_ANNOUNCEABLE_STATUSES = new Set(['ANNOUNCED', 'REGISTRATION_OPEN']);

export function hourInTimeZone(now: Date, timeZone: string): number {
	const parts = new Intl.DateTimeFormat('en-GB', {hour: '2-digit', hourCycle: 'h23', timeZone}).formatToParts(now);
	return Number(parts.find((p) => p.type === 'hour')?.value ?? now.getUTCHours());
}

export function dateInTimeZone(now: Date, timeZone: string): string {
	// en-CA formats as YYYY-MM-DD.
	return new Intl.DateTimeFormat('en-CA', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone}).format(now);
}

export function isAnnounceQuietHours(now: Date): boolean {
	const h = hourInTimeZone(now, ANNOUNCE_TIMEZONE);
	return h >= ANNOUNCE_QUIET_START_HOUR || h < ANNOUNCE_QUIET_END_HOUR;
}

export type AnnounceDecision = 'send' | 'wait' | 'skip';

/** Should a not-yet-announced ZKT competition be broadcast on this tick? */
export function decideAnnouncement(args: {status: string; startDate: string; cancelled: boolean; now: Date}): AnnounceDecision {
	const {status, startDate, cancelled, now} = args;
	if (cancelled || status === 'CANCELLED') return 'skip';
	if (!ZKT_ANNOUNCEABLE_STATUSES.has(status)) return 'skip';
	if (startDate && startDate.slice(0, 10) < dateInTimeZone(now, ANNOUNCE_TIMEZONE)) return 'skip';
	if (isAnnounceQuietHours(now)) return 'wait';
	return 'send';
}

export type AnnounceVariant = 'announced' | 'announced_open' | 'announced_no_date';

export function announcementVariant(args: {status: string; openAt: Date | null; now: Date}): AnnounceVariant {
	if (args.status === 'REGISTRATION_OPEN') return 'announced_open';
	if (args.openAt && args.openAt.getTime() > args.now.getTime()) return 'announced';
	// Planned date passed but the organizer has not opened it (opening is
	// manual on the federation): claiming "open" would be false.
	return 'announced_no_date';
}

export type ReminderDecision = 'send' | 'wait' | 'skip';

/**
 * Registration reminder. Only for competitions that were announced or that
 * existed before the scanner (seeded); a competition whose announcement is still
 * held by quiet hours must not get its reminder first.
 */
export function decideReminder(args: {
	openAt: Date | null;
	now: Date;
	status: string;
	cancelled: boolean;
	announcedAt: Date | null;
	eligible: boolean;
}): ReminderDecision {
	const {openAt, now, status, cancelled, announcedAt, eligible} = args;
	if (cancelled || status === 'CANCELLED') return 'skip';
	if (!eligible || !openAt) return 'wait';
	if (!ZKT_ANNOUNCEABLE_STATUSES.has(status)) return 'skip';
	const openMs = openAt.getTime();
	const nowMs = now.getTime();
	if (nowMs >= openMs + REGISTRATION_REMINDER_GRACE_MS) return 'skip';
	// The announcement itself went out inside the reminder window and already
	// carried the time: a second push minutes later is noise.
	if (announcedAt && openMs - announcedAt.getTime() < REGISTRATION_REMINDER_LEAD_MS) return 'skip';
	if (nowMs >= openMs - REGISTRATION_REMINDER_LEAD_MS) return 'send';
	return 'wait';
}

// --- Formatting -----------------------------------------------------------------

const LOCALE_TAGS: Record<string, string> = {tr: 'tr-TR', en: 'en-GB', es: 'es-ES', ru: 'ru-RU', zh: 'zh-CN'};

export type CompTimeStyle = 'weekday_time' | 'date_time' | 'time';

/**
 * A competition time in the competition's own timezone, never the server's.
 * An unknown timezone falls back to UTC rather than throwing.
 */
export function formatCompTime(iso: string | Date | null, timeZone: string | null, locale: string, style: CompTimeStyle): string {
	if (!iso) return '';
	const date = iso instanceof Date ? iso : new Date(iso);
	if (isNaN(date.getTime())) return '';
	const options: Intl.DateTimeFormatOptions = {hour: '2-digit', minute: '2-digit', hourCycle: 'h23'};
	if (style === 'weekday_time') options.weekday = 'short';
	if (style === 'date_time') {
		options.day = 'numeric';
		options.month = 'long';
	}
	const tag = LOCALE_TAGS[locale] || 'en-GB';
	try {
		return new Intl.DateTimeFormat(tag, {...options, timeZone: timeZone || 'UTC'}).format(date);
	} catch {
		return new Intl.DateTimeFormat(tag, {...options, timeZone: 'UTC'}).format(date);
	}
}
