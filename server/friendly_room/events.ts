import { Socket } from 'socket.io';
import { getSocketIO } from '../match/init';
import { getDetailedClientInfo, joinRoom, leaveRoom } from '../match/util';
import {
    FriendlyRoomClientEvent,
    FriendlyRoomServerEvent,
    FriendlyRoomSocketRoom,
    getFriendlyRoomSocketRoom,
    CreateFriendlyRoomInput,
    JoinFriendlyRoomInput,
    FriendlyRoomSolveData,
} from '../../shared/friendly_room';
import {
    createRoom,
    getAllActiveRooms,
    addParticipant,
    removeParticipant,
    toggleParticipantReady,
    submitSolve,
    nextScramble,
    startRoom,
    getRoomForClient,
    updateRoom,
    kickParticipant,
    banParticipant,
    isUserBanned,
    toggleSpectator,
    deleteRoom,
} from './room_manager';
import { sendChatMessage } from './chat';
import { logger } from '../services/logger';

// Helper to get untyped socket.io server for friendly room events
const io = (): any => getSocketIO();

// Grace period timers: userID -> Timeout
const disconnectTimers = new Map<string, NodeJS.Timeout>();

export function listenForFriendlyRoomEvents(client: Socket) {
    // Generic join/leave room for Lobby updates
    client.on('joinRoom', (roomName: string) => {
        if (roomName === FriendlyRoomSocketRoom.LOBBY) {
            joinRoom(client, roomName);
        }
    });

    client.on('leaveRoom', (roomName: string) => {
        if (roomName === FriendlyRoomSocketRoom.LOBBY) {
            leaveRoom(client, roomName);
        }
    });

    // Get all rooms
    client.on(FriendlyRoomClientEvent.GET_ROOMS, async () => {
        try {
            // Also join the lobby room for updates
            joinRoom(client, FriendlyRoomSocketRoom.LOBBY);

            const rooms = await getAllActiveRooms();
            client.emit(FriendlyRoomServerEvent.ROOMS_LIST, rooms);
        } catch (error) {
            logger.error('Error getting friendly rooms', { error });
            client.emit(FriendlyRoomServerEvent.ERROR, 'Could not fetch rooms');
        }
    });

    // Get single room
    client.on(FriendlyRoomClientEvent.GET_ROOM, async (roomId: string) => {
        try {
            const room = await getRoomForClient(roomId);
            if (room) {
                client.emit(FriendlyRoomServerEvent.ROOM_DATA, room);
            } else {
                client.emit(FriendlyRoomServerEvent.ERROR, 'Room not found');
            }
        } catch (error) {
            logger.error('Error getting friendly room', { error, roomId });
            client.emit(FriendlyRoomServerEvent.ERROR, 'Could not fetch room');
        }
    });

    // Create room
    client.on(FriendlyRoomClientEvent.CREATE_ROOM, async (input: CreateFriendlyRoomInput) => {
        try {
            const { user } = await getDetailedClientInfo(client);
            if (!user) {
                client.emit(FriendlyRoomServerEvent.ERROR, 'Must be logged in to create a room');
                return;
            }

            // Cancel any pending disconnect timer for this user
            if (disconnectTimers.has(user.id)) {
                clearTimeout(disconnectTimers.get(user.id)!);
                disconnectTimers.delete(user.id);
            }

            // Cache user ID for disconnect handling
            (client as any).userId = user.id;

            const room = await createRoom(input, user);
            const socketRoom = getFriendlyRoomSocketRoom(room.id);

            // Join the socket room
            joinRoom(client, socketRoom);

            // Notify creator
            client.emit(FriendlyRoomServerEvent.ROOM_CREATED, room);

            // Notify lobby
            const updatedRooms = await getAllActiveRooms();
            io().to(FriendlyRoomSocketRoom.LOBBY).emit(FriendlyRoomServerEvent.ROOMS_LIST, updatedRooms);
        } catch (error) {
            logger.error('Error creating friendly room', { error });
            client.emit(FriendlyRoomServerEvent.ERROR, 'Could not create room');
        }
    });

    // Join room
    client.on(FriendlyRoomClientEvent.JOIN_ROOM, async (input: JoinFriendlyRoomInput) => {
        try {
            const { user } = await getDetailedClientInfo(client);
            if (!user) {
                client.emit(FriendlyRoomServerEvent.ERROR, 'Must be logged in to join a room');
                return;
            }

            // Cancel any pending disconnect timer for this user
            if (disconnectTimers.has(user.id)) {
                clearTimeout(disconnectTimers.get(user.id)!);
                disconnectTimers.delete(user.id);
            }

            // Cache user ID for disconnect handling
            (client as any).userId = user.id;

            // Check if user is banned from this room
            const banned = await isUserBanned(input.room_id, user.id);
            if (banned) {
                client.emit(FriendlyRoomServerEvent.ERROR, 'Bu odadan yasaklandınız');
                return;
            }

            const result = await addParticipant(input.room_id, user, input.password);
            if (!result.room) {
                client.emit(FriendlyRoomServerEvent.ERROR, 'Could not join room');
                return;
            }

            const socketRoom = getFriendlyRoomSocketRoom(result.room.id);

            // Join the socket room
            joinRoom(client, socketRoom);

            // Send room data to joining user
            client.emit(FriendlyRoomServerEvent.ROOM_DATA, result.room);

            // Sticky Admin: Notify everyone if admin changed
            if (result.newAdminId) {
                io().to(socketRoom).emit(FriendlyRoomServerEvent.ADMIN_CHANGED, {
                    room_id: result.room.id,
                    new_admin_id: result.newAdminId,
                });
            }

            // Only notify other participants if this is a new participant
            if (result.isNew) {
                const participant = result.room.participants.find((p) => p.user_id === user.id);
                // Emit to others in the room (not the joining user)
                client.to(socketRoom).emit(FriendlyRoomServerEvent.PLAYER_JOINED, {
                    room_id: result.room.id,
                    participant,
                });

                // NOTIFICATION: User Joined
                io().to(socketRoom).emit(FriendlyRoomServerEvent.NOTIFICATION, {
                    type: 'JOIN',
                    message: `${user.username} katıldı`
                });

                // Update lobby
                const updatedRooms = await getAllActiveRooms();
                io().to(FriendlyRoomSocketRoom.LOBBY).emit(FriendlyRoomServerEvent.ROOMS_LIST, updatedRooms);
            } else {
                // User is reconnecting (rejoining) - Clear DISCONNECTED status
                const socketRoom = getFriendlyRoomSocketRoom(result.room.id);
                io().to(socketRoom).emit(FriendlyRoomServerEvent.USER_STATUS, {
                    room_id: result.room.id,
                    user_id: user.id,
                    status: 'IDLE',
                });
            }
        } catch (error) {
            logger.error('Error joining friendly room', { error });
            client.emit(FriendlyRoomServerEvent.ERROR, (error as Error).message || 'Could not join room');
        }
    });

    // Leave room
    client.on(FriendlyRoomClientEvent.LEAVE_ROOM, async (roomId: string) => {
        try {
            const { user } = await getDetailedClientInfo(client);
            if (!user) return;

            const result = await removeParticipant(roomId, user.id);
            const socketRoom = getFriendlyRoomSocketRoom(roomId);

            // Leave the socket room
            leaveRoom(client, socketRoom);

            if (result.deleted) {
                // Room was deleted (no more participants)
                io().to(socketRoom).emit(FriendlyRoomServerEvent.ROOM_DELETED, roomId);
            } else if (result.room) {
                // Notify remaining participants
                io().to(socketRoom).emit(FriendlyRoomServerEvent.PLAYER_LEFT, {
                    room_id: roomId,
                    user_id: user.id,
                });

                // NOTIFICATION: User Left
                io().to(socketRoom).emit(FriendlyRoomServerEvent.NOTIFICATION, {
                    type: 'LEAVE',
                    message: `${user.username} ayrıldı`
                });

                // If admin changed, notify everyone
                if (result.newAdminId) {
                    io().to(socketRoom).emit(FriendlyRoomServerEvent.ADMIN_CHANGED, {
                        room_id: roomId,
                        new_admin_id: result.newAdminId,
                    });
                }
            }

            // Update lobby
            const updatedRooms = await getAllActiveRooms();
            io().to(FriendlyRoomSocketRoom.LOBBY).emit(FriendlyRoomServerEvent.ROOMS_LIST, updatedRooms);

            // Check if remaining participants have finished the round
            if (result.room) {
                await checkAllSolvedAndNextScramble(roomId, io());
            }
        } catch (error) {
            logger.error('Error leaving friendly room', { error });
        }
    });

    // Toggle ready
    client.on(FriendlyRoomClientEvent.TOGGLE_READY, async (roomId: string) => {
        try {
            const { user } = await getDetailedClientInfo(client);
            if (!user) return;

            const result = await toggleParticipantReady(roomId, user.id);
            if (result) {
                const socketRoom = getFriendlyRoomSocketRoom(roomId);
                io().to(socketRoom).emit(FriendlyRoomServerEvent.PLAYER_READY_CHANGED, {
                    room_id: roomId,
                    user_id: user.id,
                    is_ready: result.is_ready,
                });
            }
        } catch (error) {
            logger.error('Error toggling ready state', { error });
        }
    });

    // Submit solve
    client.on(FriendlyRoomClientEvent.SUBMIT_SOLVE, async (roomId: string, solveData: FriendlyRoomSolveData) => {
        try {
            const { user } = await getDetailedClientInfo(client);
            if (!user) return;

            const solve = await submitSolve(roomId, user.id, solveData);
            if (solve) {
                const socketRoom = getFriendlyRoomSocketRoom(roomId);
                io().to(socketRoom).emit(FriendlyRoomServerEvent.SOLVE_SUBMITTED, {
                    room_id: roomId,
                    user_id: user.id,
                    solve,
                });

                // Check if all competing (non-spectator) participants have solved this scramble
                await checkAllSolvedAndNextScramble(roomId, io());
            }
        } catch (error) {
            logger.error('Error submitting solve', { error });
        }
    });

    // Send chat message
    client.on(FriendlyRoomClientEvent.SEND_CHAT, async (roomId: string, message: string) => {
        try {
            const { user } = await getDetailedClientInfo(client);
            if (!user) return;

            const chatMessage = await sendChatMessage(roomId, user, message);
            if (chatMessage) {
                const socketRoom = getFriendlyRoomSocketRoom(roomId);
                io().to(socketRoom).emit(FriendlyRoomServerEvent.CHAT_MESSAGE, chatMessage);
            }
        } catch (error) {
            logger.error('Error sending chat message', { error });
        }
    });

    // Next scramble (only room creator)
    client.on(FriendlyRoomClientEvent.NEXT_SCRAMBLE, async (roomId: string) => {
        try {
            const { user } = await getDetailedClientInfo(client);
            if (!user) return;

            const room = await nextScramble(roomId, user.id);
            if (room) {
                const socketRoom = getFriendlyRoomSocketRoom(roomId);
                io().to(socketRoom).emit(FriendlyRoomServerEvent.SCRAMBLE_UPDATED, {
                    room_id: roomId,
                    scramble: room.current_scramble,
                    scramble_index: room.scramble_index,
                });

                // NOTIFICATION: New Scramble
                io().to(socketRoom).emit(FriendlyRoomServerEvent.NOTIFICATION, {
                    type: 'INFO',
                    message: `Karıştırma ${room.scramble_index}`
                });
            }
        } catch (error) {
            logger.error('Error generating next scramble', { error });
        }
    });

    // Start room (only room creator)
    client.on(FriendlyRoomClientEvent.START_ROOM, async (roomId: string) => {
        try {
            const { user } = await getDetailedClientInfo(client);
            if (!user) return;

            const room = await startRoom(roomId, user.id);
            if (room) {
                const socketRoom = getFriendlyRoomSocketRoom(roomId);
                io().to(socketRoom).emit(FriendlyRoomServerEvent.ROOM_STARTED, {
                    room_id: roomId,
                    scramble: room.current_scramble,
                    scramble_index: room.scramble_index,
                });
            }
        } catch (error) {
            logger.error('Error starting room', { error });
            client.emit(FriendlyRoomServerEvent.ERROR, 'Could not start room');
        }
    });

    // Send user status (inspecting, solving, etc.) - OPTIMIZED: skip DB lookup
    client.on(FriendlyRoomClientEvent.SEND_STATUS, async (roomId: string, status: string) => {
        try {
            // Use cached user info from socket data if available to avoid DB hit
            const cachedUserId = (client as any).userId;
            if (cachedUserId) {
                const socketRoom = getFriendlyRoomSocketRoom(roomId);
                client.to(socketRoom).emit(FriendlyRoomServerEvent.USER_STATUS, {
                    room_id: roomId,
                    user_id: cachedUserId,
                    status,
                });
                return;
            }

            // Fallback to full lookup (first time)
            const { user } = await getDetailedClientInfo(client);
            if (!user) return;

            // Cache user ID for subsequent calls
            (client as any).userId = user.id;

            const socketRoom = getFriendlyRoomSocketRoom(roomId);
            // Broadcast status to all users in the room except sender
            client.to(socketRoom).emit(FriendlyRoomServerEvent.USER_STATUS, {
                room_id: roomId,
                user_id: user.id,
                status,
            });
        } catch (error) {
            logger.error('Error sending user status', { error });
        }
    });

    // Update room settings (room creator or site admin)
    client.on(FriendlyRoomClientEvent.UPDATE_ROOM, async (roomId: string, updates: { name?: string; is_private?: boolean; password?: string; allowed_timer_types?: string[], cube_type?: string }) => {
        try {
            const { user } = await getDetailedClientInfo(client);
            if (!user) return;

            const updatedRoom = await updateRoom(roomId, user.id, updates, user.admin === true);
            if (updatedRoom) {
                const socketRoom = getFriendlyRoomSocketRoom(roomId);
                // Notify everyone in the room of the new details
                io().to(socketRoom).emit(FriendlyRoomServerEvent.ROOM_DATA, updatedRoom);

                // Update lobby
                const rooms = await getAllActiveRooms();
                io().to(FriendlyRoomSocketRoom.LOBBY).emit(FriendlyRoomServerEvent.ROOMS_LIST, rooms);
            }
        } catch (error) {
            logger.error('Error updating room', { error });
            client.emit(FriendlyRoomServerEvent.NOTIFICATION, { type: 'error', message: 'Oda güncellenemedi (Veritabanı hatası olabilir).' });
        }
    });

    // Kick user (room creator or site admin)
    client.on(FriendlyRoomClientEvent.KICK_USER, async (roomId: string, targetUserId: string) => {
        try {
            const { user } = await getDetailedClientInfo(client);
            if (!user) return;

            const success = await kickParticipant(roomId, user.id, targetUserId, user.admin === true);
            if (success) {
                const socketRoom = getFriendlyRoomSocketRoom(roomId);

                // Notify everyone (including kicked user)
                io().to(socketRoom).emit(FriendlyRoomServerEvent.PLAYER_LEFT, {
                    room_id: roomId,
                    user_id: targetUserId,
                });

                // Update lobby
                const rooms = await getAllActiveRooms();
                io().to(FriendlyRoomSocketRoom.LOBBY).emit(FriendlyRoomServerEvent.ROOMS_LIST, rooms);

                // Check if remaining participants have finished the round
                await checkAllSolvedAndNextScramble(roomId, io());
            }
        } catch (error) {
            logger.error('Error kicking user', { error });
            client.emit(FriendlyRoomServerEvent.ERROR, 'Could not kick user');
        }
    });

    // Ban user (room creator or site admin) - cannot rejoin
    client.on(FriendlyRoomClientEvent.BAN_USER, async (roomId: string, targetUserId: string) => {
        try {
            const { user } = await getDetailedClientInfo(client);
            if (!user) return;

            const success = await banParticipant(roomId, user.id, targetUserId, user.admin === true);
            if (success) {
                const socketRoom = getFriendlyRoomSocketRoom(roomId);

                // Notify everyone (including banned user)
                io().to(socketRoom).emit(FriendlyRoomServerEvent.PLAYER_LEFT, {
                    room_id: roomId,
                    user_id: targetUserId,
                });

                // Update lobby
                const rooms = await getAllActiveRooms();
                io().to(FriendlyRoomSocketRoom.LOBBY).emit(FriendlyRoomServerEvent.ROOMS_LIST, rooms);

                // Check if remaining participants have finished the round
                await checkAllSolvedAndNextScramble(roomId, io());
            }
        } catch (error) {
            logger.error('Error banning user', { error });
            client.emit(FriendlyRoomServerEvent.ERROR, 'Could not ban user');
        }
    });

    // Toggle spectator mode
    client.on(FriendlyRoomClientEvent.TOGGLE_SPECTATOR, async (roomId: string) => {
        try {
            const { user } = await getDetailedClientInfo(client);
            if (!user) return;

            const result = await toggleSpectator(roomId, user.id);
            if (result) {
                const socketRoom = getFriendlyRoomSocketRoom(roomId);
                io().to(socketRoom).emit(FriendlyRoomServerEvent.SPECTATOR_CHANGED, {
                    room_id: roomId,
                    user_id: user.id,
                    is_spectator: result.is_spectator,
                });
            }
        } catch (error) {
            logger.error('Error toggling spectator mode', { error });
        }
    });

    // Admin delete room (site admins only)
    client.on(FriendlyRoomClientEvent.ADMIN_DELETE_ROOM, async (roomId: string) => {
        try {
            const { user } = await getDetailedClientInfo(client);

            logger.info('Admin delete room attempt', {
                roomId,
                userId: user?.id,
                isAdmin: user?.admin
            });

            if (!user) {
                client.emit(FriendlyRoomServerEvent.ERROR, 'Giriş yapmalısınız');
                return;
            }

            if (!user.admin) {
                client.emit(FriendlyRoomServerEvent.ERROR, 'Sadece adminler oda silebilir');
                return;
            }

            const success = await deleteRoom(roomId, user.id, true);

            logger.info('Admin delete room result', { roomId, success });

            if (success) {
                const socketRoom = getFriendlyRoomSocketRoom(roomId);

                // Notify everyone in the room that it was deleted
                io().to(socketRoom).emit(FriendlyRoomServerEvent.ROOM_DELETED, roomId);

                // Update lobby
                const rooms = await getAllActiveRooms();
                io().to(FriendlyRoomSocketRoom.LOBBY).emit(FriendlyRoomServerEvent.ROOMS_LIST, rooms);

                // Success feedback
                client.emit(FriendlyRoomServerEvent.ERROR, 'Oda başarıyla silindi');
            } else {
                client.emit(FriendlyRoomServerEvent.ERROR, 'Oda silinemedi - oda bulunamadı');
            }
        } catch (error) {
            logger.error('Error admin deleting room', { error });
            client.emit(FriendlyRoomServerEvent.ERROR, 'Oda silinirken hata oluştu');
        }
    });

    // Admin view room stats (site admins only - read-only, no join)
    client.on(FriendlyRoomClientEvent.ADMIN_VIEW_ROOM, async (roomId: string) => {
        try {
            const { user } = await getDetailedClientInfo(client);

            if (!user) {
                client.emit(FriendlyRoomServerEvent.ERROR, 'Giriş yapmalısınız');
                return;
            }

            if (!user.admin) {
                client.emit(FriendlyRoomServerEvent.ERROR, 'Sadece adminler odaları görüntüleyebilir');
                return;
            }

            const room = await getRoomForClient(roomId);
            if (!room) {
                client.emit(FriendlyRoomServerEvent.ERROR, 'Oda bulunamadı');
                return;
            }

            // Send room data to admin (participants, scramble index, etc.)
            client.emit(FriendlyRoomServerEvent.ADMIN_ROOM_DATA, {
                participants: room.participants,
                scrambleIndex: room.scramble_index,
                userStatuses: {}, // No live statuses for admin view
            });
        } catch (error) {
            logger.error('Error admin viewing room', { error });
            client.emit(FriendlyRoomServerEvent.ERROR, 'Oda görüntülenemedi');
        }
    });

    // Handle disconnect - automatically remove user from room when they close browser/tab
    client.on('disconnect', async () => {
        try {
            let user: any = null;
            try {
                const info = await getDetailedClientInfo(client);
                user = info.user;
            } catch (e) {
                if ((client as any).userId) {
                    user = { id: (client as any).userId, username: 'Unknown' };
                }
            }
            if (user) await startGracePeriod(user);
        } catch (error) {
            logger.error('Error handling disconnect in friendly room', { error });
        }
    });

    // Handle "Away" signal (Tab switch/minimize)
    client.on(FriendlyRoomClientEvent.SIGNAL_AWAY, async () => {
        try {
            const { user } = await getDetailedClientInfo(client);
            if (user) await startGracePeriod(user);
        } catch (error) {
            logger.error('Error handling away signal', { error });
        }
    });

    // Handle "Back" signal (Tab visible)
    client.on(FriendlyRoomClientEvent.SIGNAL_BACK, async () => {
        try {
            const { user } = await getDetailedClientInfo(client);
            if (user) await cancelGracePeriod(user);
        } catch (error) {
            logger.error('Error handling back signal', { error });
        }
    });
}

