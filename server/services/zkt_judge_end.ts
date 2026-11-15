// Online score entry (ZKT): when a judge ends judging a finished card
// ("Hakemliği sonlandır"), the competitor gets one push and one in-app notice
// with the unofficial result (owner, 2026-11-15): "RESMİ OLMAYAN SONUÇLARA
// GÖRE" above "Ortalama: 12.34 · Single: 10.21", nothing about the round. The
// competitor is just getting up from the table and wants the average now; the
// official result notices come later as before.
//
// The site computes the result and sends it with its answer to the end
// (`notify`, lib/zkt/judge/service.ts endJudgeGrants); only finished cards of
// competitors with an account are in it. The resolver strips that block before
// the judge's phone sees it and hands it here. Ending happens once (a second
// end finds no grant and the site sends no block), so there is no claim here.
// No preference switch, like the per-round result notices.

import {logger} from './logger';
import {getPrisma} from '../database';
import {sendPushToUser} from './push';
import ZktUnofficialResultNotification from '../resources/notification_types/zkt_unofficial_result';

export interface JudgeEndResult {
	cardId: string;
	/** The site's User.id: this app's Integration.zkt_user_id. */
	competitorUserId: string;
	eventId: string;
	/** WCA-encoded: cs, FMC moves, MBLD packed; DNF -1. */
	best: number;
	/** Null when the format has no average or the cutoff was missed. FMC x100. */
	average: number | null;
}

/** The site's `notify` block on an end-judging answer. */
export interface JudgeEndNotify {
	competition: {id: string; slug: string; name: string};
	results: JudgeEndResult[];
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** Read the block defensively: it crosses a service boundary. Null when unusable. */
export function readJudgeEndNotify(raw: unknown): JudgeEndNotify | null {
	if (!isObj(raw) || !isObj(raw.competition) || !Array.isArray(raw.results)) return null;
	const c = raw.competition;
	if (typeof c.id !== 'string' || typeof c.slug !== 'string' || typeof c.name !== 'string') return null;
	const results: JudgeEndResult[] = [];
	for (const r of raw.results) {
		if (!isObj(r) || typeof r.cardId !== 'string' || typeof r.competitorUserId !== 'string' || typeof r.eventId !== 'string') continue;
		if (!isInt(r.best) || (r.average !== null && !isInt(r.average))) continue;
		results.push({cardId: r.cardId, competitorUserId: r.competitorUserId, eventId: r.eventId, best: r.best, average: r.average as number | null});
	}
	if (results.length === 0) return null;
	return {competition: {id: c.id, slug: c.slug, name: c.name}, results};
}

/**
 * Split the site's answer: what the phone gets (never the competitors' results)
 * and the notice for this server. Pure, unit tested.
 */
export function splitJudgeEndAnswer(answer: Record<string, unknown>): {
	response: Record<string, unknown>;
	notify: JudgeEndNotify | null;
} {
	const {notify, ...response} = answer;
	return {response, notify: readJudgeEndNotify(notify)};
}

/** Tell each competitor their unofficial result. Never throws: the judge's end must not wait on this. */
export async function notifyJudgeEndResults(notify: JudgeEndNotify): Promise<number> {
	try {
		// Same lookup as zkt_judge_request.ts: the ZKT identity lives on the integration row.
		const links = await getPrisma().integration.findMany({
			where: {service_name: 'zkt', zkt_user_id: {in: notify.results.map((r) => r.competitorUserId)}},
			select: {zkt_user_id: true, user: {include: {settings: true}}},
		});
		let sent = 0;
		for (const result of notify.results) {
			const users = [...new Map(links.filter((l) => l.zkt_user_id === result.competitorUserId).map((l) => [l.user.id, l.user])).values()];
			for (const user of users) {
				try {
					const notification = new ZktUnofficialResultNotification(
						{user: user as any, triggeringUser: user as any, sendEmail: false},
						{competition: notify.competition, result, locale: (user as any).settings?.locale}
					);
					await notification.send();
					await sendPushToUser(user.id, notification.subject(), notification.detail(), notification.pushData());
					sent++;
				} catch (err: any) {
					logger.warn('[ZktJudgeEnd] notify failed', {userId: user.id, err: err?.message});
				}
			}
		}
		logger.info('[ZktJudgeEnd] notified', {competition: notify.competition.id, results: notify.results.length, sent});
		return sent;
	} catch (err: any) {
		logger.warn('[ZktJudgeEnd] notice failed', {err: err?.message});
		return 0;
	}
}
