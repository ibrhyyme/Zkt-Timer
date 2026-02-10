// Friendly Room Constants

export const FriendlyRoomConst = {
    // Room settings
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 16,
    DEFAULT_MAX_PLAYERS: 8,
    DEFAULT_CUBE_TYPE: '333',

    // Timeouts
    ROOM_INACTIVE_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
    PLAYER_DISCONNECT_GRACE_MS: 30 * 1000, // 30 seconds

    // UI
    MAX_CHAT_MESSAGE_LENGTH: 500,
    MAX_ROOM_NAME_LENGTH: 50,
    MAX_PASSWORD_LENGTH: 50,
};

export const ALLOWED_CUBE_TYPES = ['222', '333', '444', '555', '666', '777', 'skewb', 'pyram', 'sq1', 'clock', 'minx', '333mirror', '222oh', '333oh', '333bl', 'other'];