// Helper: Start Grace Period (Disconnect or Away)
async function startGracePeriod(user: any) {
    if (!user) return;

    // Reduced log level to debug to avoid spamming terminal during dev (frequent tab switches/HMR)
    logger.debug('Starting friendly room grace period', { userId: user.id, username: user.username });

    // Mark user as DISCONNECTED immediately in all their rooms
    const expireTime = Date.now() + 45000; // 45s from now
    try {
        const rooms = await getAllActiveRooms();
        for (const room of rooms) {
            const isInRoom = room.participants.some((p: any) => p.user_id === user.id);
            if (isInRoom) {
                const socketRoom = getFriendlyRoomSocketRoom(room.id);
                io().to(socketRoom).emit(FriendlyRoomServerEvent.USER_STATUS, {
                    room_id: room.id,
                    user_id: user.id,
                    status: `DISCONNECTED|${expireTime}`,
                });
            }
        }
    } catch (err) {
        logger.error('Error broadcasting disconnect status', { error: err });
    }

    // Cancel existing timer if any (restart it)
    if (disconnectTimers.has(user.id)) {
        clearTimeout(disconnectTimers.get(user.id)!);
    }

    // Start removal timer
    const timer = setTimeout(async () => {
        disconnectTimers.delete(user.id);
        try {
            const rooms = await getAllActiveRooms();
            for (const room of rooms) {
                const isInRoom = room.participants.some((p: any) => p.user_id === user.id);
                if (isInRoom) {
                    const result = await removeParticipant(room.id, user.id);
                    const socketRoom = getFriendlyRoomSocketRoom(room.id);

                    if (result.deleted) {
                        io().to(socketRoom).emit(FriendlyRoomServerEvent.ROOM_DELETED, room.id);
                    } else if (result.room) {
                        io().to(socketRoom).emit(FriendlyRoomServerEvent.PLAYER_LEFT, {
                            room_id: room.id,
                            user_id: user.id,
                        });

                        io().to(socketRoom).emit(FriendlyRoomServerEvent.NOTIFICATION, {
                            type: 'LEAVE',
                            message: `${user.username || 'Bir kullanıcı'} ayrıldı (bağlantı kesildi - zaman aşımı)`
                        });

                        if (result.newAdminId) {
                            io().to(socketRoom).emit(FriendlyRoomServerEvent.ADMIN_CHANGED, {
                                room_id: room.id,
                                new_admin_id: result.newAdminId,
                            });
                        }
                    }

                    const updatedRooms = await getAllActiveRooms();
                    io().to(FriendlyRoomSocketRoom.LOBBY).emit(FriendlyRoomServerEvent.ROOMS_LIST, updatedRooms);

                    // Check if remaining participants have finished the round
                    if (result.room) {
                        await checkAllSolvedAndNextScramble(room.id, io());
                    }
                }
            }
        } catch (innerError) {
            logger.error('Error handling disconnect timeout', { error: innerError });
        }
    }, 45000); // 45s

    disconnectTimers.set(user.id, timer);
}

