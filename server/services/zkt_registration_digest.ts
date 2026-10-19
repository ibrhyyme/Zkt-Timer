// Turns the federation's registration feed into one notification per
// competition. On the morning registration opens, two hundred entries in an
// hour must not become two hundred pushes: each poll folds whatever arrived
// into "BursaSummer2026: 5 yeni kayıt: Ahmet, Mehmet, Ayşe +2".
//
// Pure, so the wording is testable without the cron or the database.

export interface ZktFeedEvent {
	id: string;
	at: string;
	type: 'registered' | 'withdrawn';
	competition: {id: string; slug: string | null; name: string};
	name: string;
}

export interface ZktRegistrationDigest {
	competition: ZktFeedEvent['competition'];
	registered: string[];
	withdrawn: string[];
}

/**
 * One digest per competition, in the order competitions first appear in the
 * feed. A name is listed once per list: someone who registers, withdraws and
 * registers again within one poll is one new entry, not two.
 */
export function groupFeedEvents(events: ZktFeedEvent[]): ZktRegistrationDigest[] {
	const byId = new Map<string, ZktRegistrationDigest>();
	for (const e of events) {
		let d = byId.get(e.competition.id);
		if (!d) {
			d = {competition: e.competition, registered: [], withdrawn: []};
			byId.set(e.competition.id, d);
		}
		const list = e.type === 'registered' ? d.registered : d.withdrawn;
		if (!list.includes(e.name)) list.push(e.name);
	}
	return [...byId.values()];
}

/** "Ahmet, Mehmet, Ayşe" or, past `max`, "Ahmet, Mehmet, Ayşe +2". */
export function namesSummary(names: string[], max = 3): string {
	const shown = names.slice(0, max).join(', ');
	return names.length > max ? `${shown} +${names.length - max}` : shown;
}

/** "3 yeni kayıt: Ahmet, Mehmet, Ayşe. Kaydını çekti: Ali" */
export function digestBody(d: ZktRegistrationDigest): string {
	const parts: string[] = [];
	if (d.registered.length === 1) parts.push(`Yeni kayıt: ${d.registered[0]}`);
	else if (d.registered.length > 1) parts.push(`${d.registered.length} yeni kayıt: ${namesSummary(d.registered)}`);
	if (d.withdrawn.length === 1) parts.push(`Kaydını çekti: ${d.withdrawn[0]}`);
	else if (d.withdrawn.length > 1) parts.push(`${d.withdrawn.length} kişi kaydını çekti: ${namesSummary(d.withdrawn)}`);
	return parts.join('. ');
}
