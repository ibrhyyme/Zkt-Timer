import { getPrisma } from '../database';
import {
    FriendlyRoomData,
    FriendlyRoomParticipantData,
    FriendlyRoomSolveData,
    CreateFriendlyRoomInput,
} from '../../shared/friendly_room';
import { FriendlyRoomConst } from '../../shared/friendly_room/consts';
import { PublicUserAccount } from '../schemas/UserAccount.schema';
import * as bcrypt from 'bcryptjs';

const prisma = () => getPrisma();

import { Scrambow } from 'scrambow';
import { generate222Scramble } from '../../client/util/cubes/scramble_222';

// Scramble definitions mapping our internal IDs to Scrambow types and lengths
const SCRAMBLE_MAP: Record<string, { type: string, length: number }> = {
    '222': { type: '222', length: 9 },
    '333': { type: '333', length: 20 },
    '333bl': { type: '333', length: 20 }, // Treated as 333 but with extra logic
    '333oh': { type: '333', length: 20 },
    '333mirror': { type: '333', length: 20 },
    '222oh': { type: '222', length: 9 },
    '444': { type: '444', length: 46 },
    '555': { type: '555', length: 60 },
    '666': { type: '666', length: 89 },
    '777': { type: '777', length: 100 },
    'pyram': { type: 'pyraminx', length: 11 }, // Adjusted length to standard
    'skewb': { type: 'skewb', length: 10 },    // Adjusted length to standard
    'sq1': { type: 'square1', length: 12 },    // Adjusted length to standard
    'clock': { type: 'clock', length: 0 },     // Clock usually handles its own length in scrambow or is fixed
    'minx': { type: 'megaminx', length: 70 },
};

function getBlindWideMove() {
    const moves = ['Uw', 'Lw', 'Rw', 'Fw'];
    const move = moves[Math.floor(Math.random() * moves.length)];
    const randState = Math.random();

    if (randState < 0.33) {
        return `${move}'`;
    } else if (randState < 0.66) {
        return `${move}2`;
    }

    return move;
}

// Robust scramble generator using Scrambow
function generateScrambleForCubeType(cubeType: string, subset?: string | null): string {
    const def = SCRAMBLE_MAP[cubeType];

    let scrambowType = def ? def.type : '333';
    const length = def ? def.length : 20;

    // Custom 2x2 subset scrambler (ported from cstimer)
    if (scrambowType === '222' && subset) {
        return generate222Scramble(subset);
    }

    // Use subset if provided, otherwise default to mapped type
    const typeToUse = subset || scrambowType;
    let scrambo = new Scrambow(typeToUse);

    if (!['pyraminx', 'clock', 'skewb'].includes(scrambowType) && !subset) {
        scrambo = scrambo.setLength(length);
    }

    const scrambleOb = scrambo.get();
    let scramble = scrambleOb[0].scramble_string;

    scramble = scramble.replace(/\s+/g, ' ').trim();

    if (cubeType === '333bl') {
        scramble += ' ' + getBlindWideMove();
    }

    return scramble;
}

// Create a new room
export async function createRoom(input: CreateFriendlyRoomInput, user: PublicUserAccount): Promise<FriendlyRoomData> {
    // Hash password if provided
    let hashedPassword = null;
    if (input.password) {
        hashedPassword = await bcrypt.hash(input.password, 10);
    }

    // Generate initial scramble
    // Generate initial scramble
    const initialScramble = generateScrambleForCubeType(
        input.cube_type || FriendlyRoomConst.DEFAULT_CUBE_TYPE
    );

    const room = await prisma().friendlyRoom.create({
        data: {
            name: input.name.slice(0, FriendlyRoomConst.MAX_ROOM_NAME_LENGTH),
            password: hashedPassword,
            cube_type: input.cube_type || FriendlyRoomConst.DEFAULT_CUBE_TYPE,

            max_players: Math.min(input.max_players || FriendlyRoomConst.DEFAULT_MAX_PLAYERS, FriendlyRoomConst.MAX_PLAYERS),
            is_private: input.is_private || false,
            current_scramble: initialScramble,
            scramble_index: 1,
            status: 'WAITING',
            created_by_id: user.id,
            original_creator_id: user.id,
            participants: {
                create: {
                    user_id: user.id,
                    is_ready: false,
                },
            },
        },
        include: {
            created_by: {
                select: { id: true, username: true },
            },
            participants: {
                include: {
                    user: { select: { id: true, username: true } },
                    solves: true,
                },
            },
        },
    });

    return mapRoomToData(room);
}

