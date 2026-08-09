import {getPrisma} from '../database';
import {logger} from './logger';
// Same split socket_util itself uses: the io instance lives in socket.ts, the room
// naming in socket_util. Both are only read inside functions, so the import cycle
// socket.ts -> dm_presence.ts -> socket.ts resolves lazily at call time.
import {getSocketIO} from './socket';
import {userRoom} from './socket_util';
import {getSocialPreference} from '../models/messaging';
import {getSiteConfig} from '../models/site_config';

/**
 * Who is online right now, for the messages screen.
 *
 * Presence is read straight off the live socket connections and never stored. That is
 * the whole design: there is no table here, no timestamp, and therefore no "last seen"
 * that could be reconstructed from our data later. When the tab closes the fact that
 * the person was ever online stops existing.
 *
 * Three gates stand between "is connected" and "you may see it":
 *
 *   1. Reciprocity. Hiding your own dot hides everyone else's from you. Without this
 *      the setting would be a one-way mirror, which is worse than no setting at all.
 *   2. Conversation. Only people you have an accepted thread with. A stranger cannot
 *      watch when you come and go, and neither can an unanswered message request.
 *   3. Blocks. Either direction removes the person entirely.
 */
export const DM_PRESENCE_EVENT = 'dm:presence';

/**
 * The kill switch, checked at the top of every path in this file.
 *
 * Two switches rather than one: `messaging_enabled` turns off the whole feature, and
 * `presence_enabled` drops only the live dot. Matrix learned this the hard way and
 * shipped a dedicated presence switch after having to disable it on their flagship
 * server; the point is to be able to shed the expensive part without taking
 * conversations offline with it.
 *
 * Staff do not bypass this one. An admin exemption exists elsewhere so support can
 * still work while a feature is dark, but the reason to switch presence off is load,
 * and an exemption would defeat that.
 */
async function presenceAllowed(): Promise<boolean> {
	const config = await getSiteConfig();
	return Boolean(config.messaging_enabled && config.presence_enabled);
}

/** The subset of `userIds` with at least one live socket, ignoring all permissions. */
export async function onlineAmong(userIds: string[]): Promise<Set<string>> {
	const online = new Set<string>();
	if (userIds.length === 0) return online;

	const io = getSocketIO();
	if (!io) return online;

	try {
		// One adapter round trip for the whole batch rather than one per person.
		const sockets = await io.in(userIds.map(userRoom)).fetchSockets();
		for (const socket of sockets) {
			const uid = (socket as any).data?.userId;
			if (uid) online.add(uid);
		}
	} catch (e) {
		logger.warn('[DMPresence] socket lookup failed', {error: (e as Error)?.message});
	}

	return online;
}

/** People `viewerId` has an accepted conversation with, narrowed to `userIds`. */
async function acceptedPartners(viewerId: string, userIds: string[]): Promise<Set<string>> {
	const rows = await getPrisma().conversationParticipant.findMany({
		where: {
			user_id: {in: userIds},
			conversation: {participants: {some: {user_id: viewerId, accepted_at: {not: null}}}},
		},
		select: {user_id: true},
	});

	return new Set(rows.map((r) => r.user_id));
}

async function blockedEitherWay(viewerId: string, userIds: string[]): Promise<Set<string>> {
	const rows = await getPrisma().userBlock.findMany({
		where: {
			OR: [
				{blocker_id: viewerId, blocked_id: {in: userIds}},
				{blocker_id: {in: userIds}, blocked_id: viewerId},
			],
		},
		select: {blocker_id: true, blocked_id: true},
	});

	const blocked = new Set<string>();
	for (const row of rows) {
		blocked.add(row.blocker_id === viewerId ? row.blocked_id : row.blocker_id);
	}
	return blocked;
}

/** Of `userIds`, the ones sharing their presence. Absent rows count as sharing. */
async function sharingPresence(userIds: string[]): Promise<Set<string>> {
	const optedOut = await getPrisma().socialPreference.findMany({
		where: {user_id: {in: userIds}, online_status: false},
		select: {user_id: true},
	});

	const hidden = new Set(optedOut.map((r) => r.user_id));
	// The column defaults to true, so someone who has never opened the settings page
	// and has no row is sharing. Treating a missing row as "hidden" would mean the
	// feature quietly did nothing for every account created before it existed.
	return new Set(userIds.filter((id) => !hidden.has(id)));
}

