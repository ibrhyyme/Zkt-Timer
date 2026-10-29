// Registration watch: the pure half. Turns WCA reads into registrant lists,
// diffs two lists and flags the suspicious changes. No I/O here on purpose;
// cron_registration_watch.ts does the reads and the writes.

import {createHash} from 'crypto';

export interface WatchedRegistrant {
	wcaRegistrationId: number;
	registrantId: number | null;
	wcaUserId: number | null;
	wcaId: string | null;
	name: string;
	eventIds: string[];
	roles: string[];
	competitorGroups: number;
	staffTasks: number;
}

/** What the light read (/api/v0/competitions/<id>/registrations) gives per accepted registration. */
export interface LightRegistration {
	wcaRegistrationId: number;
	eventIds: string[];
}

export type ChangeKind = 'joined' | 'left' | 'events_changed';

export interface RegistrantChange {
	kind: ChangeKind;
	registrant: WatchedRegistrant;
	eventsBefore: string[];
	eventsAfter: string[];
}

// Roles whose holders are not handed tasks by the group tool, so a missing task
// says nothing about them.
const TASK_EXEMPT_ROLES = new Set(['delegate', 'trainee-delegate', 'organizer']);

// Share of the other competitors that must have a task before a competitor
// without one stands out. Group tools hand tasks to nearly everyone or to nobody.
const STAFFED_SHARE_FOR_ANOMALY = 0.75;

const DAY_MS = 24 * 60 * 60 * 1000;

function sortedEvents(ids: unknown): string[] {
	return Array.isArray(ids) ? ids.map(String).sort() : [];
}

function toIntOrNull(v: unknown): number | null {
	const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
	return Number.isFinite(n) ? n : null;
}

/** Accepted, competing registrants of a public WCIF. */
export function registrantsFromWcif(wcif: any): WatchedRegistrant[] {
	const out: WatchedRegistrant[] = [];
	for (const p of wcif?.persons || []) {
		const reg = p?.registration;
		if (!reg || reg.status !== 'accepted' || reg.isCompeting === false) continue;
		const wcaRegistrationId = toIntOrNull(reg.wcaRegistrationId);
		if (wcaRegistrationId === null) continue;
		const assignments: any[] = Array.isArray(p.assignments) ? p.assignments : [];
		out.push({
			wcaRegistrationId,
			registrantId: toIntOrNull(p.registrantId),
			wcaUserId: toIntOrNull(p.wcaUserId),
			wcaId: p.wcaId || null,
			name: String(p.name || ''),
			eventIds: sortedEvents(reg.eventIds),
			roles: Array.isArray(p.roles) ? p.roles.map(String) : [],
			competitorGroups: assignments.filter((a) => a?.assignmentCode === 'competitor').length,
			staffTasks: assignments.filter((a) => String(a?.assignmentCode || '').startsWith('staff-')).length,
		});
	}
	return out;
}

export function lightRegistrationsFromApi(rows: any): LightRegistration[] {
	if (!Array.isArray(rows)) return [];
	const out: LightRegistration[] = [];
	for (const r of rows) {
		const id = toIntOrNull(r?.id);
		if (id === null) continue;
		out.push({wcaRegistrationId: id, eventIds: sortedEvents(r.event_ids)});
	}
	return out;
}

/** Same value for the light read and the WCIF of the same list, so either can be compared to the other. */
export function listHash(rows: LightRegistration[]): string {
	const lines = rows
		.map((r) => `${r.wcaRegistrationId}:${[...r.eventIds].sort().join(',')}`)
		.sort();
	return createHash('sha1').update(lines.join('\n')).digest('hex');
}

export function diffRegistrants(before: WatchedRegistrant[], after: WatchedRegistrant[]): RegistrantChange[] {
	const prev = new Map(before.map((r) => [r.wcaRegistrationId, r]));
	const next = new Map(after.map((r) => [r.wcaRegistrationId, r]));
	const changes: RegistrantChange[] = [];

	for (const r of after) {
		const old = prev.get(r.wcaRegistrationId);
		if (!old) {
			changes.push({kind: 'joined', registrant: r, eventsBefore: [], eventsAfter: r.eventIds});
		} else if (old.eventIds.join(',') !== r.eventIds.join(',')) {
			changes.push({kind: 'events_changed', registrant: r, eventsBefore: old.eventIds, eventsAfter: r.eventIds});
		}
	}
	for (const r of before) {
		if (!next.has(r.wcaRegistrationId)) {
			changes.push({kind: 'left', registrant: r, eventsBefore: r.eventIds, eventsAfter: []});
		}
	}
	return changes;
}

/**
 * A change is only known to have happened somewhere in (windowStart, observedAt].
 * A flag is set when the whole window lies past the moment, so a flag is never a guess.
 */
export function changeFlags(input: {
	windowStart: Date | null;
	registrationClose: Date | null;
	groupsSeenAt: Date | null;
}): {afterClose: boolean; afterGroups: boolean} {
	const {windowStart, registrationClose, groupsSeenAt} = input;
	if (!windowStart) return {afterClose: false, afterGroups: false};
	return {
		afterClose: !!registrationClose && windowStart.getTime() >= registrationClose.getTime(),
		afterGroups: !!groupsSeenAt && windowStart.getTime() >= groupsSeenAt.getTime(),
	};
}

export function hasGroups(registrants: Pick<WatchedRegistrant, 'competitorGroups'>[]): boolean {
	return registrants.some((r) => r.competitorGroups > 0);
}

/**
 * Registrants with a competitor group but no task while nearly everyone else has
 * one: the trace a competitor added by hand after the group tool ran leaves.
 */
export function unstaffedRegistrationIds(
	registrants: Pick<WatchedRegistrant, 'wcaRegistrationId' | 'roles' | 'competitorGroups' | 'staffTasks'>[]
): Set<number> {
	const pool = registrants.filter(
		(r) => r.competitorGroups > 0 && !r.roles.some((role) => TASK_EXEMPT_ROLES.has(role))
	);
	const result = new Set<number>();
	if (pool.length === 0) return result;
	const staffed = pool.filter((r) => r.staffTasks > 0).length;
	if (staffed / pool.length < STAFFED_SHARE_FOR_ANOMALY) return result;
	for (const r of pool) {
		if (r.staffTasks === 0) result.add(r.wcaRegistrationId);
	}
	return result;
}

/** Read until the day after the last competition day (timezone slack), then the list is final. */
export function isWatchActive(endDate: Date, now: Date): boolean {
	return now.getTime() <= endDate.getTime() + 2 * DAY_MS;
}

/** Turkish one-liner for the owner's notification. Null when nothing is worth a push. */
export function changeDigest(changes: {kind: ChangeKind; name: string; afterClose: boolean; afterGroups: boolean}[]): string | null {
	const flagged = changes.filter((c) => c.afterClose || c.afterGroups);
	if (flagged.length === 0) return null;
	const names = (kind: ChangeKind) => flagged.filter((c) => c.kind === kind).map((c) => c.name);
	const parts: string[] = [];
	const left = names('left');
	const joined = names('joined');
	const changed = names('events_changed');
	if (left.length) parts.push(`Çıkan: ${left.join(', ')}`);
	if (joined.length) parts.push(`Giren: ${joined.join(', ')}`);
	if (changed.length) parts.push(`Branşı değişen: ${changed.join(', ')}`);
	const when = flagged.some((c) => c.afterGroups) ? 'gruplar açıklandıktan sonra' : 'kayıtlar kapandıktan sonra';
	return `${parts.join('. ')} (${when}).`;
}
