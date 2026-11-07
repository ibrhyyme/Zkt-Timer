// Klima Kavgası, server side. The climate of each room lives in Redis (one JSON per room),
// so any instance can read and change it; the Redis adapter carries the broadcasts. The
// rules themselves are pure functions in shared/friendly_room/climate.ts.
//
// Trust: who holds the remote and who is Pro are decided here, from the socket's user and
// the database. A client never says who it is, whether it is Pro or who won.

import { Socket } from 'socket.io';
import { getSocketIO } from '../services/socket';
import { getDetailedClientInfo, isClientInRoom } from '../services/socket_util';
import { createRedisKey, deleteKeyInRedis, getValueFromRedis, RedisNamespace, setKeyInRedis } from '../services/redis';
import { checkRateLimit } from '../services/rate_limit';
import { logger } from '../services/logger';
import { getPrisma } from '../database';
import { isPro, isProEnabled } from '../lib/pro';
import { getRoomForClient } from './room_manager';
import {
    ClimateAction,
    ClimateEventPayload,
    ClimateFan,
    ClimateReactionType,
    clampSetpoint,
    ClimateConst,
    createClimateState,
    decideRemoteAfterLeave,
    decideRemoteAfterRound,
    FriendlyRoomClimateClientEvent,
    FriendlyRoomClimatePayload,
    FriendlyRoomClimateServerEvent,
    FriendlyRoomClimateState,
    FriendlyRoomData,
    getFriendlyRoomSocketRoom,
    heatGainForRound,
    rankRound,
    reanchor,
} from '../../shared/friendly_room';

const io = (): any => getSocketIO();

// A room's climate outlives a quiet hour but not an abandoned room. Every write refreshes it.
const CLIMATE_TTL_SECONDS = 12 * 60 * 60;

function climateKey(roomId: string) {
    return createRedisKey(RedisNamespace.FRIENDLY_ROOM_CLIMATE, roomId);
}

async function loadClimate(roomId: string): Promise<FriendlyRoomClimateState> {
    const raw = await getValueFromRedis(climateKey(roomId));
    if (raw) {
        try {
            return JSON.parse(raw) as FriendlyRoomClimateState;
        } catch {
            // Corrupt entry: start over below.
        }
    }
    return createClimateState(roomId, Date.now());
}

async function saveClimate(state: FriendlyRoomClimateState): Promise<void> {
    await setKeyInRedis(climateKey(state.room_id), JSON.stringify(state), CLIMATE_TTL_SECONDS);
}

export async function deleteClimate(roomId: string): Promise<void> {
    try {
        await deleteKeyInRedis(climateKey(roomId));
    } catch (error) {
        logger.error('Error deleting room climate', { error, roomId });
    }
}

// Read-modify-write runs one at a time per room on this instance, so a round ending while
// the holder presses a key cannot lose either change.
const roomQueues = new Map<string, Promise<unknown>>();

