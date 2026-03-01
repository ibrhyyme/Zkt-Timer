import React from 'react';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';

const b = block('trainer');

export default function AlgDisplay() {
	const {state} = useTrainerContext();
	const {userAlg, isMoveMasked} = state;

	if (!userAlg.length || isMoveMasked) return null;

	return (
		<div className={b('alg-display')}>
			{userAlg.map((move, index) => (
				<span key={`${move}-${index}`} className={b('alg-move')}>
					{move}
				</span>
			))}
		</div>
	);
}
