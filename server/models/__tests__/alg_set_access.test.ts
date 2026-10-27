// Access rule of trainer algorithm sets: every cell of design trainer-sets 4.4.

import {canViewAlgSet, generateAlgSetCode, isOwnerBanned, ownerNotBannedWhere, toAlgSetSummary} from '../alg_set';
import {ALG_SET_CODE_LENGTH, isAlgSetCode} from '../../../shared/trainer/alg_sets';

const NOW = new Date('2026-10-06T12:00:00Z');
const OWNER = {id: 'owner'};
const ADMIN = {id: 'admin', admin: true};
const MOD = {id: 'mod', mod: true};
const OTHER = {id: 'other'};
const ANON = null;

type Variant = 'private' | 'link' | 'public' | 'hidden' | 'banned' | 'banned_until_past';

function setOf(variant: Variant) {
	const base = {
		user_id: OWNER.id,
		visibility: 'public',
		hidden_at: null as Date | null,
		user: {banned_forever: false, banned_until: null as Date | null},
	};
	switch (variant) {
		case 'private':
			return {...base, visibility: 'private'};
		case 'link':
			return {...base, visibility: 'link'};
		case 'public':
			return base;
		case 'hidden':
			return {...base, hidden_at: new Date('2026-10-01')};
		case 'banned':
			return {...base, user: {banned_forever: false, banned_until: new Date('2026-10-07')}};
		case 'banned_until_past':
			return {...base, user: {banned_forever: false, banned_until: new Date('2026-10-05')}};
	}
}

// [variant, owner, admin, other signed in, anonymous] (design 4.4)
const TABLE: Array<[Variant, boolean, boolean, boolean, boolean]> = [
	['private', true, true, false, false],
	['link', true, true, true, true],
	['public', true, true, true, true],
	['hidden', true, true, false, false],
	['banned', true, true, false, false],
	// A temporary ban that ended: the sets come back by themselves.
	['banned_until_past', true, true, true, true],
];

describe('canViewAlgSet', () => {
	it.each(TABLE)('%s: owner %s, admin %s, other %s, anonymous %s', (variant, owner, admin, other, anon) => {
		const set = setOf(variant);
		expect(canViewAlgSet(set, OWNER, NOW)).toBe(owner);
		expect(canViewAlgSet(set, ADMIN, NOW)).toBe(admin);
		expect(canViewAlgSet(set, MOD, NOW)).toBe(admin);
		expect(canViewAlgSet(set, OTHER, NOW)).toBe(other);
		expect(canViewAlgSet(set, ANON, NOW)).toBe(anon);
	});

	it('a permanent ban hides link and public sets from others', () => {
		const set = {...setOf('public'), user: {banned_forever: true, banned_until: null}};
		expect(canViewAlgSet(set, OTHER, NOW)).toBe(false);
		expect(canViewAlgSet(set, ANON, NOW)).toBe(false);
		expect(canViewAlgSet(set, ADMIN, NOW)).toBe(true);
	});

	it('an unknown visibility opens for nobody but owner and staff', () => {
		const set = {...setOf('public'), visibility: 'friends'};
		expect(canViewAlgSet(set, OTHER, NOW)).toBe(false);
		expect(canViewAlgSet(set, OWNER, NOW)).toBe(true);
	});
});

describe('ban helpers', () => {
	it('isOwnerBanned reads the ban at query time', () => {
		expect(isOwnerBanned({banned_forever: true}, NOW)).toBe(true);
		expect(isOwnerBanned({banned_until: new Date('2026-10-07')}, NOW)).toBe(true);
		expect(isOwnerBanned({banned_until: new Date('2026-10-05')}, NOW)).toBe(false);
		expect(isOwnerBanned({banned_until: null}, NOW)).toBe(false);
		expect(isOwnerBanned(null, NOW)).toBe(false);
	});

	it('ownerNotBannedWhere filters forever bans and running bans', () => {
		expect(ownerNotBannedWhere(NOW)).toEqual({
			banned_forever: false,
			OR: [{banned_until: null}, {banned_until: {lte: NOW}}],
		});
	});
});

describe('hidden flag', () => {
	const row: any = {
		id: 's1',
		code: 'abcdefghij',
		user_id: OWNER.id,
		name: 'Set',
		description: null,
		visibility: 'public',
		item_count: 0,
		save_count: 0,
		categories: ',OLL,PLL,',
		puzzles: ',333,',
		published_at: null,
		hidden_at: new Date('2026-10-01'),
		hidden_reason: 'auto_reports',
		created_at: NOW,
		updated_at: NOW,
		user: {id: OWNER.id, username: 'o', verified: false, banned_forever: false, banned_until: null, profile: null},
		items: [],
	};

	it('is shown only to the owner and staff', () => {
		expect(toAlgSetSummary(row, OWNER).hidden).toBe(true);
		expect(toAlgSetSummary(row, ADMIN).hidden).toBe(true);
		expect(toAlgSetSummary(row, OTHER).hidden).toBe(false);
		expect(toAlgSetSummary(row, ANON).hidden).toBe(false);
	});

	it('splits the comma lists', () => {
		const summary = toAlgSetSummary(row, OWNER);
		expect(summary.categories).toEqual(['OLL', 'PLL']);
		expect(summary.puzzles).toEqual(['333']);
	});
});

describe('generateAlgSetCode', () => {
	it('makes a 10 character base62 code', () => {
		for (let i = 0; i < 200; i++) {
			const code = generateAlgSetCode();
			expect(code).toHaveLength(ALG_SET_CODE_LENGTH);
			expect(isAlgSetCode(code)).toBe(true);
		}
	});

	it('drops biased bytes instead of folding them', () => {
		// 248..255 would map onto the first 8 characters with a plain modulo.
		let call = 0;
		const bytes = (n: number) => {
			call++;
			return Buffer.from(Array.from({length: n}, (_, i) => (call === 1 && i < 5 ? 250 : 61)));
		};
		expect(generateAlgSetCode(bytes)).toBe('z'.repeat(ALG_SET_CODE_LENGTH));
	});
});
