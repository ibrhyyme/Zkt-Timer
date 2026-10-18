/**
 * Set study queue helpers (trainer-sets design, sections 6.2 and 6.5).
 *
 * A set row is `(category, case_name, algorithm)`. The training engine already decides the
 * puzzle, AUF, setup and pattern per card from `card.category`, so a mixed set needs no engine
 * changes: these helpers only turn set rows into the same `CheckedAlgorithm` cards the selector
 * builds, and pick the rows a study mode can run.
 *
 * Pure and React free so the rules are testable in node.
 */
import {algToId, expandNotation, getPuzzleType} from './algorithm_engine';
import {algSetCaseKey, cubeTypeOfCategory, CUBE_TYPE_ORDER, type TrainerCubeType} from '../../../shared/trainer/alg_sets';
import type {CheckedAlgorithm, StartSetStudyPayload, TrainerMode} from '../../components/trainer/types';

/**
 * The one transform between a stored algorithm text and the text the trainer runs and keys its
 * statistics by (`algToId`). The selector (useAlgorithmData) and the set queue both call it, so
 * the same case keeps the same times and learned flag in a set and in the normal trainer (B-10).
 * A fix to the notation expansion (B-1) changes both paths together.
 */
export function trainerAlgText(raw: string): string {
	return expandNotation(raw || '');
}

/** Identity of a card in the queue: `category::name`. Algorithm text is not unique across categories. */
export function checkedKey(card: {category: string; name: string}): string {
	return algSetCaseKey(card.category, card.name);
}

/** The fields of a set row the study queue needs (a subset of the GraphQL AlgSetItem). */
export interface SetStudyRow {
	category: string;
	case_name: string;
	subset?: string | null;
	algorithm: string;
	position?: number | null;
}

export type BestTimeLookup = (algId: string) => number | null;

export function toCheckedAlgorithm(row: SetStudyRow, bestTimeOf?: BestTimeLookup): CheckedAlgorithm {
	const algorithm = trainerAlgText(row.algorithm);
	return {
		algorithm,
		name: row.case_name,
		bestTime: bestTimeOf ? bestTimeOf(algToId(algorithm)) : null,
		category: row.category,
		subset: row.subset || '',
	};
}

/**
 * Set rows in set order (`position`, the order the owner arranged), as queue cards. A row whose
 * case appears twice keeps its first occurrence: the server forbids duplicates, this only guards
 * an offline copy written by an older client.
 */
export function setRowsToChecked(rows: SetStudyRow[], bestTimeOf?: BestTimeLookup): CheckedAlgorithm[] {
	const ordered = rows
		.map((row, index) => ({row, index}))
		.sort((a, b) => {
			const pa = typeof a.row.position === 'number' ? a.row.position : a.index;
			const pb = typeof b.row.position === 'number' ? b.row.position : b.index;
			return pa - pb || a.index - b.index;
		});
	const seen = new Set<string>();
	const out: CheckedAlgorithm[] = [];
	for (const {row} of ordered) {
		if (!row || !row.category || !row.case_name || !row.algorithm) continue;
		const card = toCheckedAlgorithm(row, bestTimeOf);
		const key = checkedKey(card);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(card);
	}
	return out;
}

/** A smart cube is a 3x3: only 3x3 shaped categories (CFOP, Roux, ZB...) can be tracked on one. */
export function canStudyWithSmartCube(category: string): boolean {
	return getPuzzleType(category) === '3x3x3';
}

/**
 * The cards a study mode runs. Standard runs every card; Smart Cube only the 3x3 ones. The rest
 * stay in the set and come back when the user switches to Standard.
 */
export function filterForMode<T extends {category: string}>(items: T[], mode: TrainerMode | null | undefined): T[] {
	if (mode !== 'smart') return items.slice();
	return items.filter((item) => canStudyWithSmartCube(item.category));
}

export interface SmartSkipSummary {
	count: number;
	/** Puzzle names in the selector's order ("2x2", "Pyraminx"), each once. */
	cubeTypes: TrainerCubeType[];
}

/** What Smart Cube mode leaves out of a set, for the info line (6.5). */
export function smartSkipSummary(items: {category: string}[]): SmartSkipSummary {
	const types = new Set<TrainerCubeType>();
	let count = 0;
	for (const item of items) {
		if (canStudyWithSmartCube(item.category)) continue;
		count++;
		types.add(cubeTypeOfCategory(item.category));
	}
	return {count, cubeTypes: CUBE_TYPE_ORDER.filter((ct) => types.has(ct))};
}

/** Number of distinct categories, for the category tag above the case name (6.4). */
export function distinctCategoryCount(items: {category: string}[]): number {
	return new Set(items.map((item) => item.category)).size;
}

/** A loaded set as the START_SET_STUDY payload (every row as a card, in set order). */
export function startSetStudyPayload(
	set: {id: string; code: string; name: string; owner_name: string; is_owner: boolean; items: SetStudyRow[]},
	bestTimeOf?: BestTimeLookup
): StartSetStudyPayload {
	return {
		set: {id: set.id, code: set.code, name: set.name, owner_name: set.owner_name, is_owner: set.is_owner},
		items: setRowsToChecked(set.items || [], bestTimeOf),
	};
}
