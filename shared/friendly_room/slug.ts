// Friendly Room URL slugs.
//
// Rooms are addressed by name in the URL (/rooms/cuma-aksami-yarisi) instead of the raw
// uuid. The slug is stored on the room and is unique across live rooms; duplicate names
// get a numeric suffix (-2, -3). Rooms are deleted when the last participant leaves, so
// a slug frees up again once the room is gone.
//
// The slug is generated once at creation and never changes, even if the room is renamed:
// a link shared right before a live session must keep working for the whole session.
//
// The letter rule itself is the app-wide one in shared/url_slug.ts.

import { slugify } from '../url_slug';

export const MAX_ROOM_SLUG_LENGTH = 60;

// Fallback for names that leave nothing usable behind (emoji-only, CJK, punctuation).
export const ROOM_SLUG_FALLBACK = 'oda';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// True when the URL segment is a raw room id rather than a slug. Slugs can never take
// this shape (see slugifyRoomName), so the two namespaces cannot collide.
export function looksLikeRoomId(value: string | null | undefined): boolean {
    return !!value && UUID_PATTERN.test(value);
}

export function slugifyRoomName(name: string | null | undefined): string {
    const slug = slugify(name, MAX_ROOM_SLUG_LENGTH);

    if (!slug) return ROOM_SLUG_FALLBACK;
    // A slug shaped like an id would make /rooms/<segment> ambiguous.
    if (UUID_PATTERN.test(slug)) return `${ROOM_SLUG_FALLBACK}-${slug}`.slice(0, MAX_ROOM_SLUG_LENGTH);
    return slug;
}

// URL segment for a room. Rooms created before slugs shipped have none and keep their id.
export function roomPath(room: { id: string; slug?: string | null }): string {
    return `/rooms/${room.slug || room.id}`;
}
