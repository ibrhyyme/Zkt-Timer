import React, {useState, useEffect, useCallback} from 'react';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';
import {expandNotation} from '../../../../util/trainer/algorithm_engine';
import {fetchDefaultAlgs, saveAlgorithm} from '../../hooks/useAlgorithmData';
import {useTranslation} from 'react-i18next';
import {Check} from 'phosphor-react';

const b = block('trainer');

export default function AlternativesPicker() {
	const {t} = useTranslation();
	const {state, dispatch} = useTrainerContext();
	const {currentAlgorithm} = state;

	const [alternatives, setAlternatives] = useState<string[]>([]);

	useEffect(() => {
		if (!currentAlgorithm) {
			setAlternatives([]);
			return;
		}

		fetchDefaultAlgs().then((defaults) => {
			const categoryData = defaults[currentAlgorithm.category];
			if (!categoryData) {
				setAlternatives([]);
				return;
			}

			// Kategori icinde isme gore ara (isimler kategori icinde unique)
			for (const sub of categoryData) {
				const entry = sub.algorithms.find((a: any) => a.name === currentAlgorithm.name);
				if (entry && (entry as any).alternatives?.length) {
					setAlternatives([entry.algorithm, ...(entry as any).alternatives]);
					return;
				}
			}
			setAlternatives([]);
		});
	}, [currentAlgorithm?.name, currentAlgorithm?.category]);

	const handleSelect = useCallback(
		(alt: string) => {
			if (!currentAlgorithm) return;
			const expandedAlt = expandNotation(alt);
			const expandedCurrent = expandNotation(currentAlgorithm.algorithm);
			if (expandedAlt === expandedCurrent) return;

			saveAlgorithm(currentAlgorithm.category, currentAlgorithm.subset, currentAlgorithm.name, alt);
			dispatch({type: 'SWAP_ALGORITHM', payload: {oldAlg: currentAlgorithm.algorithm, newAlg: alt}});
		},
		[currentAlgorithm, dispatch]
	);

	if (!currentAlgorithm || alternatives.length === 0) return null;

	return (
		<div className={b('alt-picker')}>
			<label className={b('alt-picker-label')}>
				{t('trainer.alg_detail_alternatives')} ({alternatives.length - 1})
			</label>
			<div className={b('alt-picker-list')}>
				{alternatives.map((alt, i) => {
					const isSelected = expandNotation(alt) === expandNotation(currentAlgorithm.algorithm);
					return (
						<button
							key={i}
							className={b('alt-picker-item', {selected: isSelected})}
							onClick={() => handleSelect(alt)}
						>
							<code>{alt}</code>
							{isSelected && <Check size={14} weight="bold" />}
						</button>
					);
				})}
			</div>
		</div>
	);
}
