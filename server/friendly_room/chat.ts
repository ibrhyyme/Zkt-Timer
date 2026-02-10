import { getPrisma } from '../database';
import { FriendlyRoomChatMessage, FriendlyRoomConst } from '../../shared/friendly_room';
import { PublicUserAccount } from '../schemas/UserAccount.schema';

const prisma = () => getPrisma();

export async function sendChatMessage(
    roomId: string,
    user: PublicUserAccount,
    message: string
): Promise<FriendlyRoomChatMessage | null> {
    // Validate message
    if (!message || message.trim().length === 0) {
        return null;
    }

    // Truncate message if too long
    const cleanMessage = message.slice(0, FriendlyRoomConst.MAX_CHAT_MESSAGE_LENGTH).trim();

    // Check if user is in room
    const participant = await prisma().friendlyRoomParticipant.findFirst({
        where: { room_id: roomId, user_id: user.id },
    });

    if (!participant) {
        return null;
    }

    // Create chat message
    const chatMessage = await prisma().friendlyRoomChat.create({
        data: {
            room_id: roomId,
            user_id: user.id,
            message: cleanMessage,
        },
    });

    return {
        id: chatMessage.id,
        user_id: user.id,
        username: user.username,
        message: cleanMessage,
        created_at: chatMessage.created_at.toISOString(),
    };
}

export async function getChatMessages(roomId: string, limit = 50): Promise<FriendlyRoomChatMessage[]> {
    const messages = await prisma().friendlyRoomChat.findMany({
        where: { room_id: roomId },
        include: {
            user: { select: { id: true, username: true } },
        },
        orderBy: { created_at: 'desc' },
        take: limit,
    });

    return messages
        .reverse()
        .map((m) => ({
            id: m.id,
            user_id: m.user_id,
            username: m.user.username,
            message: m.message,
            created_at: m.created_at.toISOString(),
        }));
}