// Helper: Cancel Grace Period (Reconnected or Back)
async function cancelGracePeriod(user: any) {
    if (!user) return;

    if (disconnectTimers.has(user.id)) {
        clearTimeout(disconnectTimers.get(user.id)!);
        disconnectTimers.delete(user.id);

        // Restore status to IDLE in all rooms
        try {
            const rooms = await getAllActiveRooms();
            for (const room of rooms) {
                const isInRoom = room.participants.some((p: any) => p.user_id === user.id);
                if (isInRoom) {
                    const socketRoom = getFriendlyRoomSocketRoom(room.id);
                    io().to(socketRoom).emit(FriendlyRoomServerEvent.USER_STATUS, {
                        room_id: room.id,
                        user_id: user.id,
                        status: 'IDLE',
                    });
                }
            }
        } catch (err) {
            logger.error('Error restoring status', { error: err });
        }
    }
}

// Join lobby for receiving room list updates
export function joinFriendlyRoomLobby(client: Socket) {
    joinRoom(client, FriendlyRoomSocketRoom.LOBBY);
}

// Leave lobby
export function leaveFriendlyRoomLobby(client: Socket) {
    leaveRoom(client, FriendlyRoomSocketRoom.LOBBY);
}

// Helper to check if everyone solved and advance
async function checkAllSolvedAndNextScramble(roomId: string, ioServer: any) {
    const room = await getRoomForClient(roomId);
    if (room) {
        const currentScrambleIndex = room.scramble_index;
        // Only check non-spectator participants
        const competingParticipants = room.participants.filter((p) => !p.is_spectator);

        // If no one is competing, do nothing (wait for someone to join/start?)
        if (competingParticipants.length === 0) return;

        const allSolved = competingParticipants.every((p) =>
            p.solves.some((s) => s.scramble_index === currentScrambleIndex)
        );

        if (allSolved) {
            // Auto-generate next scramble using the room creator's ID for auth
            // (Functionality should ideally allow system increment, but using creator is safe enough fallback)
            const updatedRoom = await nextScramble(roomId, room.created_by.id);
            if (updatedRoom) {
                const socketRoom = getFriendlyRoomSocketRoom(roomId);
                ioServer.to(socketRoom).emit(FriendlyRoomServerEvent.SCRAMBLE_UPDATED, {
                    room_id: roomId,
                    scramble: updatedRoom.current_scramble,
                    scramble_index: updatedRoom.scramble_index,
                });

                // NOTIFICATION: Auto Scramble
                ioServer.to(socketRoom).emit(FriendlyRoomServerEvent.NOTIFICATION, {
                    type: 'INFO',
                    message: `Karıştırma ${updatedRoom.scramble_index}`
                });
            }
        }
    }
}
