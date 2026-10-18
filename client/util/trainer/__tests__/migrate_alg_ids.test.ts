/**
 * One time move of trainer stats from the keys of the old (broken) expansion to the new ones (B-1).
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {algToId, expandNotation} from '../algorithm_engine';
import {
	ALG_ID_MIGRATION_KEY,
	ALG_ID_MIGRATION_VERSION,
	changedExpansions,
	collectAlgTexts,
	copyLegacyAlgStats,
	legacyExpandNotation,
	migrateAlgIdsOnce,
	type AlgLibrary,
	type KeyValueStore,
} from '../migrate_alg_ids';

const library: AlgLibrary = JSON.parse(
	readFileSync(join(__dirname, '../../../../public/trainer/default-algs.json'), 'utf8')
);

class MemoryStore implements KeyValueStore {
	data = new Map<string, string>();
	constructor(initial: Record<string, string> = {}) {
		for (const [k, v] of Object.entries(initial)) this.data.set(k, v);
	}
	getItem(key: string) {
		return this.data.has(key) ? (this.data.get(key) as string) : null;
	}
	setItem(key: string, value: string) {
		this.data.set(key, value);
	}
}

const ZBLS_8 = "Rw U Rw' U' R U' M' U Rw'";
const OPP = '2R2 U2 2R2 Uw2 2R2 Uw2';
const oldId = (raw: string) => algToId(legacyExpandNotation(raw));
const newId = (raw: string) => algToId(expandNotation(raw));

describe('changedExpansions', () => {
	it('finds the 26 library texts (23 main, 3 alternatives; the Ub alternative twice) as 25 distinct pairs', () => {
		const texts = collectAlgTexts([library]);
		const changes = changedExpansions(texts);
		// The Ub perm alternative is in PLL and 2-Look PLL with the same text: one pair.
		expect(changes).toHaveLength(25);
		expect(changes).toContainEqual({from: "R U R' U' R U' M' U R'", to: ZBLS_8});
		expect(changes).toContainEqual({from: '2 R2 U22 R2 U22 R2 U2', to: OPP});
	});

	it('skips unchanged, empty and non string texts', () => {
		expect(changedExpansions(["R U R' U'", '', '   ', null as unknown as string])).toEqual([]);
	});
});

describe('collectAlgTexts', () => {
	it('reads main algorithms, alternatives and guest custom alternatives, tolerating bad shapes', () => {
		const texts = collectAlgTexts(
			[
				{X: [{algorithms: [{algorithm: 'R', alternatives: ['U', 3 as unknown as string]}]}]},
				null,
				{Y: null, Z: [{algorithms: null}]},
			],
			{'X::Default::a': ['Rw U'], bad: 'nope'}
		);
		expect(texts).toEqual(['R', 'U', 'Rw U']);
	});
});

describe('copyLegacyAlgStats', () => {
	it('copies every stat value to the new key when the new key is empty, and keeps the old key', () => {
		const store = new MemoryStore({
			[`trainer_Best-${oldId(ZBLS_8)}`]: '1234',
			[`trainer_LastTimes-${oldId(ZBLS_8)}`]: '[{"t":1234}]',
			[`trainer_Learned-${oldId(ZBLS_8)}`]: '2',
			[`trainer_FailCount-${oldId(ZBLS_8)}`]: '3',
		});
		const copied = copyLegacyAlgStats(store, changedExpansions([ZBLS_8]));
		expect(copied).toBe(4);
		expect(store.getItem(`trainer_Best-${newId(ZBLS_8)}`)).toBe('1234');
		expect(store.getItem(`trainer_LastTimes-${newId(ZBLS_8)}`)).toBe('[{"t":1234}]');
		expect(store.getItem(`trainer_Learned-${newId(ZBLS_8)}`)).toBe('2');
		expect(store.getItem(`trainer_FailCount-${newId(ZBLS_8)}`)).toBe('3');
		expect(store.getItem(`trainer_Best-${oldId(ZBLS_8)}`)).toBe('1234');
	});

	it('never overwrites a value already under the new key', () => {
		const store = new MemoryStore({
			[`trainer_Best-${oldId(OPP)}`]: '5000',
			[`trainer_Best-${newId(OPP)}`]: '4000',
			[`trainer_Learned-${oldId(OPP)}`]: '1',
		});
		expect(copyLegacyAlgStats(store, changedExpansions([OPP]))).toBe(1);
		expect(store.getItem(`trainer_Best-${newId(OPP)}`)).toBe('4000');
		expect(store.getItem(`trainer_Learned-${newId(OPP)}`)).toBe('1');
	});
});

describe('migrateAlgIdsOnce', () => {
	it('uses the defaults, the saved library copy and the guest alternatives, then sets the flag', () => {
		const guestAlt = "Rw U R' U' Rw' F R F'";
		const savedOnly = "U Rw' R2 U' R' U Rw U' R'";
		const store = new MemoryStore({
			trainer_savedAlgorithms: JSON.stringify({ZBLS: [{subset: 'x', algorithms: [{name: 'ZBLS 27', algorithm: savedOnly}]}]}),
			trainer_customAlternatives: JSON.stringify({'OLL::Dot::OLL 1': [guestAlt]}),
			[`trainer_Best-${oldId(ZBLS_8)}`]: '1500',
			[`trainer_Best-${oldId(savedOnly)}`]: '1600',
			[`trainer_Best-${oldId(guestAlt)}`]: '1700',
			trainer_customPatterns: JSON.stringify({[legacyExpandNotation(guestAlt)]: 'PATTERN'}),
		});
		const defaults: AlgLibrary = {ZBLS: [{algorithms: [{algorithm: ZBLS_8}]}]};

		expect(migrateAlgIdsOnce(defaults, store)).toBe(true);
		expect(store.getItem(`trainer_Best-${newId(ZBLS_8)}`)).toBe('1500');
		expect(store.getItem(`trainer_Best-${newId(savedOnly)}`)).toBe('1600');
		expect(store.getItem(`trainer_Best-${newId(guestAlt)}`)).toBe('1700');
		expect(JSON.parse(store.getItem('trainer_customPatterns') as string)[expandNotation(guestAlt)]).toBe('PATTERN');
		expect(store.getItem(ALG_ID_MIGRATION_KEY)).toBe(ALG_ID_MIGRATION_VERSION);
	});

	it('runs only once, so a stat reset after the migration is not filled again', () => {
		const store = new MemoryStore({[`trainer_Best-${oldId(ZBLS_8)}`]: '1500'});
		const defaults: AlgLibrary = {ZBLS: [{algorithms: [{algorithm: ZBLS_8}]}]};
		migrateAlgIdsOnce(defaults, store);
		store.data.delete(`trainer_Best-${newId(ZBLS_8)}`);
		migrateAlgIdsOnce(defaults, store);
		expect(store.getItem(`trainer_Best-${newId(ZBLS_8)}`)).toBeNull();
	});

	it('does not throw and leaves the flag unset when storage fails', () => {
		const store: KeyValueStore = {
			getItem: () => null,
			setItem: () => {
				throw new Error('QuotaExceededError');
			},
		};
		expect(migrateAlgIdsOnce({ZBLS: [{algorithms: [{algorithm: ZBLS_8}]}]}, store)).toBe(false);
	});

	it('tolerates corrupt saved data', () => {
		const store = new MemoryStore({trainer_savedAlgorithms: '{not json', trainer_customAlternatives: '[1,2]'});
		expect(migrateAlgIdsOnce(null, store)).toBe(true);
	});
});
