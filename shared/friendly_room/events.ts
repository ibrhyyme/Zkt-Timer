// Friendly Room Socket Events

export enum FriendlyRoomClientEvent {
    // Client -> Server
    CREATE_ROOM = 'createFriendlyRoom',
    JOIN_ROOM = 'joinFriendlyRoom',
    LEAVE_ROOM = 'leaveFriendlyRoom',
    GET_ROOMS = 'getFriendlyRooms',
    GET_ROOM = 'getFriendlyRoom',
    TOGGLE_READY = 'friendlyRoomToggleReady',
    SUBMIT_SOLVE = 'friendlyRoomSubmitSolve',
    SEND_CHAT = 'friendlyRoomSendChat',
    NEXT_SCRAMBLE = 'friendlyRoomNextScramble',
    START_ROOM = 'friendlyRoomStart',
    SEND_STATUS = 'friendlyRoomSendStatus',
    UPDATE_ROOM = 'friendlyRoomUpdate',
    KICK_USER = 'friendlyRoomKickUser',
    BAN_USER = 'friendlyRoomBanUser',
    TOGGLE_SPECTATOR = 'friendlyRoomToggleSpectator',
    ADMIN_DELETE_ROOM = 'friendlyRoomAdminDelete',
    ADMIN_VIEW_ROOM = 'friendlyRoomAdminViewRoom',
    SIGNAL_AWAY = 'friendlyRoomSignalAway', // Tab hidden / minimized
    SIGNAL_BACK = 'friendlyRoomSignalBack', // Tab visible again
}

export enum FriendlyRoomServerEvent {
    // Server -> Client
    ROOMS_LIST = 'friendlyRoomsList',
    ROOM_CREATED = 'friendlyRoomCreated',
    ROOM_UPDATED = 'friendlyRoomUpdated',
    ROOM_DELETED = 'friendlyRoomDeleted',
    ROOM_DATA = 'friendlyRoomData',
    PLAYER_JOINED = 'friendlyRoomPlayerJoined',
    PLAYER_LEFT = 'friendlyRoomPlayerLeft',
    PLAYER_READY_CHANGED = 'friendlyRoomPlayerReadyChanged',
    SPECTATOR_CHANGED = 'friendlyRoomSpectatorChanged',
    SCRAMBLE_UPDATED = 'friendlyRoomScrambleUpdated',
    SOLVE_SUBMITTED = 'friendlyRoomSolveSubmitted',
    CHAT_MESSAGE = 'friendlyRoomChatMessage',
    ROOM_STARTED = 'friendlyRoomStarted',
    ADMIN_CHANGED = 'friendlyRoomAdminChanged',
    ADMIN_ROOM_DATA = 'friendlyRoomAdminRoomData',
    USER_STATUS = 'friendlyRoomUserStatus',
    ERROR = 'friendlyRoomError',
    NOTIFICATION = 'friendlyRoomNotification',
}

export const FriendlyRoomSocketRoom = {
    LOBBY: 'friendly_room_lobby',
    ROOM_PREFIX: 'friendly_room_',
};

export function getFriendlyRoomSocketRoom(roomId: string): string {
    return `${FriendlyRoomSocketRoom.ROOM_PREFIX}${roomId}`;
}
