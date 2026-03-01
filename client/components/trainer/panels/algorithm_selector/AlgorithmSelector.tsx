import React, {useState, useEffect, useMemo, useCallback, useRef} from 'react';
import {useDispatch as useReduxDispatch} from 'react-redux';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';
import {useAlgorithmData, getBestTime, getLearnedStatus} from '../../hooks/useAlgorithmData';
import {algToId, expandNotation, getAdjacentFaces, getDefaultFrontFace, isCubeShapePuzzle, isLLCategory, isTopFaceOnlyCategory} from '../../../../util/trainer/algorithm_engine';
import {useLLPatternsReady} from '../../../../util/trainer/ll_patterns';
import {usePuzzlePatternsReady} from '../../../../util/trainer/puzzle_patterns';
import {openModal} from '../../../../actions/general';
import AlgorithmCard from './AlgorithmCard';
import Checkbox from '../../../common/checkbox/Checkbox';
import type {CheckedAlgorithm, CubeFace} from '../../types';
import {useTranslation} from 'react-i18next';
import {CaretDown, Play, Info, X} from 'phosphor-react';

const b = block('trainer');

// Explicit overrides for categories that don't follow prefix convention
const CATEGORY_CUBE_TYPE: Record<string, string> = {
	'Sarah Intermediate': 'Skewb',
	'Sarah Advanced': 'Skewb',
	'CMLL': '3x3 Roux',
	'2-Look CMLL': '3x3 Roux',
	'OH-CMLL': '3x3 Roux',
	'L6E-EO': '3x3 Roux',
	'L6E-EOLR': '3x3 Roux',
};

const CUBE_TYPE_ORDER = ['3x3', '3x3 Roux', '2x2', '4x4', 'Pyraminx', 'Skewb', 'Square-1'];

const F2L_SLOTS = ['Front Right', 'Front Left', 'Back Right', 'Back Left'];

function getCubeType(category: string): string {
	if (CATEGORY_CUBE_TYPE[category]) return CATEGORY_CUBE_TYPE[category];
	if (category.startsWith('2x2 ')) return '2x2';
	if (category.startsWith('4x4 ')) return '4x4';
	if (category.startsWith('Pyraminx ')) return 'Pyraminx';
	if (category.startsWith('SQ1 ')) return 'Square-1';
	return '3x3';
}

function getCategoryDisplayName(category: string): string {
	const prefixes = ['2x2 ', '4x4 ', 'Pyraminx ', 'SQ1 '];
	for (const prefix of prefixes) {
		if (category.startsWith(prefix)) return category.slice(prefix.length);
	}
	return category;
}

