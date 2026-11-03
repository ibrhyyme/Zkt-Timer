/**
 * Readable URL slugs, one rule for the whole app.
 *
 * A link that someone pastes into a chat should say what it opens. Two shapes exist, pick by
 * what the id does:
 *
 * - The name alone is the address (`/rooms/cuma-aksami-yarisi`): the slug is stored on the row
 *   and kept unique by the server. Fits things that are public anyway (friendly rooms).
 * - `<slug>-<id>` (`/trainer/sets/2-look-oll-DEURpUGSLE`): the id still finds the row and stays
 *   the access secret of a link-only share, so it cannot leave the URL. The slug is decoration:
 *   built from the current name, never stored, ignored on the way in. Names may repeat and may
 *   change; old links keep working because only the id is read.
 *
 * Neither shape ever puts a raw id alone into a newly built link unless the name has nothing a
 * slug can keep (a Chinese or emoji-only name).
 */

export const DEFAULT_SLUG_MAX_LENGTH = 48;

// Letters that NFKD does not split into a base letter plus accent. Turkish letters are mapped
// here instead of through toLocaleLowerCase('tr'), which would fold ASCII "I" into "ı".
// Cyrillic is transliterated because Russian is one of the app languages.
const CHAR_MAP: {[char: string]: string} = {
	ı: 'i',
	ß: 'ss',
	æ: 'ae',
	œ: 'oe',
	ø: 'o',
	ł: 'l',
	đ: 'd',
	ð: 'd',
	þ: 'th',
	а: 'a',
	б: 'b',
	в: 'v',
	г: 'g',
	ґ: 'g',
	д: 'd',
	е: 'e',
	ё: 'e',
	є: 'ye',
	ж: 'zh',
	з: 'z',
	и: 'i',
	і: 'i',
	ї: 'yi',
	й: 'y',
	к: 'k',
	л: 'l',
	м: 'm',
	н: 'n',
	о: 'o',
	п: 'p',
	р: 'r',
	с: 's',
	т: 't',
	у: 'u',
	ф: 'f',
	х: 'kh',
	ц: 'ts',
	ч: 'ch',
	ш: 'sh',
	щ: 'shch',
	ъ: '',
	ы: 'y',
	ь: '',
	э: 'e',
	ю: 'yu',
	я: 'ya',
};

/**
 * Lowercase ASCII words joined by single dashes (`Cuma Akşamı Yarışı` → `cuma-aksami-yarisi`).
 * Empty when nothing usable is left. A long name is cut at a word boundary when one falls in
 * the second half of the limit, otherwise hard at the limit.
 */
export function slugify(text: string | null | undefined, maxLength = DEFAULT_SLUG_MAX_LENGTH): string {
	let mapped = '';
	for (const ch of (text || '').toLowerCase()) mapped += CHAR_MAP[ch] ?? ch;

	const slug = mapped
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '') // combining accents left by NFKD (ç → c, ü → u, İ → i)
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	if (slug.length <= maxLength) return slug;

	const head = slug.slice(0, maxLength + 1);
	const lastDash = head.lastIndexOf('-');
	const cut = lastDash > maxLength / 2 ? head.slice(0, lastDash) : slug.slice(0, maxLength);
	return cut.replace(/-+$/g, '');
}

/**
 * `<slug>-<id>`, or the bare id when the name leaves no slug. The id must not contain a dash:
 * the last dash is what separates it again (idFromSlugWithId).
 */
export function slugWithId(name: string | null | undefined, id: string, maxLength = DEFAULT_SLUG_MAX_LENGTH): string {
	const slug = slugify(name, maxLength);
	return slug ? `${slug}-${id}` : id;
}

/** The id at the end of a `<slug>-<id>` segment; a bare id comes back unchanged. */
export function idFromSlugWithId(segment: string): string {
	return segment.slice(segment.lastIndexOf('-') + 1);
}
