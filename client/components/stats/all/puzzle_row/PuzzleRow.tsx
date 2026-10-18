import React, {useContext, useMemo} from 'react';
import './PuzzleRow.scss';
import block from '../../../../styles/bem';
import {fetchAllCubeTypesSolved} from '../../../../db/solves/query';
import {useSolveDb} from '../../../../util/hooks/useSolveDb';
import PuzzleCard from './PuzzleCard';
import {StatsContext} from '../../Stats';

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
	const solveUpdate = useSolveDb();
	const {scope, openBucket} = useContext(StatsContext);
	// The season and cube filter above the page apply here too, as they do to every other
	// part of the "All" view; a card used to count and time the whole history regardless.
	const sessionId = scope.session_id ?? null;
	const cubeId = scope.cube_id ?? null;

	const cubeTypes = useMemo(() => fetchAllCubeTypesSolved(false, scope), [solveUpdate, sessionId, cubeId]);

	if (!cubeTypes.length) {
		return null;
	}

	return (
		<div className={b()}>
			{cubeTypes.map((ct, i) => (
				<PuzzleCard
					key={`${ct.cube_type}::${ct.scramble_subset ?? ''}`}
					cubeType={ct.cube_type}
					scrambleSubset={ct.scramble_subset}
					count={ct.count}
					sessionId={sessionId}
					cubeId={cubeId}
					color={PALETTE[i % PALETTE.length]}
					onClick={() => openBucket(ct.cube_type, ct.scramble_subset)}
				/>
			))}
		</div>
	);
}