// Get room by ID
export async function getRoom(roomId: string) {
    const room = await prisma().friendlyRoom.findUnique({
        where: { id: roomId },
        include: {
            created_by: { select: { id: true, username: true } },
            participants: {
                include: {
                    user: { select: { id: true, username: true } },
                    solves: { orderBy: { scramble_index: 'asc' } },
                },
            },
        },
    });

    if (room && !('allowed_timer_types' in room)) {
        try {
            const result: any = await prisma().$queryRaw`SELECT allowed_timer_types, original_creator_id FROM "friendly_room" WHERE id = ${roomId}`;
            if (result && result.length > 0) {
                if (result[0].allowed_timer_types) (room as any).allowed_timer_types = result[0].allowed_timer_types;
                if (result[0].original_creator_id) (room as any).original_creator_id = result[0].original_creator_id;
            }
        } catch (e) {
            // Column might not exist yet
        }
    }

    return room;
}

// Get room formatted for client
export async function getRoomForClient(roomId: string): Promise<FriendlyRoomData | null> {
    const room = await getRoom(roomId);
    if (!room) return null;
    return mapRoomToData(room);
}

// Get all active rooms
export async function getAllActiveRooms(): Promise<FriendlyRoomData[]> {
    const rooms = await prisma().friendlyRoom.findMany({
        where: {
            status: { in: ['WAITING', 'ACTIVE'] },
        },
        include: {
            created_by: { select: { id: true, username: true } },
            participants: {
                include: {
                    user: { select: { id: true, username: true } },
                    solves: true,
                },
            },
        },
        orderBy: { created_at: 'desc' },
    });

    return rooms.map(mapRoomToData);
}

// Add participant to room
export async function addParticipant(
    roomId: string,
    user: PublicUserAccount,
    password?: string
): Promise<{ room: FriendlyRoomData | null; isNew: boolean; newAdminId?: string }> {
    const room = await getRoom(roomId);
    if (!room) {
        throw new Error('Room not found');
    }

    // Check if room is full
    if (room.participants.length >= room.max_players) {
        throw new Error('Room is full');
    }

    // Check if room is closed
    if (room.status === 'CLOSED') {
        throw new Error('Room is closed');
    }

    // Check if already in room
    const existingParticipant = room.participants.find((p) => p.user_id === user.id);
    if (existingParticipant) {
        return { room: mapRoomToData(room), isNew: false };
    }

    // Check password if room is private (skip if user is creator)
    if (room.is_private && room.password && room.created_by_id !== user.id) {
        if (!password) {
            throw new Error('Password required');
        }
        const isValid = await bcrypt.compare(password, room.password);
        if (!isValid) {
            throw new Error('Invalid password');
        }
    }

    // Add participant
    await prisma().friendlyRoomParticipant.create({
        data: {
            room_id: roomId,
            user_id: user.id,
            is_ready: false,
        },
    });

    // Check if the joining user is the original creator and restore admin rights
    let newAdminId: string | undefined;
    if ((room as any).original_creator_id === user.id && room.created_by_id !== user.id) {
        await prisma().friendlyRoom.update({
            where: { id: roomId },
            data: { created_by_id: user.id },
        });
        newAdminId = user.id;
    }

    const updatedRoom = await getRoom(roomId);
    return { room: mapRoomToData(updatedRoom), isNew: true, newAdminId };
}

