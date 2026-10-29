import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bluetooth, Cube } from 'phosphor-react';
import Tag from '../../common/tag/Tag';
import Dropdown from '../../common/inputs/dropdown/Dropdown';
import { IDropdownOption } from '../../common/inputs/dropdown/dropdown_option/DropdownOption';
import { useCubes } from '../../../lib/cubes/store';
import { cubeById, cubesForPuzzle } from '../../../lib/cubes/active_cube';
import { puzzleOfBucket } from '../../../../shared/cube_puzzle';
import { Solve } from '../../../../server/schemas/Solve.schema';

interface Props {
	/** The solve as shown: the local row when there is one, the server copy otherwise. */
	solve: Solve;
	/** The server copy, which carries the cube relation for someone else's solve. */
	serverSolve?: Solve | null;
	/** Smart cube solve: drawn as the Bluetooth tag, shown even without a cube name. */
	smart?: boolean;
	/** Own local solve: the cube can be changed to another cube of the same puzzle (design 4.3). */
	editable?: boolean;
	onChange?: (cubeId: string | null) => void;
}

/**
 * The physical cube a solve was made with, on the solve card (design magnet-cubes 4.3, 5.5, E-3).
 *
 * The name comes from the local My Cubes list, so it shows offline and right after a rename.
 * Someone else's solve (share link, profile) has no local entry; the server's cube relation
 * names it there. Server render and the first client render both use the server name, the
 * local list fills in after hydration.
 */
export default function SolveCubeTag(props: Props) {
	const { solve, serverSolve, smart, editable, onChange } = props;
	const { t } = useTranslation();
	const cubeState = useCubes();

	const cubeId = solve.cube_id || null;
	const local = cubeById(cubeState, cubeId);
	const remote = serverSolve?.cube && serverSolve.cube.id === cubeId ? serverSolve.cube : null;
	const name = local?.name || remote?.name || null;

	const puzzle = puzzleOfBucket(solve.cube_type, solve.scramble_subset);
	const choices = editable && onChange ? cubesForPuzzle(puzzle, cubeState) : [];
	// An archived cube stays selectable for the solve that already has it.
	if (local && local.archived_at && !choices.some((c) => c.id === local.id) && local.puzzle === puzzle) {
		choices.push(local);
	}

	const icon = smart ? <Bluetooth /> : <Cube />;
	const tag = (
		<Tag
			icon={icon}
			text={name || (choices.length ? t('solve_info.cube_choose') : undefined)}
			title={t('solve_info.cube_title')}
			// A quiet chip beside the puzzle's, the Bluetooth mark telling a smart cube apart:
			// the large blue tag was the loudest thing on the card.
			backgroundColor="button"
		/>
	);

	if (!choices.length) {
		// Nothing to change to: the plain label, or for a smart solve the bare Bluetooth mark.
		return name || smart ? tag : null;
	}

	const options: IDropdownOption[] = [
		...choices.map((cube) => ({
			text: cube.name,
			selected: cube.id === cubeId,
			onClick: () => {
				if (cube.id !== cubeId) onChange(cube.id);
			},
		})),
		{
			text: t('solve_info.cube_none'),
			selected: !cubeId,
			onClick: () => {
				if (cubeId) onChange(null);
			},
		},
	];

	return <Dropdown noMargin handle={tag} options={options} />;
}
