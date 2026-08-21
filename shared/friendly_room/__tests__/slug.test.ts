import { slugifyRoomName, looksLikeRoomId, roomPath, ROOM_SLUG_FALLBACK, MAX_ROOM_SLUG_LENGTH } from '../slug';

describe('slugifyRoomName', () => {
    it('lowercases and dashes a plain name', () => {
        expect(slugifyRoomName('Hizli Yarisma')).toBe('hizli-yarisma');
    });

    it('transliterates Turkish characters', () => {
        expect(slugifyRoomName('Cuma Akşamı Yarışı')).toBe('cuma-aksami-yarisi');
        expect(slugifyRoomName('ÇĞİÖŞÜ')).toBe('cgiosu');
        expect(slugifyRoomName('çğıöşü')).toBe('cgiosu');
    });

    // toLocaleLowerCase('tr') would fold ASCII "I" to "ı" and break latin names.
    it('does not apply Turkish case folding to ASCII letters', () => {
        expect(slugifyRoomName('BIG ROOM')).toBe('big-room');
        expect(slugifyRoomName('III')).toBe('iii');
    });

    it('strips latin accents', () => {
        expect(slugifyRoomName('Café Münchén')).toBe('cafe-munchen');
    });

    it('collapses punctuation and trims edge dashes', () => {
        expect(slugifyRoomName('  ---Test!! Room??  ')).toBe('test-room');
        expect(slugifyRoomName('a___b...c')).toBe('a-b-c');
    });

    it('keeps digits', () => {
        expect(slugifyRoomName('3x3 Sprint 2026')).toBe('3x3-sprint-2026');
    });

    it('falls back when nothing usable survives', () => {
        expect(slugifyRoomName('')).toBe(ROOM_SLUG_FALLBACK);
        expect(slugifyRoomName('   ')).toBe(ROOM_SLUG_FALLBACK);
        expect(slugifyRoomName('!!!')).toBe(ROOM_SLUG_FALLBACK);
        expect(slugifyRoomName('房间')).toBe(ROOM_SLUG_FALLBACK);
        expect(slugifyRoomName(null)).toBe(ROOM_SLUG_FALLBACK);
        expect(slugifyRoomName(undefined)).toBe(ROOM_SLUG_FALLBACK);
    });

    it('caps length without leaving a trailing dash', () => {
        const slug = slugifyRoomName('a'.repeat(40) + ' ' + 'b'.repeat(40));
        expect(slug.length).toBeLessThanOrEqual(MAX_ROOM_SLUG_LENGTH);
        expect(slug.endsWith('-')).toBe(false);
    });

    // A slug shaped like an id would make /rooms/<segment> ambiguous for the resolver.
    it('never produces an id-shaped slug', () => {
        const uuidName = '3f9a2c71-4b8e-4d2a-9f1c-77aa5b0e1234';
        const slug = slugifyRoomName(uuidName);
        expect(looksLikeRoomId(slug)).toBe(false);
        expect(slug.startsWith(ROOM_SLUG_FALLBACK)).toBe(true);
    });
});

describe('looksLikeRoomId', () => {
    it('accepts uuids in either case', () => {
        expect(looksLikeRoomId('3f9a2c71-4b8e-4d2a-9f1c-77aa5b0e1234')).toBe(true);
        expect(looksLikeRoomId('3F9A2C71-4B8E-4D2A-9F1C-77AA5B0E1234')).toBe(true);
    });

    it('rejects slugs and empty input', () => {
        expect(looksLikeRoomId('cuma-aksami-yarisi')).toBe(false);
        expect(looksLikeRoomId('test-2')).toBe(false);
        expect(looksLikeRoomId('')).toBe(false);
        expect(looksLikeRoomId(null)).toBe(false);
        expect(looksLikeRoomId(undefined)).toBe(false);
    });
});

describe('roomPath', () => {
    it('prefers the slug', () => {
        expect(roomPath({ id: 'abc', slug: 'cuma-yarisi' })).toBe('/rooms/cuma-yarisi');
    });

    it('falls back to the id for rooms created before slugs shipped', () => {
        expect(roomPath({ id: 'abc', slug: null })).toBe('/rooms/abc');
        expect(roomPath({ id: 'abc' })).toBe('/rooms/abc');
    });
});
