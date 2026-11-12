// Online score entry (ZKT): when a judge asks for a correction ("Süre düzelt")
// or an extra ("Ekstra iste"), the people who can approve it get one in-app
// notification and one push: which round, group and station, which attempt.
// The approval itself still happens at the station by scanning the judge's QR.
//
// The site decides who can approve and sends the list with its answer to the
// request (`notify`, lib/zkt/judge/service.ts createJudgeRequest); it is empty
// when the judge approves on their own phone. The resolver strips that block
// before the phone sees it and hands it here.
//
// Once per request: the phone asks for a fresh QR every two minutes while the
// sheet is open, so a Redis key per (card, purpose, attempt) holds the notice
// back for NOTICE_WINDOW_S. A request still open after that window is notified
// again, which doubles as a reminder. Without Redis the notice goes anyway: a
// repeat is better than a judge nobody comes to.

import {logger} from './logger';
import {getPrisma} from '../database';
import {createRedisKey, getRedisPubClient, RedisNamespace} from './redis';
import {sendPushToUser} from './push';
import {getUserIdsWithPrefDisabled} from '../models/notification_preference';
import ZktJudgeRequestNotification from '../resources/notification_types/zkt_judge_request';

export type JudgeRequestPurpose = 'CORRECT' | 'EXTRA';

/** The site's `notify` block on a CORRECT / EXTRA request answer. */
export interface JudgeRequestNotify {
	competition: {id: string; slug: string; name: string};
	/** The site's User.ids (this app's Integration.zkt_user_id) who can approve it. */
	recipients: string[];
	eventId: string;
	roundNumber: number;
	dualChance: boolean;
	chance: number;
	groupNumber: number | null;
	stationNumber: number | null;
	attemptNo: number;
}

export const NOTICE_WINDOW_S = 10 * 60;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const intOrNull = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : null);

/** Read the block defensively: it crosses a service boundary. Null when unusable. */
export function readJudgeRequestNotify(raw: unknown): JudgeRequestNotify | null {
	if (!isObj(raw) || !isObj(raw.competition)) return null;
	const c = raw.competition;
	if (typeof c.id !== 'string' || typeof c.slug !== 'string' || typeof c.name !== 'string') return null;
	if (!Array.isArray(raw.recipients) || typeof raw.eventId !== 'string') return null;
	const roundNumber = intOrNull(raw.roundNumber);
	const attemptNo = intOrNull(raw.attemptNo);
	if (roundNumber == null || attemptNo == null) return null;
	return {
		competition: {id: c.id, slug: c.slug, name: c.name},
		recipients: raw.recipients.filter((r): r is string => typeof r === 'string'),
		eventId: raw.eventId,
		roundNumber,
		dualChance: raw.dualChance === true,
		chance: intOrNull(raw.chance) ?? 1,
		groupNumber: intOrNull(raw.groupNumber),
		stationNumber: intOrNull(raw.stationNumber),
		attemptNo,
	};
}

/**
 * Split the site's answer: what the phone gets (never the recipient list) and
 * the notice for this server. Pure, unit tested.
 */
export function splitJudgeRequestAnswer(answer: Record<string, unknown>): {
	response: Record<string, unknown>;
	notify: JudgeRequestNotify | null;
} {
	const {notify, ...response} = answer;
	return {response, notify: readJudgeRequestNotify(notify)};
}

/** True when this request was not notified within the window (and claims it). */
async function claimNotice(cardId: string, purpose: JudgeRequestPurpose, attemptNo: number): Promise<boolean> {
	const {key} = createRedisKey(RedisNamespace.ZKT_JUDGE_REQUEST, `${cardId}:${purpose}:${attemptNo}`);
	try {
		const client = getRedisPubClient();
		if (!client) return true;
		return (await client.set(key, '1', 'EX', NOTICE_WINDOW_S, 'NX')) === 'OK';
	} catch (err: any) {
		logger.warn('[ZktJudgeRequest] redis unavailable, notifying anyway', {err: err?.message});
		return true;
	}
}

/** Tell the staff who can approve it. Never throws: the judge's QR must not wait on this. */
export async function notifyJudgeRequest(purpose: JudgeRequestPurpose, cardId: string, notify: JudgeRequestNotify): Promise<number> {
	try {
		if (notify.recipients.length === 0) return 0;
		if (!(await claimNotice(cardId, purpose, notify.attemptNo))) return 0;

		// Same lookup as cron_zkt_judge_progress.ts: the ZKT identity lives on the
		// integration row; revoked_at only marks a dead refresh token.
		const links = await getPrisma().integration.findMany({
			where: {service_name: 'zkt', zkt_user_id: {in: notify.recipients}},
			select: {user: {include: {settings: true}}},
		});
		const users = [...new Map(links.map((l) => [l.user.id, l.user])).values()];
		if (users.length === 0) return 0;
		const optedOut = await getUserIdsWithPrefDisabled(
			users.map((u) => u.id),
			'zkt_judge_request'
		);

		let sent = 0;
		for (const user of users) {
			if (optedOut.has(user.id)) continue;
			try {
				const notification = new ZktJudgeRequestNotification(
					{user: user as any, triggeringUser: user as any, sendEmail: false},
					{purpose, notify, locale: (user as any).settings?.locale}
				);
				await notification.send();
				await sendPushToUser(user.id, notification.subject(), notification.detail(), notification.pushData());
				sent++;
			} catch (err: any) {
				logger.warn('[ZktJudgeRequest] notify failed', {userId: user.id, err: err?.message});
			}
		}
		logger.info('[ZktJudgeRequest] notified', {competition: notify.competition.id, purpose, attempt: notify.attemptNo, sent});
		return sent;
	} catch (err: any) {
		logger.warn('[ZktJudgeRequest] notice failed', {purpose, err: err?.message});
		return 0;
	}
}
