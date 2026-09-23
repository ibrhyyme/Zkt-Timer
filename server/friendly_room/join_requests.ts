/**
 * Requests to join a full friendly room, and the approvals that answer them.
 *
 * A room used to refuse anyone past its capacity, and capacity could only be picked when the
 * room was created, so an eight-person room that had been going for fifty solves could not
 * take a ninth friend. Now a full room turns the join into a request: the owner or a
 * moderator accepts or rejects it, and an accepted request lets that one person in past the
 * room's own limit (never past FriendlyRoomConst.MAX_PLAYERS).
 *
 * Both live in Redis rather than in process memory, like the active-session map in events.ts,
 * so a request made on one instance can be answered from another.
 *
 *  - Requests: one hash per room, one field per requesting user. A hash rather than one JSON
 *    blob so two people asking at the same moment cannot overwrite each other's request.
 *  - Approval: one short-lived key per room and user. Accepting writes it; the requester's
 *    next JOIN_ROOM consumes it. Going through JOIN_ROOM again, instead of adding the
 *    participant from the accept handler, reuses the whole join path (session takeover,
 *    socket room, "joined" notice, lobby refresh) rather than duplicating it for a socket
 *    that is not the one handling the accept.
 */

import {
	createRedisKey,
	deleteKeyInRedis,
	getRedisPubClient,
	keyExistsInRedis,
	RedisNamespace,
	setKeyInRedis,
} from '../services/redis';
import {FriendlyRoomConst} from '../../shared/friendly_room/consts';
import type {FriendlyRoomJoinRequestData} from '../../shared/friendly_room/types';

/** What is stored per request. The socket id is how the answer reaches the requester. */
export interface StoredJoinRequest extends FriendlyRoomJoinRequestData {
	socket_id: string;
}

const REQUEST_TTL_MS = FriendlyRoomConst.JOIN_REQUEST_TTL_MS;

/** Long enough for the requester's client to receive the answer and send JOIN_ROOM again. */
const APPROVAL_TTL_SECONDS = 60;

function requestsKey(roomId: string) {
	return createRedisKey(RedisNamespace.FRIENDLY_ROOM_JOIN_REQUESTS, roomId);
}

function approvalKey(roomId: string, userId: string) {
	return createRedisKey(RedisNamespace.FRIENDLY_ROOM_JOIN_APPROVAL, `${roomId}:${userId}`);
}

function parse(value: string | null | undefined): StoredJoinRequest | null {
	if (!value) return null;
	try {
		return JSON.parse(value) as StoredJoinRequest;
	} catch {
		return null;
	}
}

/** Record or refresh a request. Asking again replaces the old one with the new socket. */
export async function addJoinRequest(roomId: string, request: StoredJoinRequest): Promise<void> {
	const {key} = requestsKey(roomId);
	const client = getRedisPubClient();
	await client.hset(key, request.user_id, JSON.stringify(request));
	// The hash as a whole outlives its newest request; individual stale fields are dropped
	// on read in listJoinRequests.
	await client.pexpire(key, REQUEST_TTL_MS);
}

/** Remove a request and hand it back, or null if there was none (already answered, lapsed). */
export async function takeJoinRequest(roomId: string, userId: string): Promise<StoredJoinRequest | null> {
	const {key} = requestsKey(roomId);
	const client = getRedisPubClient();
	const request = parse(await client.hget(key, userId));
	await client.hdel(key, userId);
	if (!request || Date.now() - request.requested_at > REQUEST_TTL_MS) return null;
	return request;
}

/** Pending requests, oldest first, with lapsed ones cleared out along the way. */
export async function listJoinRequests(roomId: string): Promise<StoredJoinRequest[]> {
	const {key} = requestsKey(roomId);
	const client = getRedisPubClient();
	const all = (await client.hgetall(key)) || {};
	const now = Date.now();

	const live: StoredJoinRequest[] = [];
	const stale: string[] = [];
	for (const [userId, value] of Object.entries(all)) {
		const request = parse(value);
		if (!request || now - request.requested_at > REQUEST_TTL_MS) {
			stale.push(userId);
		} else {
			live.push(request);
		}
	}
	if (stale.length) await client.hdel(key, ...stale);

	return live.sort((a, b) => a.requested_at - b.requested_at);
}

/** Drop every request a socket made. Used when that socket disconnects. */
export async function removeJoinRequestsBySocket(roomId: string, socketId: string): Promise<boolean> {
	const requests = await listJoinRequests(roomId);
	const mine = requests.filter((r) => r.socket_id === socketId);
	if (!mine.length) return false;
	await getRedisPubClient().hdel(requestsKey(roomId).key, ...mine.map((r) => r.user_id));
	return true;
}

/** The shape managers are shown: no socket ids leave the server. */
export function toPublicRequests(requests: StoredJoinRequest[]): FriendlyRoomJoinRequestData[] {
	return requests.map(({user_id, username, requested_at}) => ({user_id, username, requested_at}));
}

export async function grantJoinApproval(roomId: string, userId: string): Promise<void> {
	await setKeyInRedis(approvalKey(roomId, userId), '1', APPROVAL_TTL_SECONDS);
}

export async function hasJoinApproval(roomId: string, userId: string): Promise<boolean> {
	return (await keyExistsInRedis(approvalKey(roomId, userId))) > 0;
}

/** One approval, one join: cleared once the join it was granted for has gone through. */
export async function clearJoinApproval(roomId: string, userId: string): Promise<void> {
	await deleteKeyInRedis(approvalKey(roomId, userId));
}
