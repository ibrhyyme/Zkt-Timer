import { getPrisma } from '../database';
import { FriendlyRoomChatMessage, FriendlyRoomConst } from '../../shared/friendly_room';
import { PublicUserAccount } from '../schemas/UserAccount.schema';
import { isValidGifRef } from '../../shared/gif';

const prisma = () => getPrisma();

export interface ChatGifRef {
    provider: string;
    id: string;
}

/** False when the owner or a moderator has switched GIFs off in this room. */
export async function roomAllowsGifs(roomId: string): Promise<boolean> {
    const room = await prisma().friendlyRoom.findUnique({
        where: { id: roomId },
        select: { gifs_enabled: true },
    });
    return Boolean(room?.gifs_enabled);
}

export async function sendChatMessage(
    roomId: string,
    user: PublicUserAccount,
    message: string,
    gif?: ChatGifRef | null
): Promise<FriendlyRoomChatMessage | null> {
    // A GIF line is the GIF alone: no caption, and only a well-formed provider id,
    // because every reader's device puts it into a request URL.
    if (gif && !isValidGifRef(gif.provider, gif.id)) {
        return null;
    }

    // Validate message
    if (!gif && (!message || message.trim().length === 0)) {
        return null;
    }

    // Truncate message if too long
    const cleanMessage = gif ? '' : message.slice(0, FriendlyRoomConst.MAX_CHAT_MESSAGE_LENGTH).trim();

    // Check if user is in room
    const participant = await prisma().friendlyRoomParticipant.findFirst({
        where: { room_id: roomId, user_id: user.id },
    });

    if (!participant) {
        return null;
    }

    // Enforced here as well as in the socket handler, so no other caller can post a GIF
    // into a room that has them off.
    if (gif && !(await roomAllowsGifs(roomId))) {
        return null;
    }

    // Create chat message
    const chatMessage = await prisma().friendlyRoomChat.create({
        data: {
            room_id: roomId,
            user_id: user.id,
            message: cleanMessage,
            gif_provider: gif?.provider ?? null,
            gif_id: gif?.id ?? null,
        },
    });

    return {
        id: chatMessage.id,
        user_id: user.id,
        username: user.username,
        message: cleanMessage,
        gif_provider: chatMessage.gif_provider,
        gif_id: chatMessage.gif_id,
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
            username: m.user?.username ?? 'Silinmis kullanici',
            message: m.message,
            gif_provider: m.gif_provider,
            gif_id: m.gif_id,
            created_at: m.created_at.toISOString(),
        }));
}
