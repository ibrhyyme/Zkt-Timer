import React, {useState, useEffect, useCallback} from 'react';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';
import {expandNotation} from '../../../../util/trainer/algorithm_engine';
import {fetchDefaultAlgs, saveAlgorithm, getCustomAlternatives} from '../../hooks/useAlgorithmData';
import {useTranslation} from 'react-i18next';
import {Check} from 'phosphor-react';
import {gqlQueryTyped} from '../../../api';
import {useMe} from '../../../../util/hooks/useMe';
import {TrainerAlternativesDocument} from '../../../../@types/generated/graphql';

const b = block('trainer');

export default function AlternativesPicker() {
	const {t} = useTranslation();
	const {state, dispatch} = useTrainerContext();
	const {currentAlgorithm} = state;
	const me = useMe();

	const [alternatives, setAlternatives] = useState<string[]>([]);

	useEffect(() => {
		if (!currentAlgorithm) {
			setAlternatives([]);
			return;
		}

		const loadAlts = async () => {
			const defaults = await fetchDefaultAlgs();
			const categoryData = defaults[currentAlgorithm.category];
			if (!categoryData) {
				setAlternatives([]);
				return;
			}

			let primaryAlg = '';
			let defaultAlts: string[] = [];
			let subset = '';
			for (const sub of categoryData) {
				const entry = sub.algorithms.find((a: any) => a.name === currentAlgorithm.name);
				if (entry) {
					primaryAlg = entry.algorithm;
					defaultAlts = (entry as any).alternatives || [];
					subset = sub.subset;
					break;
				}
			}

			if (!primaryAlg) {
				setAlternatives([]);
				return;
			}

			const customAlts = getCustomAlternatives(currentAlgorithm.category, subset, currentAlgorithm.name);

			// DB'den global alternatifleri cek
			let dbAlts: string[] = [];
			if (me) {
				try {
					const res = await gqlQueryTyped(TrainerAlternativesDocument, {
						category: currentAlgorithm.category,
						caseName: currentAlgorithm.name,
					});
					if (res?.data?.trainerAlternatives) {
						dbAlts = res.data.trainerAlternatives.map((a) => a.original_input);
					}
				} catch {}
			}

			// Merge: primary + defaults + DB + localStorage custom, dedup
			const combined = [primaryAlg, ...defaultAlts];
			const seen = new Set(combined.map((a) => expandNotation(a)));

			for (const alt of dbAlts) {
				const exp = expandNotation(alt);
				if (!seen.has(exp)) {
					combined.push(alt);
					seen.add(exp);
				}
			}
			for (const alt of customAlts) {
				const exp = expandNotation(alt);
				if (!seen.has(exp)) {
					combined.push(alt);
					seen.add(exp);
				}
			}

			if (combined.length > 1) {
				setAlternatives(combined);
			} else {
				setAlternatives([]);
			}
		};

		loadAlts();
	}, [currentAlgorithm?.name, currentAlgorithm?.category, me]);

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
