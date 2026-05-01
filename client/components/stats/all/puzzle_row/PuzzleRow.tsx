import React, {useMemo} from 'react';
import {useHistory} from 'react-router-dom';
import './PuzzleRow.scss';
import block from '../../../../styles/bem';
import {fetchAllCubeTypesSolved} from '../../../../db/solves/query';
import {useSolveDb} from '../../../../util/hooks/useSolveDb';
import PuzzleCard from './PuzzleCard';

const b = block('puzzle-row');

const PALETTE = [
	'#abd1c6',
	'#f9bc60',
	'#e16162',
	'#ff8ba7',
	'#90b4ce',
	'#b8c1ec',
	'#8c7851',
	'#67e8f9',
];

export default function PuzzleRow() {
	const history = useHistory();
	const solveUpdate = useSolveDb();

	const cubeTypes = useMemo(() => fetchAllCubeTypesSolved(), [solveUpdate]);

	if (!cubeTypes.length) {
		return null;
	}

	function navigate(cubeType: string, subset: string | null) {
		const subsetParam = subset != null ? `&subset=${subset}` : '';
		history.push(`/stats?cubeType=${cubeType}${subsetParam}`);
	}

	return (
		<div className={b()}>
			{cubeTypes.map((ct, i) => (
				<PuzzleCard
					key={`${ct.cube_type}::${ct.scramble_subset ?? ''}`}
					cubeType={ct.cube_type}
					scrambleSubset={ct.scramble_subset}
					count={ct.count}
					color={PALETTE[i % PALETTE.length]}
					onClick={() => navigate(ct.cube_type, ct.scramble_subset)}
				/>
			))}
		</div>
	);
}
