import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCubes } from '../../../lib/cubes/store';
import { LocalCube } from '../../../lib/cubes/active_cube';
import { useSolveDb } from '../../../util/hooks/useSolveDb';
import { fetchSolveCount } from '../../../db/solves/query';
import { getCustomCubeTypes } from '../../../util/cubes/util';
import { orderPuzzles, puzzleLabel } from '../../settings/cubes/cube_labels';
import { countCubeFilterChoices, cubeFilterGroups, CubeFilterGroup, resolveCubeFilter } from './cube_filter_options';

interface Params {
	/** The id the page holds (URL parameter or local state). Unknown ids are ignored. */
	requestedId: string | null | undefined;
	/** Physical puzzle of the selected cube type (puzzleOfBucket); null in "Tümü" or for 'other'. */
	puzzle: string | null | undefined;
	/** "Tümü": no cube type picked. */
	allMode: boolean;
}

export interface CubeFilterState {
	/** The picker is drawn: the person has cubes and at least one is offered here. */
	visible: boolean;
	groups: CubeFilterGroup[];
	/** The cube the filter applies, or null ("Tüm küpler"). Goes into filterOptions.cube_id. */
	cube: LocalCube | null;
	/** Looks a cube up by id (also ones the current puzzle does not offer). */
	findCube: (id: string | null | undefined) => LocalCube | null;
}

/**
 * The Cube filter's data for one page (design magnet-cubes 8.2). Reads the local My Cubes copy,
 * so it works offline and is empty during SSR and hydration: the picker never renders on the
 * server and the first client frame matches it.
 */
export function useCubeFilter({ requestedId, puzzle, allMode }: Params): CubeFilterState {
	const { t } = useTranslation();
	const state = useCubes();
	const solveUpdate = useSolveDb();

	const groups = useMemo(() => {
		if (!state.cubes.length) return [];
		const customTypes = getCustomCubeTypes();
		return cubeFilterGroups(state, {
			puzzle,
			allMode,
			// Only archived cubes ask, a handful of indexed lookups at most
			hasLocalSolves: (cubeId) => fetchSolveCount({ from_timer: true, cube_id: cubeId }) > 0,
			puzzleLabel: (key) => puzzleLabel(key, customTypes),
			orderPuzzles: (keys) => orderPuzzles(keys, customTypes),
			archivedHeader: (count) => t('cubes.archive_title', { n: count }),
		});
	}, [state, puzzle, allMode, solveUpdate, t]);

	const cube = useMemo(() => resolveCubeFilter(state, requestedId, puzzle, allMode), [state, requestedId, puzzle, allMode]);

	const findCube = useCallback((id: string | null | undefined) => resolveCubeFilter(state, id, null, true), [state]);

	return {
		// A chosen cube keeps the picker on screen even if the list has nothing else to offer
		visible: countCubeFilterChoices(groups) > 0 || !!cube,
		groups,
		cube,
		findCube,
	};
}