function withRoomLock<T>(roomId: string, fn: () => Promise<T>): Promise<T> {
    const previous = roomQueues.get(roomId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(fn);
    roomQueues.set(roomId, next);
    next.finally(() => {
        if (roomQueues.get(roomId) === next) roomQueues.delete(roomId);
    }).catch(() => undefined);
    return next;
}

function toPayload(state: FriendlyRoomClimateState): FriendlyRoomClimatePayload {
    return { ...state, server_now: Date.now() };
}

function emitState(state: FriendlyRoomClimateState): void {
    io().to(getFriendlyRoomSocketRoom(state.room_id)).emit(FriendlyRoomClimateServerEvent.STATE, toPayload(state));
}

function emitEvents(roomId: string, events: ClimateEventPayload[]): void {
    const socketRoom = getFriendlyRoomSocketRoom(roomId);
    for (const event of events) io().to(socketRoom).emit(FriendlyRoomClimateServerEvent.EVENT, event);
}

/** Pro (or Premium, or everyone while Pro is switched off) among the given users. */
async function resolveProIds(userIds: string[]): Promise<Set<string>> {
    if (!userIds.length) return new Set();
    if (!isProEnabled()) return new Set(userIds);
    const users = await getPrisma().userAccount.findMany({
        where: { id: { in: userIds } },
        select: { id: true, is_pro: true, is_premium: true, pro_expires_at: true, premium_expires_at: true },
    });
    return new Set(users.filter((u) => isPro(u as any)).map((u) => u.id));
}

function usernameOf(room: FriendlyRoomData, userId: string | null | undefined): string | undefined {
    if (!userId) return undefined;
    return room.participants.find((p) => p.user_id === userId)?.username;
}

interface Membership {
    proIds: Set<string>;
    competingProIds: Set<string>;
}

async function readMembership(room: FriendlyRoomData): Promise<Membership> {
    const proIds = await resolveProIds(room.participants.map((p) => p.user_id));
    const competingProIds = new Set(
        room.participants.filter((p) => !p.is_spectator && proIds.has(p.user_id)).map((p) => p.user_id)
    );
    return { proIds, competingProIds };
}

/**
 * Bring the climate in line with who is in the room: the Pro list, a holder who left or
 * now only watches (rule 4), and no competing Pro at all (rules 4-5: the AC goes off).
 * Called after joins, leaves, kicks, bans, timeouts and spectator switches.
 */
export function refreshClimate(roomId: string, emitToRoom = true): Promise<void> {
    return withRoomLock(roomId, async () => {
        const room = await getRoomForClient(roomId);
        if (!room) {
            await deleteClimate(roomId);
            return;
        }

        const { proIds, competingProIds } = await readMembership(room);
        const now = Date.now();
        let state = reanchor(await loadClimate(roomId), now);
        const events: ClimateEventPayload[] = [];

        if (state.holder_id && !competingProIds.has(state.holder_id)) {
            const leaving = state.holder_id;
            const next = decideRemoteAfterLeave(leaving, state.last_ranking, competingProIds);
            state = { ...state, holder_id: next, swaps: next ? state.swaps + 1 : state.swaps };
            if (next) {
                events.push({ room_id: roomId, kind: 'holder_leave', target_id: next, target: usernameOf(room, next), at: now });
            }
        }

        if (competingProIds.size === 0) {
            if (state.ac_on) events.push({ room_id: roomId, kind: 'no_pro_off', at: now });
            state = { ...state, ac_on: false, holder_id: null };
        }

        state = { ...state, pro_user_ids: Array.from(proIds) };
        await saveClimate(state);
        if (emitToRoom) emitState(state);
        emitEvents(roomId, events);
    }).catch((error) => {
        logger.error('Error refreshing room climate', { error, roomId });
    });
}

/**
 * A round closed (the scramble moved on). `room` is the room after the advance, so its
 * solves include the closed round. Decides the remote (rules 2-3) and adds race heat (6).
 */
export function onRoundClosed(room: FriendlyRoomData, closedIndex: number): Promise<void> {
    return withRoomLock(room.id, async () => {
        const solves = room.participants.flatMap((p) =>
            p.solves
                .filter((s) => s.scramble_index === closedIndex)
                .map((s) => ({ user_id: p.user_id, time: s.time, dnf: s.dnf, plus_two: s.plus_two }))
        );
        const ranking = rankRound(solves);
        const { proIds, competingProIds } = await readMembership(room);
        const now = Date.now();
        let state = reanchor(await loadClimate(room.id), now);
        const events: ClimateEventPayload[] = [];

        state = {
            ...state,
            heat0: Math.min(ClimateConst.HEAT_MAX, state.heat0 + heatGainForRound(solves)),
            pro_user_ids: Array.from(proIds),
        };

        if (ranking.length) {
            // Only people still competing can take the remote.
            const eligibleRanking = ranking.filter((id) => room.participants.some((p) => p.user_id === id && !p.is_spectator));
            const previous = state.holder_id;
            const outcome = decideRemoteAfterRound(previous, eligibleRanking, competingProIds);

            if (outcome.kind === 'basic_win') {
                events.push({
                    room_id: room.id,
                    kind: 'basic_win',
                    winner_id: outcome.winner,
                    winner: usernameOf(room, outcome.winner),
                    holder: previous ? usernameOf(room, previous) ?? null : null,
                    at: now,
                });
            }

            if (outcome.holder && outcome.holder !== previous) {
                state = { ...state, holder_id: outcome.holder, swaps: previous ? state.swaps + 1 : state.swaps };
                events.push({
                    room_id: room.id,
                    kind: 'holder',
                    target_id: outcome.holder,
                    target: usernameOf(room, outcome.holder),
                    at: now,
                });
            }

            state = { ...state, last_ranking: eligibleRanking };
        }

        await saveClimate(state);
        emitState(state);
        emitEvents(room.id, events);
    }).catch((error) => {
        logger.error('Error closing room climate round', { error, roomId: room.id });
    });
}

async function rateLimited(action: string, userId: string, max: number, windowSeconds: number): Promise<boolean> {
    const { allowed } = await checkRateLimit(`friendly_room:climate:${action}:${userId}`, max, windowSeconds);
    return !allowed;
}

function isClimateAction(input: any): input is ClimateAction {
    if (!input || typeof input !== 'object') return false;
    if (input.action === 'power' || input.action === 'fan') return true;
    return input.action === 'setpoint' && typeof input.value === 'number' && Number.isFinite(input.value);
}

export function listenForClimateEvents(client: Socket): void {
    // The climate of the room this socket is in, on demand (mount, reconnect).
    client.on(FriendlyRoomClimateClientEvent.GET, async (roomId: string) => {
        try {
            if (typeof roomId !== 'string' || !roomId) return;
            if (!isClientInRoom(client, getFriendlyRoomSocketRoom(roomId))) return;
            const { user } = await getDetailedClientInfo(client);
            if (!user) return;
            if (await rateLimited('get', user.id, 30, 60)) return;
            const state = await loadClimate(roomId);
            client.emit(FriendlyRoomClimateServerEvent.STATE, toPayload(state));
        } catch (error) {
            logger.error('Error reading room climate', { error });
        }
    });

    // The holder presses a key on the remote.
    client.on(FriendlyRoomClimateClientEvent.SET, async (roomId: string, input: ClimateAction) => {
        try {
            if (typeof roomId !== 'string' || !roomId) return;
            if (!isClimateAction(input)) return;
            if (!isClientInRoom(client, getFriendlyRoomSocketRoom(roomId))) return;

            const { user } = await getDetailedClientInfo(client);
            if (!user) return;
            // Generous for key mashing, tight enough that a script cannot flood the room.
            if (await rateLimited('set', user.id, 20, 10)) return;

            await withRoomLock(roomId, async () => {
                const state0 = await loadClimate(roomId);
                if (state0.holder_id !== user.id) {
                    // Stale screen: show this client who really holds it.
                    client.emit(FriendlyRoomClimateServerEvent.STATE, toPayload(state0));
                    return;
                }

                // The holder must still be a competing Pro (Pro can lapse mid-room).
                const room = await getRoomForClient(roomId);
                const me = room?.participants.find((p) => p.user_id === user.id);
                if (!room || !me || me.is_spectator) return;
                const proIds = await resolveProIds([user.id]);
                if (!proIds.has(user.id)) {
                    client.emit(FriendlyRoomClimateServerEvent.STATE, toPayload(state0));
                    return;
                }

                const now = Date.now();
                let state = reanchor(state0, now);
                const base = { room_id: roomId, actor_id: user.id, actor: user.username, at: now };
                let event: ClimateEventPayload | null = null;

                if (input.action === 'power') {
                    state = { ...state, ac_on: !state.ac_on };
                    event = state.ac_on ? { ...base, kind: 'ac_on', value: state.setpoint } : { ...base, kind: 'ac_off' };
                } else if (input.action === 'setpoint') {
                    const value = clampSetpoint(input.value);
                    if (!state.ac_on) {
                        state = { ...state, ac_on: true, setpoint: value };
                        event = { ...base, kind: 'ac_on', value };
                    } else if (value !== state.setpoint) {
                        event = { ...base, kind: 'setpoint', value, from: state.setpoint };
                        state = { ...state, setpoint: value };
                    } else {
                        return;
                    }
                } else {
                    state = { ...state, fan: ((state.fan % 3) + 1) as ClimateFan };
                }

                await saveClimate(state);
                emitState(state);
                if (event) emitEvents(roomId, [event]);
            });
        } catch (error) {
            logger.error('Error changing room climate', { error });
        }
    });

    // "I'm cold" / "I'm boiling" from someone without the remote.
    client.on(FriendlyRoomClimateClientEvent.REACT, async (roomId: string, type: ClimateReactionType) => {
        try {
            if (typeof roomId !== 'string' || !roomId) return;
            if (type !== 'cold' && type !== 'hot') return;
            const socketRoom = getFriendlyRoomSocketRoom(roomId);
            if (!isClientInRoom(client, socketRoom)) return;

            const { user } = await getDetailedClientInfo(client);
            if (!user) return;
            if (await rateLimited('react', user.id, 3, 15)) return;

            const state = await loadClimate(roomId);
            if (state.holder_id === user.id) return;

            io().to(socketRoom).emit(FriendlyRoomClimateServerEvent.REACTION, {
                room_id: roomId,
                user_id: user.id,
                type,
                at: Date.now(),
            });
        } catch (error) {
            logger.error('Error sending room climate reaction', { error });
        }
    });
}
