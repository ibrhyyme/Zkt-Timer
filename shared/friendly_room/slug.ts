// Friendly Room URL slugs.
//
// Rooms are addressed by name in the URL (/rooms/cuma-aksami-yarisi) instead of the raw
// uuid. The slug is stored on the room and is unique across live rooms; duplicate names
// get a numeric suffix (-2, -3). Rooms are deleted when the last participant leaves, so
// a slug frees up again once the room is gone.
//
// The slug is generated once at creation and never changes, even if the room is renamed:
// a link shared right before a live session must keep working for the whole session.

export const MAX_ROOM_SLUG_LENGTH = 60;

// Fallback for names that leave nothing usable behind (emoji-only, CJK, punctuation).
export const ROOM_SLUG_FALLBACK = 'oda';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Turkish letters are mapped explicitly rather than through toLocaleLowerCase('tr'),
// which would fold ASCII "I" to "ı" and corrupt latin room names.
const TURKISH_MAP: { [char: string]: string } = {
    'ç': 'c', 'Ç': 'c',
    'ğ': 'g', 'Ğ': 'g',
    'ı': 'i', 'İ': 'i',
    'ö': 'o', 'Ö': 'o',
    'ş': 's', 'Ş': 's',
    'ü': 'u', 'Ü': 'u',
};

// True when the URL segment is a raw room id rather than a slug. Slugs can never take
// this shape (see slugifyRoomName), so the two namespaces cannot collide.
export function looksLikeRoomId(value: string | null | undefined): boolean {
    return !!value && UUID_PATTERN.test(value);
}

export function slugifyRoomName(name: string | null | undefined): string {
    const mapped = (name || '').replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => TURKISH_MAP[c] || c);

    const slug = mapped
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // drop combining accents left by NFD
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, MAX_ROOM_SLUG_LENGTH)
        .replace(/-+$/g, ''); // slicing can leave a trailing dash

    if (!slug) return ROOM_SLUG_FALLBACK;
    // A slug shaped like an id would make /rooms/<segment> ambiguous.
    if (UUID_PATTERN.test(slug)) return `${ROOM_SLUG_FALLBACK}-${slug}`.slice(0, MAX_ROOM_SLUG_LENGTH);
    return slug;
}

// URL segment for a room. Rooms created before slugs shipped have none and keep their id.
export function roomPath(room: { id: string; slug?: string | null }): string {
    return `/rooms/${room.slug || room.id}`;
}
