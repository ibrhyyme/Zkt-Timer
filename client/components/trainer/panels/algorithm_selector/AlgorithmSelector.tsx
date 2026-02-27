import React, {useEffect, useMemo, useCallback} from 'react';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';
import {useAlgorithmData, getBestTime} from '../../hooks/useAlgorithmData';
import {algToId, expandNotation, getAdjacentFaces, getDefaultFrontFace} from '../../../../util/trainer/algorithm_engine';
import {useLLPatternsReady} from '../../../../util/trainer/ll_patterns';
import AlgorithmCard from './AlgorithmCard';
import Checkbox from '../../../common/checkbox/Checkbox';
import ProOnly from '../../../common/pro_only/ProOnly';
import type {CheckedAlgorithm, CubeFace} from '../../types';
import {useTranslation} from 'react-i18next';
import {CaretDown, Play} from 'phosphor-react';
import AlgorithmInput from './AlgorithmInput';

const b = block('trainer');

export default function AlgorithmSelector() {
	const {t} = useTranslation();
	const {state, dispatch} = useTrainerContext();
	const {selectedCategory, selectedSubsets, checkedAlgorithms} = state;
	const {categories, getSubsets, getAlgorithmsWithSubset} = useAlgorithmData();
	useLLPatternsReady(); // Pattern yüklendiğinde kartları yeniden render et

	// Auto-select first category
	useEffect(() => {
		if (!selectedCategory && categories.length > 0) {
			dispatch({type: 'SET_CATEGORY', payload: categories[0]});
		}
	}, [categories, selectedCategory, dispatch]);

	const subsets = useMemo(() => {
		if (!selectedCategory) return [];
		return getSubsets(selectedCategory);
	}, [selectedCategory, getSubsets]);

	const algorithmsWithSubset = useMemo(() => {
		if (!selectedCategory || selectedSubsets.length === 0) return [];
		return getAlgorithmsWithSubset(selectedCategory, selectedSubsets);
	}, [selectedCategory, selectedSubsets, getAlgorithmsWithSubset]);

	const checkedAlgSet = useMemo(
		() => new Set(checkedAlgorithms.map((a) => a.algorithm)),
		[checkedAlgorithms]
	);

	const handleCategoryChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			dispatch({type: 'SET_CATEGORY', payload: e.target.value});
		},
		[dispatch]
	);

	const handleSubsetToggle = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const subset = e.target.name;
			const newSubsets = e.target.checked
				? [...selectedSubsets, subset]
				: selectedSubsets.filter((s) => s !== subset);
			dispatch({type: 'SET_SUBSETS', payload: newSubsets});
		},
		[selectedSubsets, dispatch]
	);

	const handleSelectAllSubsets = useCallback(() => {
		dispatch({type: 'SET_SUBSETS', payload: subsets});
	}, [subsets, dispatch]);

	const handleDeselectAllSubsets = useCallback(() => {
		dispatch({type: 'SET_SUBSETS', payload: []});
	}, [dispatch]);

	const handleAlgToggle = useCallback(
		(algorithm: string, name: string, checked: boolean) => {
			if (checked) {
				const algId = algToId(algorithm);
				const bestTime = getBestTime(algId);
				const checkedAlg: CheckedAlgorithm = {
					algorithm,
					name,
					bestTime,
					category: selectedCategory,
					subset: '',
				};
				dispatch({type: 'ADD_CHECKED_ALGORITHM', payload: checkedAlg});
			} else {
				dispatch({type: 'REMOVE_CHECKED_ALGORITHM', payload: algorithm});
			}
		},
		[selectedCategory, dispatch]
	);

	const handleSelectAllAlgs = useCallback(() => {
		const allAlgs: CheckedAlgorithm[] = [];
		for (const group of algorithmsWithSubset) {
			for (const alg of group.algorithms) {
				if (!checkedAlgSet.has(alg.algorithm)) {
					allAlgs.push({
						algorithm: alg.algorithm,
						name: alg.name,
						bestTime: getBestTime(algToId(alg.algorithm)),
						category: selectedCategory,
						subset: group.subset,
					});
				}
			}
		}
		dispatch({
			type: 'SET_CHECKED_ALGORITHMS',
			payload: [...checkedAlgorithms, ...allAlgs],
		});
	}, [algorithmsWithSubset, checkedAlgorithms, checkedAlgSet, selectedCategory, dispatch]);

	const handleDeselectAllAlgs = useCallback(() => {
		dispatch({type: 'SET_CHECKED_ALGORITHMS', payload: []});
	}, [dispatch]);

	const handleOptionChange = useCallback(
		(key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
			dispatch({type: 'SET_OPTIONS', payload: {[key]: e.target.checked}});
		},
		[dispatch]
	);

	const handleTopFaceChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			const newTop = e.target.value as CubeFace;
			const adjacent = getAdjacentFaces(newTop);
			const currentFront = state.options.frontFace;
			const newFront = adjacent.includes(currentFront) ? currentFront : getDefaultFrontFace(newTop);
			dispatch({type: 'SET_OPTIONS', payload: {topFace: newTop, frontFace: newFront}});
		},
		[dispatch, state.options.frontFace]
	);

	const handleFrontFaceChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			dispatch({type: 'SET_OPTIONS', payload: {frontFace: e.target.value as CubeFace}});
		},
		[dispatch]
	);

	const {options} = state;
	const adjacentFaces = useMemo(() => getAdjacentFaces(options.topFace), [options.topFace]);

	return (
		<div className={b('selector')}>
			{/* 3D Cube + Algorithm Input — Pro only */}
			<ProOnly>
				<AlgorithmInput />
			</ProOnly>

			{/* Top Row: Category + Options */}
			<div className={b('selector-top')}>
				<div className={b('selector-section')}>
					<label className={b('selector-label')}>{t('trainer.category')}</label>
					<div className={b('selector-dropdown')}>
						<select
							value={selectedCategory}
							onChange={handleCategoryChange}
							className={b('selector-select')}
						>
							{categories.map((cat) => (
								<option key={cat} value={cat}>
									{cat}
								</option>
							))}
						</select>
						<CaretDown size={16} className={b('selector-caret')} />
					</div>
				</div>

				<div className={b('selector-section', {grow: true})}>
					<label className={b('selector-label')}>{t('trainer.options')}</label>
					<div className={b('selector-options')}>
						<Checkbox text={t('trainer.option_random_order')} checked={options.randomOrder} onChange={handleOptionChange('randomOrder')} noMargin />
						<Checkbox text={t('trainer.option_select_learning')} checked={options.selectLearning} onChange={handleOptionChange('selectLearning')} noMargin />
						<Checkbox text={t('trainer.option_random_auf')} checked={options.randomizeAUF} onChange={handleOptionChange('randomizeAUF')} noMargin />
						<Checkbox text={t('trainer.option_prioritize_slow')} checked={options.prioritizeSlow} onChange={handleOptionChange('prioritizeSlow')} noMargin />
						<Checkbox text={t('trainer.option_prioritize_failed')} checked={options.prioritizeFailed} onChange={handleOptionChange('prioritizeFailed')} noMargin />
						<Checkbox text={t('trainer.option_show_alg_name')} checked={options.showAlgName} onChange={handleOptionChange('showAlgName')} noMargin />
						<Checkbox text={t('trainer.option_flash_indicator')} checked={options.flashIndicator} onChange={handleOptionChange('flashIndicator')} noMargin />
						<ProOnly>
							<Checkbox text={t('trainer.option_always_scramble_to')} checked={options.alwaysScrambleTo} onChange={handleOptionChange('alwaysScrambleTo')} noMargin />
						</ProOnly>
					</div>
					<div className={b('selector-face-options')}>
						<div className={b('selector-face-group')}>
							<label className={b('selector-face-label')}>{t('trainer.top_layer')}</label>
							<div className={b('selector-dropdown')}>
								<select
									value={options.topFace}
									onChange={handleTopFaceChange}
									className={b('selector-select')}
								>
									{(['U', 'D', 'F', 'B', 'R', 'L'] as CubeFace[]).map((face) => (
										<option key={face} value={face}>
											{t(`trainer.face_${face.toLowerCase()}`)}
										</option>
									))}
								</select>
								<CaretDown size={16} className={b('selector-caret')} />
							</div>
						</div>
						<div className={b('selector-face-group')}>
							<label className={b('selector-face-label')}>{t('trainer.front_layer')}</label>
							<div className={b('selector-dropdown')}>
								<select
									value={options.frontFace}
									onChange={handleFrontFaceChange}
									className={b('selector-select')}
								>
									{adjacentFaces.map((face) => (
										<option key={face} value={face}>
											{t(`trainer.face_${face.toLowerCase()}`)}
										</option>
									))}
								</select>
								<CaretDown size={16} className={b('selector-caret')} />
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Subset Checkboxes */}
			{subsets.length > 0 && (
				<div className={b('selector-section')}>
					<div className={b('selector-label-row')}>
						<label className={b('selector-label')}>{t('trainer.subsets')}</label>
						<div className={b('selector-actions')}>
							<button
								className={b('selector-action-btn')}
								onClick={handleSelectAllSubsets}
							>
								{t('trainer.select_all')}
							</button>
							<button
								className={b('selector-action-btn')}
								onClick={handleDeselectAllSubsets}
							>
								{t('trainer.deselect_all')}
							</button>
						</div>
					</div>
					<div className={b('selector-subsets')}>
						{subsets.map((subset) => (
							<Checkbox
								key={subset}
								text={subset}
								name={subset}
								checked={selectedSubsets.includes(subset)}
								onChange={handleSubsetToggle}
								noMargin
							/>
						))}
					</div>
				</div>
			)}

			{/* Algorithm Cards */}
			{algorithmsWithSubset.length > 0 && (
				<div className={b('selector-section')}>
					<div className={b('selector-label-row')}>
						<label className={b('selector-label')}>
							{t('trainer.algorithms')} ({checkedAlgorithms.length})
						</label>
						<div className={b('selector-actions')}>
							<button
								className={b('selector-action-btn')}
								onClick={handleSelectAllAlgs}
							>
								{t('trainer.select_all')}
							</button>
							<button
								className={b('selector-action-btn')}
								onClick={handleDeselectAllAlgs}
							>
								{t('trainer.deselect_all')}
							</button>
						</div>
					</div>
					<div className={b('selector-algs')}>
						{algorithmsWithSubset.map((group) =>
							group.algorithms.map((alg) => (
								<AlgorithmCard
									key={alg.algorithm}
									name={alg.name}
									algorithm={alg.algorithm}
									category={selectedCategory}
									subset={group.subset}
									checked={checkedAlgSet.has(alg.algorithm)}
									onToggle={handleAlgToggle}
									topFace={options.topFace}
									frontFace={options.frontFace}
								/>
							))
						)}
					</div>
				</div>
			)}

			{/* Start Training Button */}
			{checkedAlgorithms.length > 0 && (
				<button
					className={b('selector-start')}
					onClick={() => dispatch({type: 'SET_VIEW', payload: 'training'})}
				>
					<Play size={18} weight="fill" />
					{t('trainer.start_training')} ({checkedAlgorithms.length})
				</button>
			)}
		</div>
	);
}
