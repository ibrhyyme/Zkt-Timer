/**
 * One time move of trainer stats after the expandNotation fix (trainer-sets design, B-1).
 *
 * The trainer keys every per algorithm value by `algToId(expandNotation(text))`. Before the fix,
 * expandNotation dropped `w`, turn counts other than 2 and layer prefixes ("Rw U" became "R U",
 * "2R2 U2" became "2 R2 U2..."), so 26 library texts (23 main algorithms, 3 alternatives) and any
 * user text written that way were keyed by a broken text. The fix changes their key; this copies
 * the values from the old key to the new one, once, and only where the new key is still empty.
 * Old keys are left in place (an older bundle still reads them).
 *
 * Pure apart from the storage passed in, so it is testable in node.
 */
import {algToId, expandNotation} from './algorithm_engine';

/** Set once the copy ran; bump the value only for a new, different migration. */
export const ALG_ID_MIGRATION_KEY = 'trainer_algIdMigration';
export const ALG_ID_MIGRATION_VERSION = '1';

/** The per algorithm values the trainer keeps (useAlgorithmData.ts). */
export const ALG_STAT_PREFIXES = ['trainer_Best-', 'trainer_LastTimes-', 'trainer_Learned-', 'trainer_FailCount-'];

const SAVED_ALGORITHMS_KEY = 'trainer_savedAlgorithms';
const CUSTOM_ALTERNATIVES_KEY = 'trainer_customAlternatives';
// Generated 2D patterns of custom alternatives, keyed by the expanded text (ll_patterns.ts).
const CUSTOM_PATTERNS_KEY = 'trainer_customPatterns';

export interface KeyValueStore {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

/** The library shape (default-algs.json and its localStorage copy), loosely typed on purpose. */
export type AlgLibrary = Record<
	string,
	Array<{algorithms?: Array<{algorithm?: string | null; alternatives?: string[] | null}> | null}> | null
>;

/**
 * expandNotation exactly as it was before the B-1 fix. Only used to find the old keys.
 * Frozen: do not change it.
 */
export function legacyExpandNotation(input: string): string {
	if (input.includes('/')) {
		return input.replace(/\s+/g, ' ').trim();
	}

	let output = input
		.replace(/["´`']/g, "'")
		.replace(/\[/g, '(')
		.replace(/\]/g, ')')
		.replace(/XYZ/g, 'xyz');
	output = output.replace(/[^RLFBUDMESrlfbudxyz2()']/g, '');
	output = output.replace(/\(/g, ' (');
	output = output.replace(/\)(?!\s)/g, ') ');
	output = output.replace(/'(?![\s)])/g, "' ");
	output = output.replace(/2(?![\s')])/g, '2 ');
	output = output.replace(/([RLFBUDMESrlfbudxyz])(?![\s)'2])/g, '$1 ');
	output = output.replace(/(\s)(?=2)/g, '');
	output = output.replace(/'2/g, "2'");
	output = output.replace(/\s+/g, ' ');
	return output.trim();
}

export interface ExpandedTextChange {
	/** expanded text before the fix */
	from: string;
	/** expanded text after the fix */
	to: string;
}

/** The texts whose expanded form changed with the fix, one entry per distinct old/new pair. */
export function changedExpansions(texts: Iterable<string>): ExpandedTextChange[] {
	const seen = new Set<string>();
	const changes: ExpandedTextChange[] = [];
	for (const text of texts) {
		if (typeof text !== 'string' || !text.trim()) continue;
		const from = legacyExpandNotation(text);
		const to = expandNotation(text);
		if (from === to) continue;
		const pairKey = `${from}\u0000${to}`;
		if (seen.has(pairKey)) continue;
		seen.add(pairKey);
		changes.push({from, to});
	}
	return changes;
}

/** Every algorithm and alternative text in the given libraries, plus the guest custom alternatives. */
export function collectAlgTexts(
	libraries: Array<AlgLibrary | null | undefined>,
	customAlternatives?: Record<string, unknown> | null
): string[] {
	const texts: string[] = [];
	for (const library of libraries) {
		if (!library || typeof library !== 'object') continue;
		for (const subsets of Object.values(library)) {
			if (!Array.isArray(subsets)) continue;
			for (const subset of subsets) {
				for (const entry of subset?.algorithms || []) {
					if (typeof entry?.algorithm === 'string') texts.push(entry.algorithm);
					for (const alt of entry?.alternatives || []) {
						if (typeof alt === 'string') texts.push(alt);
					}
				}
			}
		}
	}
	if (customAlternatives && typeof customAlternatives === 'object') {
		for (const list of Object.values(customAlternatives)) {
			if (!Array.isArray(list)) continue;
			for (const alt of list) {
				if (typeof alt === 'string') texts.push(alt);
			}
		}
	}
	return texts;
}

/**
 * Copies each stat value from the old key to the new key when the new key is empty. Two texts
 * that now differ but used to share an old key both receive the old values, as both showed them.
 * Returns the number of values copied.
 */
export function copyLegacyAlgStats(store: KeyValueStore, changes: ExpandedTextChange[]): number {
	let copied = 0;
	for (const {from, to} of changes) {
		const fromId = algToId(from);
		const toId = algToId(to);
		if (fromId === toId) continue;
		for (const prefix of ALG_STAT_PREFIXES) {
			const value = store.getItem(prefix + fromId);
			if (value == null || value === '') continue;
			const current = store.getItem(prefix + toId);
			if (current != null && current !== '') continue;
			store.setItem(prefix + toId, value);
			copied++;
		}
	}
	return copied;
}

/** Same rule for the cached 2D patterns of custom alternatives. Returns the number copied. */
export function copyLegacyCustomPatterns(store: KeyValueStore, changes: ExpandedTextChange[]): number {
	const patterns = readJson(store, CUSTOM_PATTERNS_KEY);
	if (!patterns) return 0;
	let copied = 0;
	for (const {from, to} of changes) {
		if (typeof patterns[from] === 'string' && patterns[to] === undefined) {
			patterns[to] = patterns[from];
			copied++;
		}
	}
	if (copied > 0) store.setItem(CUSTOM_PATTERNS_KEY, JSON.stringify(patterns));
	return copied;
}

function readJson(store: KeyValueStore, key: string): Record<string, any> | null {
	try {
		const raw = store.getItem(key);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

/**
 * Runs the migration once per device. `defaults` is the fetched default-algs.json: an alternative
 * the user trained and later replaced is only there, not in the saved library copy.
 * Never throws (a full or blocked storage leaves the flag unset, so the next load retries).
 * Returns true when the migration is done (now or earlier).
 */
export function migrateAlgIdsOnce(defaults: AlgLibrary | null | undefined, store?: KeyValueStore): boolean {
	try {
		const target = store ?? (typeof localStorage !== 'undefined' ? localStorage : null);
		if (!target) return false;
		if (target.getItem(ALG_ID_MIGRATION_KEY) === ALG_ID_MIGRATION_VERSION) return true;

		const saved = readJson(target, SAVED_ALGORITHMS_KEY) as AlgLibrary | null;
		const custom = readJson(target, CUSTOM_ALTERNATIVES_KEY);
		const changes = changedExpansions(collectAlgTexts([defaults, saved], custom));
		copyLegacyAlgStats(target, changes);
		copyLegacyCustomPatterns(target, changes);

		target.setItem(ALG_ID_MIGRATION_KEY, ALG_ID_MIGRATION_VERSION);
		return true;
	} catch {
		return false;
	}
}