/** The ids `viewerId` is allowed to see as online, right now. */
export async function visibleOnlineUsers(viewerId: string, userIds: string[]): Promise<string[]> {
	if (!(await presenceAllowed())) return [];

	const candidates = [...new Set(userIds)].filter((id) => id && id !== viewerId);
	if (candidates.length === 0) return [];

	const viewer = await getSocialPreference(viewerId);
	if (!viewer.online_status) return [];

	const partners = await acceptedPartners(viewerId, candidates);
	if (partners.size === 0) return [];

	const allowed = [...partners];
	const [blocked, sharing, online] = await Promise.all([
		blockedEitherWay(viewerId, allowed),
		sharingPresence(allowed),
		onlineAmong(allowed),
	]);

	return allowed.filter((id) => !blocked.has(id) && sharing.has(id) && online.has(id));
}

/**
 * Tells a user's conversation partners that they came online or went away.
 *
 * Only fired on the transitions, never per tab: someone with three tabs open is online
 * once, and closing one of them is not an event anybody needs to hear about.
 */
export async function broadcastPresence(userId: string, online: boolean): Promise<void> {
	if (!(await presenceAllowed())) return;

	const self = await getSocialPreference(userId);
	if (!self.online_status) return;

	await notifyPartners(userId, online);
}

/**
 * Sends "offline" whatever the user's own setting says.
 *
 * Used the moment someone switches their dot off: broadcastPresence would refuse,
 * because it checks that same setting, and the dot would stay lit on every screen
 * already showing it until those people happened to reload.
 */
export async function forcePresenceOff(userId: string): Promise<void> {
	// No switch check: this only ever hides a dot, so it must work even while presence
	// is being switched off. Refusing here would strand a lit dot on someone's screen.
	await notifyPartners(userId, false);
}

async function notifyPartners(userId: string, online: boolean): Promise<void> {
	try {
		const io = getSocketIO();
		if (!io) return;

		const rows = await getPrisma().conversationParticipant.findMany({
			where: {
				user_id: {not: userId},
				accepted_at: {not: null},
				conversation: {participants: {some: {user_id: userId, accepted_at: {not: null}}}},
			},
			select: {user_id: true},
		});

		const partnerIds = [...new Set(rows.map((r) => r.user_id))];
		if (partnerIds.length === 0) return;

		const [blocked, watching] = await Promise.all([
			blockedEitherWay(userId, partnerIds),
			sharingPresence(partnerIds),
		]);

		for (const partnerId of partnerIds) {
			// A partner who hides their own dot does not receive anyone else's.
			if (blocked.has(partnerId) || !watching.has(partnerId)) continue;
			io.to(userRoom(partnerId)).emit(DM_PRESENCE_EVENT, {user_id: userId, online});
		}
	} catch (e) {
		logger.warn('[DMPresence] broadcast failed', {userId, error: (e as Error)?.message});
	}
}

/**
 * Called when a socket connects or disconnects, and decides whether that was a real
 * transition worth telling anyone about.
 *
 * Owning the decision here rather than in socket.ts keeps the switch check, the tab
 * counting and the broadcast in one place: someone with three tabs open is online
 * once, and closing one of them is not an event.
 */
export async function handleSocketTransition(userId: string, event: 'connect' | 'disconnect'): Promise<void> {
	if (!(await presenceAllowed())) return;

	const io = getSocketIO();
	if (!io) return;

	let count = 0;
	try {
		const sockets = await io.in(userRoom(userId)).fetchSockets();
		count = sockets.length;
	} catch {
		return;
	}

	// On connect the socket has already joined, so 1 means it is the first. On
	// disconnect it has already left its rooms, so 0 means the last one just went.
	if (event === 'connect' && count === 1) {
		await broadcastPresence(userId, true);
	} else if (event === 'disconnect' && count === 0) {
		await broadcastPresence(userId, false);
	}
}