// Remove participant from room
export async function removeParticipant(
    roomId: string,
    userId: string
): Promise<{ room: FriendlyRoomData | null; deleted: boolean; newAdminId?: string }> {
    const room = await getRoom(roomId);
    if (!room) {
        return { room: null, deleted: false };
    }

    // Remove participant
    await prisma().friendlyRoomParticipant.deleteMany({
        where: { room_id: roomId, user_id: userId },
    });

    // Check if room is now empty
    const remainingParticipants = await prisma().friendlyRoomParticipant.findMany({
        where: { room_id: roomId },
        orderBy: { joined_at: 'asc' },
    });

    if (remainingParticipants.length === 0) {
        // Delete room
        await prisma().friendlyRoom.delete({ where: { id: roomId } });
        return { room: null, deleted: true };
    }

    // Check if the leaving user was the admin (creator)
    let newAdminId: string | undefined;
    if (room.created_by_id === userId) {
        // Transfer admin to the next participant (oldest by join time)
        const newAdmin = remainingParticipants[0];
        await prisma().friendlyRoom.update({
            where: { id: roomId },
            data: { created_by_id: newAdmin.user_id },
        });
        newAdminId = newAdmin.user_id;
    }

    const updatedRoom = await getRoom(roomId);
    return { room: mapRoomToData(updatedRoom), deleted: false, newAdminId };
}

// Toggle participant ready state
export async function toggleParticipantReady(roomId: string, userId: string) {
    const participant = await prisma().friendlyRoomParticipant.findFirst({
        where: { room_id: roomId, user_id: userId },
    });

    if (!participant) return null;

    return prisma().friendlyRoomParticipant.update({
        where: { id: participant.id },
        data: { is_ready: !participant.is_ready },
    });
}

// Submit a solve
export async function submitSolve(roomId: string, userId: string, solveData: FriendlyRoomSolveData) {
    const participant = await prisma().friendlyRoomParticipant.findFirst({
        where: { room_id: roomId, user_id: userId },
    });

    if (!participant) return null;

    return prisma().friendlyRoomSolve.create({
        data: {
            room_id: roomId,
            participant_id: participant.id,
            scramble_index: solveData.scramble_index,
            time: solveData.time,
            dnf: solveData.dnf || false,
            plus_two: solveData.plus_two || false,
        },
    });
}

// Generate next scramble (only room creator can do this)
export async function nextScramble(roomId: string, userId: string): Promise<FriendlyRoomData | null> {
    const room = await getRoom(roomId);
    if (!room) return null;

    // Only creator can advance scramble
    if (room.created_by_id !== userId) return null;

    const newScramble = generateScrambleForCubeType(room.cube_type);

    await prisma().friendlyRoom.update({
        where: { id: roomId },
        data: {
            current_scramble: newScramble,
            scramble_index: room.scramble_index + 1,
        },
    });

    const updatedRoom = await getRoom(roomId);
    return mapRoomToData(updatedRoom);
}

// Start the room (only room creator)
export async function startRoom(roomId: string, userId: string): Promise<FriendlyRoomData | null> {
    const room = await getRoom(roomId);
    if (!room) return null;

    // Only creator can start
    if (room.created_by_id !== userId) return null;

    // Need at least 1 participant
    if (room.participants.length < 1) return null;

    await prisma().friendlyRoom.update({
        where: { id: roomId },
        data: { status: 'ACTIVE' },
    });

    const updatedRoom = await getRoom(roomId);
    return mapRoomToData(updatedRoom);
}

// Delete a room (creator or site admin)
export async function deleteRoom(roomId: string, userId: string, isAdmin: boolean = false): Promise<boolean> {
    const room = await getRoom(roomId);
    if (!room) return false;

    // Only creator or site admin can delete
    if (room.created_by_id !== userId && !isAdmin) return false;

    await prisma().friendlyRoom.delete({ where: { id: roomId } });
    return true;
}

// Update room settings (creator or site admin)
export async function updateRoom(
    roomId: string,
    userId: string,
    updates: { name?: string; is_private?: boolean; password?: string; allowed_timer_types?: string[], cube_type?: string },
    isAdmin: boolean = false
): Promise<FriendlyRoomData | null> {
    const room = await getRoom(roomId);
    if (!room) return null;

    // Only creator or site admin can update
    if (room.created_by_id !== userId && !isAdmin) return null;

    const data: any = {};
    if (updates.name) data.name = updates.name.slice(0, FriendlyRoomConst.MAX_ROOM_NAME_LENGTH);
    if (updates.is_private !== undefined) data.is_private = updates.is_private;
    if (updates.password && updates.password.length > 0) {
        data.password = await bcrypt.hash(updates.password, 10);
    } else if (updates.is_private === false) {
        // Clear password if switching to public
        data.password = null;
    }

    // Handle Cube Type Change (RESET ROOM)
    if (updates.cube_type && updates.cube_type !== room.cube_type) {
        data.cube_type = updates.cube_type;

        data.current_scramble = generateScrambleForCubeType(updates.cube_type);
        data.scramble_index = 1;

        // Reset all solves
        await prisma().friendlyRoomSolve.deleteMany({
            where: { room_id: roomId }
        });
    }

    // Note: allowed_timer_types is handled via raw query below to support outdated Prisma Client

    await prisma().friendlyRoom.update({
        where: { id: roomId },
        data,
    });

    if (updates.allowed_timer_types) {
        try {
            await prisma().$executeRaw`UPDATE "friendly_room" SET allowed_timer_types = ${updates.allowed_timer_types} WHERE id = ${roomId}`;
        } catch (e) {
            console.error('Raw update allowed_timer_types failed', e);
        }
    }

    const updatedRoom = await getRoom(roomId);
    return mapRoomToData(updatedRoom);
}

