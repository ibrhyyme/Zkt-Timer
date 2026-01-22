// Friendly Room Types

export interface FriendlyRoomData {
    id: string;
    name: string;
    cube_type: string;
    max_players: number;
    is_private: boolean;
    allowed_timer_types: string[]; // JSON array of allowed types: 'keyboard', 'stackmat', 'smart', 'gantimer'
    current_scramble: string | null;
    scramble_index: number;
    status: FriendlyRoomStatus;
    created_at: string;
    created_by: FriendlyRoomUser;
    participants: FriendlyRoomParticipantData[];
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
}

export interface FriendlyRoomChatMessage {
    id: string;
    user_id: string;
    username: string;
    message: string;
    created_at: string;
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
