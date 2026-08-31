// Friendly Room Socket Events

export enum FriendlyRoomClientEvent {
    // Client -> Server
    CREATE_ROOM = 'createFriendlyRoom',
    JOIN_ROOM = 'joinFriendlyRoom',
    LEAVE_ROOM = 'leaveFriendlyRoom',
    GET_ROOMS = 'getFriendlyRooms',
    GET_ROOM = 'getFriendlyRoom',
    RESOLVE_ROOM_KEY = 'friendlyRoomResolveKey', // slug-or-id URL segment -> room id
    TOGGLE_READY = 'friendlyRoomToggleReady',
    SUBMIT_SOLVE = 'friendlyRoomSubmitSolve',
    EDIT_SOLVE = 'friendlyRoomEditSolve', // Fix your own most recent solve (time / penalties)
    DELETE_SOLVE = 'friendlyRoomDeleteSolve', // Remove your own most recent solve
    SEND_CHAT = 'friendlyRoomSendChat',
    NEXT_SCRAMBLE = 'friendlyRoomNextScramble',
    START_ROOM = 'friendlyRoomStart',
    SEND_STATUS = 'friendlyRoomSendStatus',
    UPDATE_ROOM = 'friendlyRoomUpdate',
    KICK_USER = 'friendlyRoomKickUser',
    BAN_USER = 'friendlyRoomBanUser',
    TOGGLE_SPECTATOR = 'friendlyRoomToggleSpectator',
    ADMIN_DELETE_ROOM = 'friendlyRoomAdminDelete',
    DELETE_ROOM = 'friendlyRoomDelete',
    ADMIN_VIEW_ROOM = 'friendlyRoomAdminViewRoom',
    SIGNAL_AWAY = 'friendlyRoomSignalAway', // Tab hidden / minimized
    SIGNAL_BACK = 'friendlyRoomSignalBack', // Tab visible again
    GET_BANNED_USERS = 'friendlyRoomGetBannedUsers',
    UNBAN_USER = 'friendlyRoomUnbanUser',
    SET_MODERATOR = 'friendlyRoomSetModerator', // Owner: promote/demote a moderator
    TRANSFER_OWNERSHIP = 'friendlyRoomTransferOwnership', // Owner: hand the room to someone else
}

export enum FriendlyRoomServerEvent {
    // Server -> Client
    ROOMS_LIST = 'friendlyRoomsList',
    ROOM_CREATED = 'friendlyRoomCreated',
    ROOM_UPDATED = 'friendlyRoomUpdated',
    ROOM_DELETED = 'friendlyRoomDeleted',
    ROOM_DATA = 'friendlyRoomData',
    ROOM_KEY_RESOLVED = 'friendlyRoomKeyResolved',
    PLAYER_JOINED = 'friendlyRoomPlayerJoined',
    PLAYER_LEFT = 'friendlyRoomPlayerLeft',
    PLAYER_READY_CHANGED = 'friendlyRoomPlayerReadyChanged',
    SPECTATOR_CHANGED = 'friendlyRoomSpectatorChanged',
    SCRAMBLE_UPDATED = 'friendlyRoomScrambleUpdated',
    SOLVE_SUBMITTED = 'friendlyRoomSolveSubmitted',
    SOLVE_UPDATED = 'friendlyRoomSolveUpdated',
    SOLVE_DELETED = 'friendlyRoomSolveDeleted',
    CHAT_MESSAGE = 'friendlyRoomChatMessage',
    ROOM_STARTED = 'friendlyRoomStarted',
    ADMIN_CHANGED = 'friendlyRoomAdminChanged',
    MODERATOR_CHANGED = 'friendlyRoomModeratorChanged',
    ADMIN_ROOM_DATA = 'friendlyRoomAdminRoomData',
    USER_STATUS = 'friendlyRoomUserStatus',
    ERROR = 'friendlyRoomError',
    NOTIFICATION = 'friendlyRoomNotification',
    BANNED_USERS_LIST = 'friendlyRoomBannedUsersList',
    USER_UNBANNED = 'friendlyRoomUserUnbanned',
    SESSION_TAKEOVER = 'friendlyRoomSessionTakeover',
    ALREADY_IN_OTHER_ROOM = 'friendlyRoomAlreadyInOtherRoom',
    MY_ACTIVE_ROOM = 'friendlyRoomMyActiveRoom',
}

export const FriendlyRoomSocketRoom = {
    LOBBY: 'friendly_room_lobby',
    ROOM_PREFIX: 'friendly_room_',
};

export function getFriendlyRoomSocketRoom(roomId: string): string {
    return `${FriendlyRoomSocketRoom.ROOM_PREFIX}${roomId}`;
}
