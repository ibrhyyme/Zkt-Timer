// Friendly Room role hierarchy.
//
// OWNER > MODERATOR > PARTICIPANT. A moderation action is only allowed against a
// strictly lower rank, which is what keeps a moderator from kicking the owner (or
// another moderator). Ownership transfer is the only way to hand that immunity over:
// once the owner transfers, the previous owner drops to PARTICIPANT and can be
// kicked like anyone else.
//
// Shared by client (UI gating) and server (enforcement) so both sides read the same
// rules from one source. Site admins bypass this hierarchy entirely.

export enum FriendlyRoomRole {
    PARTICIPANT = 0,
    MODERATOR = 1,
    OWNER = 2,
}

export function getFriendlyRoomRole(
    ownerId: string | null | undefined,
    userId: string | null | undefined,
    isModerator: boolean | null | undefined
): FriendlyRoomRole {
    if (!userId) return FriendlyRoomRole.PARTICIPANT;
    if (ownerId && ownerId === userId) return FriendlyRoomRole.OWNER;
    return isModerator ? FriendlyRoomRole.MODERATOR : FriendlyRoomRole.PARTICIPANT;
}

// Kick / ban / unban a specific person.
export function canModerateRole(actor: FriendlyRoomRole, target: FriendlyRoomRole): boolean {
    if (actor < FriendlyRoomRole.MODERATOR) return false;
    return actor > target;
}

// Room-wide controls: start room, next scramble, edit settings, view the ban list.
export function canManageRoom(actor: FriendlyRoomRole): boolean {
    return actor >= FriendlyRoomRole.MODERATOR;
}

// Promote / demote moderators and transfer ownership — owner only, never a moderator.
// Otherwise a moderator could mint more moderators or hand the room away.
export function canAssignRoles(actor: FriendlyRoomRole): boolean {
    return actor === FriendlyRoomRole.OWNER;
}
