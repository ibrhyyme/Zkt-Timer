// Friendly Room Types

export interface FriendlyRoomData {
    id: string;
    // URL segment for this room. Null on rooms created before slugs shipped, which keep
    // addressing themselves by id.
    slug: string | null;
    name: string;
    cube_type: string;
    max_players: number;
    is_private: boolean;
    // JSON array of allowed types: 'keyboard', 'stackmat', 'smart', 'gantimer',
    // 'qiyitimer', 'virtual', 'manual'.
    // Rooms created before StackMat and QYtoys merged may still contain the retired
    // 'qiyiwired'; normalizeAllowedTimerTypes maps it on read rather than migrating
    // the stored rows.
    allowed_timer_types: string[];
    // Owner/moderator switch for GIFs in this room's chat (see shared/gif.ts).
    gifs_enabled: boolean;
    current_scramble: string | null;
    scramble_index: number;
    status: FriendlyRoomStatus;
    created_at: string;
    created_by: FriendlyRoomUser;
    participants: FriendlyRoomParticipantData[];
    scramble_history: FriendlyRoomScrambleHistoryEntry[];
}

export interface FriendlyRoomScrambleHistoryEntry {
    scramble_index: number;
    scramble: string;
}

export interface FriendlyRoomUser {
    id: string;
    username: string;
}

export interface FriendlyRoomParticipantData {
    id: string;
    user_id: string;
    username: string;
    is_ready: boolean;
    is_spectator: boolean;
    is_moderator: boolean;
    joined_at: string;
    current_solve?: FriendlyRoomSolveData;
    solves: FriendlyRoomSolveData[];
}

export interface FriendlyRoomSolveData {
    id?: string;
    time: number;
    dnf: boolean;
    plus_two: boolean;
    scramble_index: number;
    created_at?: string;
    // True once the owner has corrected this solve after saving it. Shown as a pencil
    // marker in the room table so a corrected result never looks like an original one.
    edited?: boolean;
}

// Payload for EDIT_SOLVE. `time` is always the raw time in seconds: the +2 is applied at
// display time, and a DNF keeps its time so unchecking DNF restores the original result.
export interface EditFriendlyRoomSolveInput {
    solve_id: string;
    time: number;
    dnf: boolean;
    plus_two: boolean;
}

export interface FriendlyRoomChatMessage {
    id: string;
    user_id: string;
    username: string;
    message: string;
    /** A GIF line carries an empty `message` and these two (see shared/gif.ts). */
    gif_provider?: string | null;
    gif_id?: string | null;
    created_at: string;
}

/** Why a GIF did not go out: the room has them off, or the sender is cooling down. */
export interface FriendlyRoomGifBlocked {
    reason: 'disabled' | 'cooldown';
    /** Seconds until the sender may post a GIF again; 0 for 'disabled'. */
    retry_after: number;
}

export type FriendlyRoomStatus = 'WAITING' | 'ACTIVE' | 'CLOSED';

export interface CreateFriendlyRoomInput {
    name: string;
    password?: string;
    cube_type: string;
    max_players: number;
    is_private: boolean;
}

export interface JoinFriendlyRoomInput {
    room_id: string;
    password?: string;
}

/** A person waiting to be let into a full room, as the owner and moderators see it. */
export interface FriendlyRoomJoinRequestData {
    user_id: string;
    username: string;
    requested_at: number;
}

export interface JoinRequestsPayload {
    room_id: string;
    requests: FriendlyRoomJoinRequestData[];
}

export interface RespondJoinRequestInput {
    room_id: string;
    user_id: string;
    accept: boolean;
}

export interface JoinRequestResolvedPayload {
    room_id: string;
    accepted: boolean;
}

export interface SessionTakeoverPayload {
    room_id: string;
    room_name: string;
}

export interface AlreadyInOtherRoomPayload {
    current_room_id: string;
    current_room_slug: string | null;
    current_room_name: string;
}

export interface MyActiveRoomPayload {
    room_id: string | null;
}