// Kick participant (creator or site admin)
export async function kickParticipant(roomId: string, requesterId: string, targetUserId: string, isAdmin: boolean = false): Promise<boolean> {
    const room = await getRoom(roomId);
    if (!room) return false;

    // Only creator or site admin can kick
    if (room.created_by_id !== requesterId && !isAdmin) return false;

    // Can't kick self (use leave instead) - unless admin is kicking from outside
    if (requesterId === targetUserId && !isAdmin) return false;

    const result = await removeParticipant(roomId, targetUserId);
    return !!result.room || result.deleted;
}

// Ban a participant (creator or site admin) - they cannot rejoin
export async function banParticipant(roomId: string, requesterId: string, targetUserId: string, isAdmin: boolean = false): Promise<boolean> {
    const room = await getRoom(roomId);
    if (!room) return false;

    // Only creator or site admin can ban
    if (room.created_by_id !== requesterId && !isAdmin) return false;

    // Can't ban self
    if (requesterId === targetUserId) return false;

    // Add to ban list
    await prisma().friendlyRoomBan.upsert({
        where: { room_id_user_id: { room_id: roomId, user_id: targetUserId } },
        update: {},
        create: { room_id: roomId, user_id: targetUserId },
    });

    // Also kick them
    const result = await removeParticipant(roomId, targetUserId);
    return !!result.room || result.deleted;
}

// Check if user is banned from room
export async function isUserBanned(roomId: string, userId: string): Promise<boolean> {
    const ban = await prisma().friendlyRoomBan.findUnique({
        where: { room_id_user_id: { room_id: roomId, user_id: userId } },
    });
    return !!ban;
}

// Toggle spectator mode
export async function toggleSpectator(roomId: string, userId: string): Promise<{ is_spectator: boolean } | null> {
    const participant = await prisma().friendlyRoomParticipant.findFirst({
        where: { room_id: roomId, user_id: userId },
    });

    if (!participant) return null;

    const updated = await prisma().friendlyRoomParticipant.update({
        where: { id: participant.id },
        data: { is_spectator: !participant.is_spectator },
    });

    return { is_spectator: updated.is_spectator };
}

// Map database room to client data format
function mapRoomToData(room: any): FriendlyRoomData {
    return {
        id: room.id,
        name: room.name,
        cube_type: room.cube_type,
        max_players: room.max_players,
        is_private: room.is_private,
        allowed_timer_types: room.allowed_timer_types || ['keyboard', 'stackmat', 'smart', 'gantimer', 'manual'],
        current_scramble: room.current_scramble,
        scramble_index: room.scramble_index,
        status: room.status,
        created_at: room.created_at.toISOString(),
        created_by: {
            id: room.created_by.id,
            username: room.created_by.username,
        },
        participants: room.participants.map((p: any): FriendlyRoomParticipantData => ({
            id: p.id,
            user_id: p.user_id,
            username: p.user.username,
            is_ready: p.is_ready,
            is_spectator: p.is_spectator || false,
            joined_at: p.joined_at.toISOString(),
            solves: p.solves?.map((s: any) => ({
                id: s.id,
                time: s.time,
                dnf: s.dnf,
                plus_two: s.plus_two,
                scramble_index: s.scramble_index,
                created_at: s.created_at.toISOString(),
            })) || [],
        })),
    };
}

