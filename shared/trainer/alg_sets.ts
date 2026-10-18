// Algorithm sets: rules shared by the client (set screens, picker, study queue) and the
// server (AlgSet resolver, algorithm catalog). Design: .feedback/designs/trainer-sets.md
// sections 3 and 4.
//
// Pure and platform free: no Node or browser API, so both bundles import it as is.

import type {BuiltinPuzzleKey} from '../cube_puzzle';

// ---------------------------------------------------------------------------------------
// Visibility (design 3.3)
// ---------------------------------------------------------------------------------------

/**
 * private: only the owner (and staff for moderation).
 * link:    anyone with the link, never listed.
 * public:  listed in Community Sets.
 * Stored as a plain string, not a DB or GraphQL enum, so a later level is an additive change.
 */
export const ALG_SET_VISIBILITIES = ['private', 'link', 'public'] as const;

export type AlgSetVisibility = (typeof ALG_SET_VISIBILITIES)[number];

export const DEFAULT_ALG_SET_VISIBILITY: AlgSetVisibility = 'private';

const VISIBILITY_SET: ReadonlySet<string> = new Set(ALG_SET_VISIBILITIES);

export function isAlgSetVisibility(value: unknown): value is AlgSetVisibility {
	return typeof value === 'string' && VISIBILITY_SET.has(value);
}

/** Visibilities that open the set to people other than the owner; only these can be saved by others. */
export function isSharedVisibility(value: string | null | undefined): boolean {
	return value === 'link' || value === 'public';
}

// ---------------------------------------------------------------------------------------
// Limits (design 3.5, 4.5, 4.6). Same for Basic and Pro.
// ---------------------------------------------------------------------------------------

export const ALG_SET_LIMITS = {
	/** Sets one user may own. */
	MAX_SETS_PER_USER: 100,
	/** Items in one set. A full ZBLL (472) fits. */
	MAX_ITEMS_PER_SET: 500,
	/** Items accepted by one addAlgSetItems call. */
	MAX_ITEMS_PER_ADD: 500,
	/** Other people's sets one user may save. */
	MAX_SAVED_SETS_PER_USER: 300,
	NAME_MIN_LENGTH: 1,
	NAME_MAX_LENGTH: 60,
	DESCRIPTION_MAX_LENGTH: 500,
	DESCRIPTION_MAX_LINES: 6,
	/** Characters accepted as one algorithm text (isMoveSequence). */
	ALGORITHM_MAX_LENGTH: 200,
	/** Items returned in AlgSetSummary.preview. */
	PREVIEW_ITEMS: 4,
	/** Full sets kept on the device for offline study (design 9.3). */
	OFFLINE_CACHED_SETS: 20,
} as const;

/** Community list paging and search (design 4.6). */
export const ALG_SET_COMMUNITY = {
	DEFAULT_PAGE_SIZE: 24,
	MAX_PAGE_SIZE: 30,
	QUERY_MIN_LENGTH: 2,
	QUERY_MAX_LENGTH: 60,
} as const;

export const ALG_SET_COMMUNITY_SORTS = ['new', 'popular'] as const;

export type AlgSetCommunitySort = (typeof ALG_SET_COMMUNITY_SORTS)[number];

