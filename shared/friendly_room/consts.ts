// Friendly Room Constants

export const FriendlyRoomConst = {
    // Room settings
    MIN_PLAYERS: 8,
    MAX_PLAYERS: 16,
    DEFAULT_MAX_PLAYERS: 8,
    DEFAULT_CUBE_TYPE: '333',

    // Timeouts
    ROOM_INACTIVE_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
    // Disconnect/away grace: bilgisayar kullanicilari sekme degistirince SIGNAL_AWAY tetikleniyor.
    // 4 dakika tab gezintisi, kisa internet kopmasi, telefon ekran kapatmasina tolerans saglar.
    PLAYER_DISCONNECT_GRACE_MS: 4 * 60 * 1000,

    // UI
    MAX_CHAT_MESSAGE_LENGTH: 500,
    MAX_ROOM_NAME_LENGTH: 50,
    MAX_PASSWORD_LENGTH: 50,
};

export const ALLOWED_CUBE_TYPES = [
    '222', '333', '444', '555', '666', '777',
    'clock', 'minx', 'pyram', 'skewb', 'sq1',
];
