/**
 * The Algorithm Trainer's category list (/trainer/algorithms): which puzzles get a tab, how a
 * puzzle's categories are split, and how a category is named on its tile. React free so the
 * rules are testable in node.
 */
import {CUBE_TYPE_ORDER, cubeTypeOfCategory} from '../../../shared/trainer/alg_sets';
import type {TrainerCubeType} from '../../../shared/trainer/alg_sets';
import type {TrainerMode} from '../../components/trainer/types';
import {canStudyWithSmartCube} from './set_queue';

/** Categories of hundreds to thousands of cases, listed in a section of their own. */
export const LARGE_CATEGORIES: ReadonlySet<string> = new Set(['1LLL', 'ZBLL', 'OLLCP', 'VLS']);

/** Puzzles that have at least one category, in the trainer's order; Smart Cube mode keeps the 3x3 ones. */
export function catalogPuzzles(categories: readonly string[], mode: TrainerMode | null): TrainerCubeType[] {
	const listed = mode === 'smart' ? categories.filter(canStudyWithSmartCube) : categories;
	const available = new Set(listed.map(cubeTypeOfCategory));
	return CUBE_TYPE_ORDER.filter((puzzle) => available.has(puzzle));
}

/** One puzzle's categories in library order, the large ones apart. */
export function catalogSections(categories: readonly string[], puzzle: TrainerCubeType): {regular: string[]; large: string[]} {
	const regular: string[] = [];
	const large: string[] = [];
	for (const category of categories) {
		if (cubeTypeOfCategory(category) !== puzzle) continue;
		(LARGE_CATEGORIES.has(category) ? large : regular).push(category);
	}
	return {regular, large};
}

const NAME_PREFIXES = ['2x2 ', '4x4 ', 'Pyraminx ', 'SQ1 '];

/** A category's name under its puzzle tab: the puzzle prefix is already the tab ("2x2 CLL" → "CLL"). */
export function categoryDisplayName(category: string): string {
	for (const prefix of NAME_PREFIXES) {
		if (category.startsWith(prefix)) return category.slice(prefix.length);
	}
	return category;
}

/**
 * The long name under a category's name, or '' when it only repeats it: some categories are
 * names already, so their long name is the same words ("EG1" and "2x2 EG-1").
 */
export function categoryLongName(category: string, longName: string): string {
	const letters = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
	return letters(categoryDisplayName(longName)) === letters(categoryDisplayName(category)) ? '' : longName;
}

/** Key of the category's long name and description: `trainer.cat_info.<key>.title|desc`. */
export function categoryInfoKey(category: string): string {
	return category.toLowerCase().replace(/[\s-]+/g, '_');
}

const PUZZLE_KEY = 'trainer_catalogPuzzle';

/** The puzzle tab last opened on this device (a convenience; the page works without it). */
export function readCatalogPuzzle(): string | null {
	try {
		return localStorage.getItem(PUZZLE_KEY);
	} catch {
		return null;
	}
}

export function writeCatalogPuzzle(puzzle: string): void {
	try {
		localStorage.setItem(PUZZLE_KEY, puzzle);
	} catch {
		// No storage (private mode): the tab simply is not remembered.
	}
}