export default function AlgorithmSelector() {
	const {t} = useTranslation();
	const reduxDispatch = useReduxDispatch();
	const {state, dispatch} = useTrainerContext();
	const {selectedCategory, selectedSubsets, checkedAlgorithms, options} = state;
	const {categories, getSubsets, getAlgorithmsWithSubset} = useAlgorithmData();
	const isLL = isLLCategory(selectedCategory);
	const effectiveFrontFace = isLL ? getDefaultFrontFace(options.topFace) : options.frontFace;
	const isF2L = selectedCategory === 'F2L';
	const [slotFilter, setSlotFilter] = useState('all');
	const [showCatInfo, setShowCatInfo] = useState(false);
	useLLPatternsReady(); // Pattern yuklendiginde kartlari yeniden render et
	usePuzzlePatternsReady(); // Puzzle pattern'leri yuklendiginde kartlari yeniden render et

	// Derive cube types and filtered categories
	const cubeTypes = useMemo(() => {
		const available = new Set(categories.map(getCubeType));
		return CUBE_TYPE_ORDER.filter((ct) => available.has(ct));
	}, [categories]);

	const currentCubeType = useMemo(
		() => (selectedCategory ? getCubeType(selectedCategory) : cubeTypes[0] || '3x3'),
		[selectedCategory, cubeTypes]
	);

	const filteredCategories = useMemo(
		() => categories.filter((cat) => getCubeType(cat) === currentCubeType),
		[categories, currentCubeType]
	);

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

	const filteredAlgorithmsWithSubset = useMemo(() => {
		if (!isF2L || slotFilter === 'all') return algorithmsWithSubset;
		return algorithmsWithSubset
			.map((group) => ({
				...group,
				algorithms: group.algorithms.filter((a) => a.name.endsWith(slotFilter)),
			}))
			.filter((group) => group.algorithms.length > 0);
	}, [algorithmsWithSubset, slotFilter, isF2L]);

	const checkedAlgSet = useMemo(
		() => new Set(checkedAlgorithms.map((a) => a.algorithm)),
		[checkedAlgorithms]
	);

	// selectLearning: acildiginda turuncu bayrakli (status=1) algoritmalari sec, kapatildiginda temizle
	const prevSelectLearningRef = useRef(options.selectLearning);
	useEffect(() => {
		const prev = prevSelectLearningRef.current;
		prevSelectLearningRef.current = options.selectLearning;

		if (!options.selectLearning) {
			if (prev) {
				// Kapatildi — secimi temizle
				dispatch({type: 'SET_CHECKED_ALGORITHMS', payload: []});
			}
			return;
		}

		if (filteredAlgorithmsWithSubset.length === 0) return;

		const learningAlgs: CheckedAlgorithm[] = [];
		for (const group of filteredAlgorithmsWithSubset) {
			for (const alg of group.algorithms) {
				const algId = algToId(alg.algorithm);
				if (getLearnedStatus(algId) === 1) {
					learningAlgs.push({
						algorithm: alg.algorithm,
						name: alg.name,
						bestTime: getBestTime(algId),
						category: selectedCategory,
						subset: group.subset,
					});
				}
			}
		}
		dispatch({type: 'SET_CHECKED_ALGORITHMS', payload: learningAlgs});
	}, [options.selectLearning, filteredAlgorithmsWithSubset, selectedCategory, dispatch]);

	const handleCubeTypeChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			const newType = e.target.value;
			const firstCat = categories.find((cat) => getCubeType(cat) === newType);
			if (firstCat) {
				dispatch({type: 'SET_CATEGORY', payload: firstCat});
			}
		},
		[categories, dispatch]
	);

	const handleCategoryChange = useCallback(
		(e: React.ChangeEvent<HTMLSelectElement>) => {
			dispatch({type: 'SET_CATEGORY', payload: e.target.value});
			setSlotFilter('all');
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

	const handleAlgDetail = useCallback(
		(algorithm: string, name: string, category: string, subset: string) => {
			import('./AlgorithmDetailModal').then(({default: AlgorithmDetailModal}) => {
				reduxDispatch(
					openModal(
						<AlgorithmDetailModal
							name={name}
							algorithm={algorithm}
							category={category}
							subset={subset}
							topFace={state.options.topFace}
							frontFace={effectiveFrontFace}
						/>,
						{width: 500, title: name}
					)
				);
			});
		},
		[reduxDispatch, state.options.topFace, effectiveFrontFace]
	);

	const handleSelectAllAlgs = useCallback(() => {
		// Select All ile selectLearning cakisir — kapat
		if (options.selectLearning) {
			dispatch({type: 'SET_OPTIONS', payload: {selectLearning: false}});
		}

		const allAlgs: CheckedAlgorithm[] = [];
		for (const group of filteredAlgorithmsWithSubset) {
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
	}, [filteredAlgorithmsWithSubset, checkedAlgorithms, checkedAlgSet, selectedCategory, dispatch, options.selectLearning]);

	const handleDeselectAllAlgs = useCallback(() => {
		if (options.selectLearning) {
			dispatch({type: 'SET_OPTIONS', payload: {selectLearning: false}});
		}

		if (isF2L && slotFilter !== 'all') {
			const visibleAlgs = new Set<string>();
			for (const group of filteredAlgorithmsWithSubset) {
				for (const alg of group.algorithms) {
					visibleAlgs.add(alg.algorithm);
				}
			}
			dispatch({
				type: 'SET_CHECKED_ALGORITHMS',
				payload: checkedAlgorithms.filter((a) => !visibleAlgs.has(a.algorithm)),
			});
		} else {
			dispatch({type: 'SET_CHECKED_ALGORITHMS', payload: []});
		}
	}, [dispatch, isF2L, slotFilter, filteredAlgorithmsWithSubset, checkedAlgorithms, options.selectLearning]);

	const handleOptionChange = useCallback(
		(key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
			const updates: Record<string, boolean> = {[key]: e.target.checked};

			// Mutual exclusion: randomOrder <-> prioritizeSlow
			if (key === 'randomOrder' && e.target.checked) {
				updates.prioritizeSlow = false;
			} else if (key === 'prioritizeSlow' && e.target.checked) {
				updates.randomOrder = false;
			}

			dispatch({type: 'SET_OPTIONS', payload: updates});
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

	const adjacentFaces = useMemo(() => getAdjacentFaces(options.topFace), [options.topFace]);

	const catInfoKey = selectedCategory.toLowerCase().replace(/[\s-]+/g, '_');
	const catInfoTitle = t(`trainer.cat_info.${catInfoKey}.title`, {defaultValue: ''});
	const catInfoDesc = t(`trainer.cat_info.${catInfoKey}.desc`, {defaultValue: ''});

	const allSubsetsSelected = subsets.length > 0 && subsets.every((s) => selectedSubsets.includes(s));

	const allAlgsSelected = filteredAlgorithmsWithSubset.length > 0 &&
		filteredAlgorithmsWithSubset.every((g) => g.algorithms.every((a) => checkedAlgSet.has(a.algorithm)));

	return (
		<div className={b('selector')}>
			{/* Top Area: Sol Blok (Filtreler) + Orta Blok (Secenekler) */}
			<div className={b('selector-top')}>
				<div className={b('selector-filters-block')}>
					<div className={b('selector-filter-row')}>
						<div className={b('selector-section')}>
							<label className={b('selector-label')}>{t('trainer.puzzle_type')}</label>
							<div className={b('selector-dropdown')}>
								<select
									value={currentCubeType}
									onChange={handleCubeTypeChange}
									className={b('selector-select')}
								>
									{cubeTypes.map((ct) => (
										<option key={ct} value={ct}>
											{ct}
										</option>
									))}
								</select>
								<CaretDown size={16} className={b('selector-caret')} />
							</div>
						</div>

						<div className={b('selector-section')}>
							<label className={b('selector-label')}>{t('trainer.category')}</label>
							<div className={b('selector-category-row')}>
								<div className={b('selector-dropdown')}>
									<select
										value={selectedCategory}
										onChange={handleCategoryChange}
										className={b('selector-select')}
									>
										{filteredCategories.map((cat) => (
											<option key={cat} value={cat}>
												{getCategoryDisplayName(cat)}
											</option>
										))}
									</select>
									<CaretDown size={16} className={b('selector-caret')} />
								</div>
								{catInfoTitle && (
									<button className={b('cat-info-btn')} onClick={() => setShowCatInfo(true)} title={catInfoTitle}>
										<Info size={18} weight="fill" />
									</button>
								)}
							</div>
						</div>
					</div>

					{isCubeShapePuzzle(selectedCategory) && (
						<>
							<div className={b('selector-filter-row')}>
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
								{!isTopFaceOnlyCategory(selectedCategory) && (
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
								)}
							</div>
							{isF2L && (
								<div className={b('selector-filter-row')}>
									<div className={b('selector-face-group')}>
										<label className={b('selector-face-label')}>{t('trainer.f2l_slot')}</label>
										<div className={b('selector-dropdown')}>
											<select
												value={slotFilter}
												onChange={(e) => setSlotFilter(e.target.value)}
												className={b('selector-select')}
											>
												<option value="all">{t('trainer.f2l_slot_all')}</option>
												{F2L_SLOTS.map((slot) => (
													<option key={slot} value={slot}>
														{t(`trainer.f2l_slot_${slot.toLowerCase().replace(' ', '_')}`)}
													</option>
												))}
											</select>
											<CaretDown size={16} className={b('selector-caret')} />
										</div>
									</div>
								</div>
							)}
						</>
					)}
				</div>

				<div className={b('selector-section')}>
					<label className={b('selector-label')}>{t('trainer.options')}</label>
					<div className={b('selector-options')}>
						<Checkbox text={t('trainer.option_random_order')} checked={options.randomOrder} onChange={handleOptionChange('randomOrder')} noMargin />
						<Checkbox text={t('trainer.option_prioritize_slow')} checked={options.prioritizeSlow} onChange={handleOptionChange('prioritizeSlow')} noMargin />
						<Checkbox text={t('trainer.option_select_learning')} checked={options.selectLearning} onChange={handleOptionChange('selectLearning')} noMargin />
						<Checkbox text={t('trainer.option_random_auf')} checked={options.randomizeAUF} onChange={handleOptionChange('randomizeAUF')} noMargin />
					</div>
				</div>

				{catInfoTitle && catInfoDesc && (
					<div className={b('selector-info')}>
						<div className={b('selector-info-header')}>
							<Info size={16} weight="fill" />
							<span>{catInfoTitle}</span>
						</div>
						{catInfoDesc.split('\n\n').map((p, i) => (
							<p key={i} className={b('selector-info-text')}>{p}</p>
						))}
					</div>
				)}
			</div>

			{/* Subset Checkboxes */}
			{subsets.length > 0 && (
				<div className={b('selector-section')}>
					<div className={b('selector-label-row')}>
						<label className={b('selector-label')}>{t('trainer.subsets')}</label>
						<div className={b('selector-actions')}>
							<button
								className={b('selector-action-btn')}
								onClick={allSubsetsSelected ? handleDeselectAllSubsets : handleSelectAllSubsets}
							>
								{allSubsetsSelected ? t('trainer.deselect_all') : t('trainer.select_all')}
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
			{filteredAlgorithmsWithSubset.length > 0 && (
				<div className={b('selector-section')}>
					<div className={b('selector-label-row')}>
						<label className={b('selector-label')}>
							{t('trainer.algorithms')} ({checkedAlgorithms.length})
						</label>
						<div className={b('selector-actions')}>
							{checkedAlgorithms.length > 0 && (
								<button
									className={b('selector-start-inline')}
									onClick={() => dispatch({type: 'SET_VIEW', payload: 'training'})}
								>
									<Play size={14} weight="fill" />
									{t('trainer.start_training')} ({checkedAlgorithms.length})
								</button>
							)}
							<button
								className={b('selector-action-btn')}
								onClick={allAlgsSelected ? handleDeselectAllAlgs : handleSelectAllAlgs}
							>
								{allAlgsSelected ? t('trainer.deselect_all') : t('trainer.select_all')}
							</button>
						</div>
					</div>
					<div className={b('selector-algs')}>
						{filteredAlgorithmsWithSubset.map((group) =>
							group.algorithms.map((alg) => (
								<AlgorithmCard
									key={alg.algorithm}
									name={alg.name}
									algorithm={alg.algorithm}
									category={selectedCategory}
									subset={group.subset}
									checked={checkedAlgSet.has(alg.algorithm)}
									onToggle={handleAlgToggle}
									onDetail={handleAlgDetail}
									topFace={options.topFace}
									frontFace={effectiveFrontFace}
								/>
							))
						)}
					</div>
				</div>
			)}
		{showCatInfo && catInfoTitle && catInfoDesc && (
				<div className={b('cat-info-overlay')} onClick={() => setShowCatInfo(false)}>
					<div className={b('cat-info-modal')} onClick={(e) => e.stopPropagation()}>
						<div className={b('cat-info-modal-header')}>
							<span className={b('cat-info-modal-title')}>{catInfoTitle}</span>
							<button className={b('cat-info-modal-close')} onClick={() => setShowCatInfo(false)}>
								<X size={20} />
							</button>
						</div>
						<div className={b('cat-info-modal-body')}>
							{catInfoDesc.split('\n\n').map((p, i) => (
								<p key={i} className={b('cat-info-modal-text')}>{p}</p>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