export function isAlgSetCommunitySort(value: unknown): value is AlgSetCommunitySort {
	return value === 'new' || value === 'popular';
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Rate limits for server/services/rate_limit.ts checkRateLimit (window in seconds).
 * Writes are refused when Redis is unreachable; reads pass (failOpen), design 4.5.
 */
export const ALG_SET_RATE_LIMITS = {
	CREATE: {max: 20, windowSeconds: HOUR},
	/** add, remove, reorder, update, reset code */
	WRITE: {max: 120, windowSeconds: MINUTE},
	SAVE: {max: 60, windowSeconds: HOUR},
	REPORT: {max: 10, windowSeconds: DAY},
	/** algSet and communityAlgSets, keyed by user when signed in and by IP otherwise. */
	READ: {max: 120, windowSeconds: MINUTE},
	/** Anonymous IP that gets this many NOT_FOUND in the window is locked to NOT_FOUND. */
	NOT_FOUND_LOCK: {max: 20, windowSeconds: MINUTE, lockSeconds: 10 * MINUTE},
	/** trainerLibrary full payloads (not "you already have it" answers), per IP. */
	LIBRARY: {max: 200, windowSeconds: HOUR},
	/**
	 * trainerLibraryAlternatives, per user. The client caches every category per library
	 * version, so a person studying never gets near these; walking all categories does.
	 */
	LIBRARY_ALTERNATIVES_HOUR: {max: 30, windowSeconds: HOUR},
	LIBRARY_ALTERNATIVES_DAY: {max: 80, windowSeconds: DAY},
} as const;

// ---------------------------------------------------------------------------------------
// Moderation (design 3.6, 4.2)
// ---------------------------------------------------------------------------------------

export const ALG_SET_REPORT_REASONS = ['inappropriate_text', 'wrong_algorithm', 'spam', 'other'] as const;

export type AlgSetReportReason = (typeof ALG_SET_REPORT_REASONS)[number];

export function isAlgSetReportReason(value: unknown): value is AlgSetReportReason {
	return typeof value === 'string' && (ALG_SET_REPORT_REASONS as readonly string[]).includes(value);
}

export const ALG_SET_MODERATION = {
	/** Open reports from distinct qualifying users that hide a set automatically. */
	AUTO_HIDE_REPORTS: 3,
	/** A reporter counts toward auto hide only with an account at least this old and verified. */
	AUTO_HIDE_MIN_ACCOUNT_AGE_DAYS: 7,
	AUTO_HIDE_REASON: 'auto_reports',
	/** Report.reason prefix; the admin screen translates the label from it. */
	REPORT_REASON_PREFIX: 'alg_set:',
	REPORT_NOTE_MAX_LENGTH: 500,
} as const;

// ---------------------------------------------------------------------------------------
// Share code (design 3.1). Generated on the server with crypto; the shape is shared so
// route parsing and the resolver reject garbage before touching the database.
// ---------------------------------------------------------------------------------------

export const ALG_SET_CODE_LENGTH = 10;
export const ALG_SET_CODE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const CODE_PATTERN = new RegExp(`^[0-9A-Za-z]{${ALG_SET_CODE_LENGTH}}$`);

export function isAlgSetCode(value: unknown): value is string {
	return typeof value === 'string' && CODE_PATTERN.test(value);
}

// ---------------------------------------------------------------------------------------
// Case identity (design 1.4, 6.2). A case name is unique inside its category, so
// `category::case_name` identifies a set row, a picker card and a queue entry.
// ---------------------------------------------------------------------------------------

export const CASE_KEY_SEPARATOR = '::';

export function algSetCaseKey(category: string, caseName: string): string {
	return `${category}${CASE_KEY_SEPARATOR}${caseName}`;
}

/** Inverse of algSetCaseKey. Category names never contain the separator; case names may not either. */
export function parseAlgSetCaseKey(key: string): {category: string; caseName: string} | null {
	const at = key.indexOf(CASE_KEY_SEPARATOR);
	if (at <= 0) return null;
	const caseName = key.slice(at + CASE_KEY_SEPARATOR.length);
	if (!caseName) return null;
	return {category: key.slice(0, at), caseName};
}

// ---------------------------------------------------------------------------------------
// Comma wrapped lists (design 3.1): AlgSet.categories ",OLL,PLL," and AlgSet.puzzles ",333,".
// Wrapping both ends lets one `contains ',OLL,'` filter match a whole entry.
// ---------------------------------------------------------------------------------------

/** Sorted, distinct, comma wrapped. Empty input gives ''. Values must not contain a comma. */
export function packCommaList(values: Iterable<string>): string {
	const distinct = Array.from(new Set(Array.from(values).filter((v) => !!v && v.indexOf(',') === -1)));
	if (distinct.length === 0) return '';
	distinct.sort();
	return `,${distinct.join(',')},`;
}

export function unpackCommaList(packed: string | null | undefined): string[] {
	if (!packed) return [];
	return packed.split(',').filter(Boolean);
}

/** The substring a `contains` filter looks for. */
export function commaListNeedle(value: string): string {
	return `,${value},`;
}

// ---------------------------------------------------------------------------------------
// Puzzle of a trainer category. Moved out of AlgorithmSelector.tsx so the picker, the set
// study queue and the server catalog use one rule.
// ---------------------------------------------------------------------------------------

/** Puzzle headings of the trainer, in display order. The trainer writes "3x3" (design 8.7). */
export const CUBE_TYPE_ORDER = ['3x3', '3x3 Roux', '2x2', '4x4', 'Pyraminx', 'Skewb', 'Square-1'] as const;

export type TrainerCubeType = (typeof CUBE_TYPE_ORDER)[number];

/** Categories that do not follow the name prefix convention. */
export const CATEGORY_CUBE_TYPE: Readonly<Record<string, TrainerCubeType>> = {
	'Sarah Intermediate': 'Skewb',
	'Sarah Advanced': 'Skewb',
	CMLL: '3x3 Roux',
	'2-Look CMLL': '3x3 Roux',
	'OH-CMLL': '3x3 Roux',
	'L6E-EO': '3x3 Roux',
	'L6E-EOLR': '3x3 Roux',
	SBLS: '3x3 Roux',
	EO4A: '3x3 Roux',
};

const CATEGORY_PREFIX_CUBE_TYPE: ReadonlyArray<[string, TrainerCubeType]> = [
	['2x2 ', '2x2'],
	['4x4 ', '4x4'],
	['Pyraminx ', 'Pyraminx'],
	['SQ1 ', 'Square-1'],
];

/** Puzzle heading of a category. Anything unknown is 3x3, as the selector always did. */
export function cubeTypeOfCategory(category: string): TrainerCubeType {
	const override = CATEGORY_CUBE_TYPE[category];
	if (override) return override;
	for (const [prefix, cubeType] of CATEGORY_PREFIX_CUBE_TYPE) {
		if (category.startsWith(prefix)) return cubeType;
	}
	return '3x3';
}

/** Trainer puzzle heading to the puzzle key of shared/cube_puzzle.ts. Roux is a 3x3. */
export const CUBE_TYPE_PUZZLE: Readonly<Record<TrainerCubeType, BuiltinPuzzleKey>> = {
	'3x3': '333',
	'3x3 Roux': '333',
	'2x2': '222',
	'4x4': '444',
	Pyraminx: 'pyram',
	Skewb: 'skewb',
	'Square-1': 'sq1',
};

/** Puzzle key of a trainer category (AlgSetItem.puzzle, AlgSet.puzzles). */
export function categoryPuzzle(category: string): BuiltinPuzzleKey {
	return CUBE_TYPE_PUZZLE[cubeTypeOfCategory(category)];
}

// ---------------------------------------------------------------------------------------
// Algorithm text (design 4.3)
// ---------------------------------------------------------------------------------------

// Quote lookalikes people paste from notes, chat apps and PDFs. Replaced before NFKC:
// NFKC turns U+00B4 into a space plus a combining accent.
const QUOTE_LOOKALIKES = /[‘’‛´`′ʹʼˈ＇]/g;

/**
 * Canonical form used to compare algorithm texts. Never removes a letter or a digit:
 * `Rw`, `2R2` and `U2'` survive as written (U2' and U2 stay different, trainer-bugs 2.8-n).
 *
 *   NFKC (full width letters and digits become ASCII), quote lookalikes to `'`,
 *   square brackets to parentheses, whitespace runs to one space, trimmed.
 */
export function canonAlg(text: string | null | undefined): string {
	if (!text) return '';
	return text
		.replace(QUOTE_LOOKALIKES, "'")
		.normalize('NFKC')
		.replace(QUOTE_LOOKALIKES, "'")
		.replace(/\[/g, '(')
		.replace(/\]/g, ')')
		.replace(/\s+/g, ' ')
		.trim();
}

// One move word per puzzle, before its suffix. Face turns, wide turns (`Rw`, lower case),
// slices, cube rotations; 4x4 also takes layer prefixes (`2R2`, `3Rw'`, `2-3Rw`).
const MOVE_BODY: Readonly<Record<string, string>> = {
	'333': "(?:[RLUDFB]w?|[rludfb]|[MES]|[xyz])",
	'222': "(?:[RLUDFB]w?|[rludfb]|[xyz])",
	'444': "(?:(?:\\d(?:-\\d)?)?(?:[RLUDFB]w?|[rludfb])|[MES]|[xyz])",
	pyram: "(?:[RLUB]|[rlub]|[xyz])",
	skewb: "(?:[RLUBFD]|[xyz])",
};

// Turn amount: `2`, `3`, `2'`, `'`, `'2`.
const MOVE_SUFFIX = "(?:\\d'?|'\\d?)?";

const MOVE_WORD: Readonly<Record<string, RegExp>> = Object.keys(MOVE_BODY).reduce(
	(acc, puzzle) => {
		acc[puzzle] = new RegExp(`^${MOVE_BODY[puzzle]}${MOVE_SUFFIX}$`);
		return acc;
	},
	{} as Record<string, RegExp>
);

// `(`, `)` with an optional repeat count (`(R U R' U')2`), or a run of other characters.
const TOKEN = /\(|\)(?:\d{1,2}'?)?|[^\s()]+/g;

// Square-1 after whitespace removal: slashes and `x,y` turns, the turn optionally in
// parentheses: "/ -3,0 / 3,3 /" and "/(0,3)/(-3,-3)/".
const SQ1_SEQUENCE = /^(?:\/|\(-?\d,-?\d\)|-?\d,-?\d)+$/;

/**
 * True when the text is a move sequence of that puzzle and nothing else: at most 200
 * characters after canonAlg, only the puzzle's move words, balanced parentheses, at least
 * one move. Accepts every algorithm and alternative in public/trainer/default-algs.json
 * (tested). Says nothing about whether the sequence solves a given case.
 */
export function isMoveSequence(text: string | null | undefined, puzzle: string): boolean {
	const alg = canonAlg(text);
	if (!alg || alg.length > ALG_SET_LIMITS.ALGORITHM_MAX_LENGTH) return false;

	if (puzzle === 'sq1') {
		return SQ1_SEQUENCE.test(alg.replace(/\s+/g, ''));
	}

	const word = MOVE_WORD[puzzle];
	if (!word) return false;

	const tokens = alg.match(TOKEN) || [];
	// Each open group remembers the move count when it opened, so an empty group is refused.
	const openedAt: number[] = [];
	let moves = 0;
	for (const token of tokens) {
		if (token === '(') {
			openedAt.push(moves);
		} else if (token[0] === ')') {
			const start = openedAt.pop();
			if (start === undefined || start === moves) return false;
		} else if (word.test(token)) {
			moves++;
		} else {
			return false;
		}
	}
	return openedAt.length === 0 && moves > 0;
}

// ---------------------------------------------------------------------------------------
// Set name and description (design 3.5, 3.6). The server cleans and checks; the edit sheet
// uses the same functions for its counter and error, so both sides agree on length.
// ---------------------------------------------------------------------------------------

// C0 and C1 controls (newline handled separately), zero width and bidi control characters,
// soft hyphen, BOM.
const INVISIBLE = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F­​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

/** Length in code points, so an emoji counts as one character. */
export function algSetTextLength(text: string): number {
	return Array.from(text).length;
}

/** One line: newlines and tabs become spaces, invisible characters go, spaces collapse, trimmed. */
export function cleanAlgSetName(raw: string | null | undefined): string {
	if (!raw) return '';
	return raw
		.replace(/[\r\n\t]+/g, ' ')
		.replace(INVISIBLE, '')
		.replace(/ {2,}/g, ' ')
		.trim();
}

/**
 * Keeps line breaks (at most one empty line in a row), cleans each line like a name,
 * drops leading and trailing empty lines.
 */
export function cleanAlgSetDescription(raw: string | null | undefined): string {
	if (!raw) return '';
	const lines = raw
		.replace(/\r\n?/g, '\n')
		.split('\n')
		.map((line) => cleanAlgSetName(line));
	const out: string[] = [];
	for (const line of lines) {
		if (!line && (out.length === 0 || out[out.length - 1] === '')) continue;
		out.push(line);
	}
	while (out.length && out[out.length - 1] === '') out.pop();
	return out.join('\n');
}

export type AlgSetTextError = 'NAME_EMPTY' | 'NAME_TOO_LONG' | 'DESCRIPTION_TOO_LONG' | 'DESCRIPTION_TOO_MANY_LINES';

/** Checks an already cleaned name. */
export function checkAlgSetName(name: string): AlgSetTextError | null {
	const length = algSetTextLength(name);
	if (length < ALG_SET_LIMITS.NAME_MIN_LENGTH) return 'NAME_EMPTY';
	if (length > ALG_SET_LIMITS.NAME_MAX_LENGTH) return 'NAME_TOO_LONG';
	return null;
}

/** Checks an already cleaned description. Empty is fine (the field is optional). */
export function checkAlgSetDescription(description: string): AlgSetTextError | null {
	if (algSetTextLength(description) > ALG_SET_LIMITS.DESCRIPTION_MAX_LENGTH) return 'DESCRIPTION_TOO_LONG';
	if (description && description.split('\n').length > ALG_SET_LIMITS.DESCRIPTION_MAX_LINES) {
		return 'DESCRIPTION_TOO_MANY_LINES';
	}
	return null;
}
