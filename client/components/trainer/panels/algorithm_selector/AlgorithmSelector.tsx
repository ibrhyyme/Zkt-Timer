import React, {useState, useEffect, useMemo, useCallback, useRef} from 'react';
import {useDispatch as useReduxDispatch} from 'react-redux';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';
import Checkbox from '../../../common/checkbox/Checkbox';
import {useAlgorithmData, getBestTime, getLearnedStatus, fetchLibraryCategory, getCustomAlternatives} from '../../hooks/useAlgorithmData';
import {algToId, getAdjacentFaces, getDefaultFrontFace, isCubeShapePuzzle, isLLCategory, isIsometricCategory, isTopFaceOnlyCategory} from '../../../../util/trainer/algorithm_engine';
import {useLLPatternsReady} from '../../../../util/trainer/ll_patterns';
import {usePuzzlePatternsReady} from '../../../../util/trainer/puzzle_patterns';
import {useIsometricPatternsReady} from '../../../../util/trainer/isometric_patterns';
import {openModal} from '../../../../actions/general';
import AlgorithmCard from './AlgorithmCard';
import type {CheckedAlgorithm, CubeFace} from '../../types';
import {useTranslation} from 'react-i18next';
import {CaretDown, Play, Info, X, DownloadSimple, Plus} from 'phosphor-react';
import {useMe} from '../../../../util/hooks/useMe';
import {isPro} from '../../../../lib/pro';
import {openProOnlyModal} from '../../../common/pro_only/openProOnlyModal';
import {algSetCaseKey} from '../../../../../shared/trainer/alg_sets';
import {LARGE_CATEGORIES, categoryInfoKey} from '../../../../util/trainer/catalog';
import {checkedKey} from '../../../../util/trainer/set_queue';
import {isHiddenSubset, subsetLabel} from '../../../../util/trainer/subset_label';
import {openAddToSet} from '../../sets/AddToSetSheet';
import {toAddItems} from '../../sets/add_items';
import {useBackdropClose} from '../../../../util/hooks/useBackdropClose';

const b = block('trainer');

const F2L_SLOTS = ['Front Right', 'Front Left', 'Back Right', 'Back Left'];

// Cards drawn per step: a large category (1LLL has 3,397 cases) is drawn as the list scrolls.
const CARD_PAGE = 120;

/**
 * One category's page (/trainer/algorithms/<slug>): its groups and cases. The category comes from
 * the address (useTrainerUrlSync); the category list (AlgorithmCatalog) is one step back.
 */
export default function AlgorithmSelector() {
	const {t} = useTranslation();
	const reduxDispatch = useReduxDispatch();
	const {state, dispatch} = useTrainerContext();
	const {selectedCategory, selectedSubsets, checkedAlgorithms, options} = state;
	const me = useMe();
	const {getSubsets, getAlgorithmsWithSubset} = useAlgorithmData();
	const [pdfLoading, setPdfLoading] = useState(false);
	const isLL = isLLCategory(selectedCategory);
	const isIso = isIsometricCategory(selectedCategory);
	const effectiveFrontFace = (isLL || isIso) ? getDefaultFrontFace(options.topFace) : options.frontFace;
	const isF2L = selectedCategory === 'F2L';
	const [slotFilter, setSlotFilter] = useState('all');
	const [showCatInfo, setShowCatInfo] = useState(false);
	const catInfoBackdrop = useBackdropClose(() => setShowCatInfo(false));
	useLLPatternsReady(); // Re-render cards when patterns are loaded
	usePuzzlePatternsReady(); // Re-render cards when puzzle patterns are loaded
	useIsometricPatternsReady(); // Re-render cards when isometric patterns are loaded

	// The F2L slot filter belongs to the category it was set in.
	useEffect(() => {
		setSlotFilter('all');
	}, [selectedCategory]);

	const subsets = useMemo(() => {
		if (!selectedCategory) return [];
		return getSubsets(selectedCategory);
	}, [selectedCategory, getSubsets]);

	const visibleSubsets = useMemo(() => subsets.filter((s) => !isHiddenSubset(s)), [subsets]);

	// A category opens with its cases on screen: every group ticked, once per opening, so clearing
	// them stays possible. The large ones open on their groups: 1LLL has 49 of them, and the PDF
	// button exports whatever is listed.
	const openedCategoryRef = useRef('');
	useEffect(() => {
		if (subsets.length === 0 || openedCategoryRef.current === selectedCategory) return;
		openedCategoryRef.current = selectedCategory;
		if (selectedSubsets.length === 0 && !LARGE_CATEGORIES.has(selectedCategory)) {
			dispatch({type: 'SET_SUBSETS', payload: subsets});
		}
	}, [subsets, selectedCategory, selectedSubsets, dispatch]);

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

	// The cards on screen, CARD_PAGE more each time the end of the list comes near. Selecting
	// still works on the whole list; only drawing waits.
	const visibleCards = useMemo(
		() => filteredAlgorithmsWithSubset.flatMap((group) => group.algorithms.map((alg) => ({alg, subset: group.subset}))),
		[filteredAlgorithmsWithSubset]
	);
	const [cardLimit, setCardLimit] = useState(CARD_PAGE);
	const moreCardsRef = useRef<HTMLDivElement>(null);
	const hasMoreCards = visibleCards.length > cardLimit;
	useEffect(() => {
		setCardLimit(CARD_PAGE);
	}, [selectedCategory, selectedSubsets, slotFilter]);
	useEffect(() => {
		const sentinel = moreCardsRef.current;
		if (!hasMoreCards || !sentinel || typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) setCardLimit((limit) => limit + CARD_PAGE);
			},
			{rootMargin: '600px'}
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [hasMoreCards, cardLimit]);

	// Checked cards by `category::name`: algorithm text is not unique across categories.
	const checkedAlgSet = useMemo(
		() => new Set(checkedAlgorithms.map(checkedKey)),
		[checkedAlgorithms]
	);
	const isChecked = useCallback(
		(name: string) => checkedAlgSet.has(algSetCaseKey(selectedCategory, name)),
		[checkedAlgSet, selectedCategory]
	);

	// selectLearning: when enabled, select learning-status (status=1) algorithms, when disabled, clear selection
	const prevSelectLearningRef = useRef(options.selectLearning);
	useEffect(() => {
		const prev = prevSelectLearningRef.current;
		prevSelectLearningRef.current = options.selectLearning;

		if (!options.selectLearning) {
			if (prev) {
				// Turned off — clear selection
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
					// The card's group, so a PDF of the checked cards keeps its alternatives.
					subset: algorithmsWithSubset.find((g) => g.algorithms.some((a) => a.name === name))?.subset || '',
				};
				dispatch({type: 'ADD_CHECKED_ALGORITHM', payload: checkedAlg});
			} else {
				dispatch({type: 'REMOVE_CHECKED_ALGORITHM', payload: algSetCaseKey(selectedCategory, name)});
			}
		},
		[selectedCategory, algorithmsWithSubset, dispatch]
	);

	const handleAlgDetail = useCallback(
		(algorithm: string, name: string, category: string, subset: string) => {
			import('./AlgorithmDetailModal').then(({default: AlgorithmDetailModal, ALG_DETAIL_MODAL_WIDTH}) => {
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
						{width: ALG_DETAIL_MODAL_WIDTH, title: name, closeButtonText: t('solve_info.done')}
					)
				);
			});
		},
		[reduxDispatch, state.options.topFace, effectiveFrontFace, t]
	);

	const handleSelectAllAlgs = useCallback(() => {
		// Select All conflicts with selectLearning — disable it
		if (options.selectLearning) {
			dispatch({type: 'SET_OPTIONS', payload: {selectLearning: false}});
		}

		const allAlgs: CheckedAlgorithm[] = [];
		for (const group of filteredAlgorithmsWithSubset) {
			for (const alg of group.algorithms) {
				if (!isChecked(alg.name)) {
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
	}, [filteredAlgorithmsWithSubset, checkedAlgorithms, isChecked, selectedCategory, dispatch, options.selectLearning]);

	const handleDeselectAllAlgs = useCallback(() => {
		if (options.selectLearning) {
			dispatch({type: 'SET_OPTIONS', payload: {selectLearning: false}});
		}

		if (isF2L && slotFilter !== 'all') {
			const visibleAlgs = new Set<string>();
			for (const group of filteredAlgorithmsWithSubset) {
				for (const alg of group.algorithms) {
					visibleAlgs.add(algSetCaseKey(selectedCategory, alg.name));
				}
			}
			dispatch({
				type: 'SET_CHECKED_ALGORITHMS',
				payload: checkedAlgorithms.filter((a) => !visibleAlgs.has(checkedKey(a))),
			});
		} else {
			dispatch({type: 'SET_CHECKED_ALGORITHMS', payload: []});
		}
	}, [dispatch, isF2L, slotFilter, filteredAlgorithmsWithSubset, checkedAlgorithms, options.selectLearning, selectedCategory]);

	const handlePdfExport = useCallback(async () => {
		if (!isPro(me)) {
			openProOnlyModal(reduxDispatch, t, 'trainer_pdf');
			return;
		}

		// If selected algorithms exist, use them; otherwise use all visible algorithms
		const baseAlgs = checkedAlgorithms.length > 0
			? checkedAlgorithms.map((a) => ({name: a.name, algorithm: a.algorithm, subset: a.subset}))
			: filteredAlgorithmsWithSubset.flatMap((group) =>
				group.algorithms.map((alg) => ({name: alg.name, algorithm: alg.algorithm, subset: group.subset}))
			);

		if (baseAlgs.length === 0) return;

		setPdfLoading(true);
		try {
			// Load default alternatives
			const categoryData = await fetchLibraryCategory(selectedCategory);

			// Merge default + custom alternatives for each algorithm
			const algsToExport = baseAlgs.map((alg) => {
				const subsetData = categoryData.find((s) => s.subset === alg.subset);
				const entry = subsetData?.algorithms.find((a) => a.name === alg.name);
				const defaultAlts = entry?.alternatives || [];
				const customAlts = getCustomAlternatives(selectedCategory, alg.subset, alg.name);
				const allAlts = [...defaultAlts, ...customAlts];
				return {...alg, alternatives: allAlts};
			});

			const description = t(`trainer.cat_info.${categoryInfoKey(selectedCategory)}.desc`, {defaultValue: ''});

			const {generateTrainerPdf} = await import('../../../../util/trainer/pdf_export');
			await generateTrainerPdf({
				category: selectedCategory,
				categoryDescription: description || undefined,
				algorithms: algsToExport,
				topFace: options.topFace,
				frontFace: effectiveFrontFace,
			});
		} finally {
			setPdfLoading(false);
		}
	}, [me, checkedAlgorithms, filteredAlgorithmsWithSubset, selectedCategory, options.topFace, effectiveFrontFace, reduxDispatch, t]);

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

	const catInfoKey = categoryInfoKey(selectedCategory);
	const catInfoTitle = t(`trainer.cat_info.${catInfoKey}.title`, {defaultValue: ''});
	const catInfoDesc = t(`trainer.cat_info.${catInfoKey}.desc`, {defaultValue: ''});

	const allSubsetsSelected = subsets.length > 0 && subsets.every((s) => selectedSubsets.includes(s));

	const allAlgsSelected = filteredAlgorithmsWithSubset.length > 0 &&
		filteredAlgorithmsWithSubset.every((g) => g.algorithms.every((a) => isChecked(a.name)));

	const hasCatInfo = !!catInfoTitle && !!catInfoDesc;
	const cubeShape = isCubeShapePuzzle(selectedCategory);

	// A cold category address, until the library names the category.
	if (!selectedCategory) return null;

	return (
		<div className={b('selector')}>
			{/* Phone: the category's long name opens its description (the side panel is hidden there). */}
			{hasCatInfo && (
				<button type="button" className={b('cat-info-btn')} onClick={() => setShowCatInfo(true)}>
					<Info size={18} weight="fill" aria-hidden="true" />
					<span>{catInfoTitle}</span>
				</button>
			)}

			{/* Top area: orientation filters and the category description */}
			{(cubeShape || hasCatInfo) && (
				<div className={b('selector-top', {'info-only': !cubeShape})}>
					{cubeShape && (
						<div className={b('selector-filters-block')}>
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
						</div>
					)}

					{hasCatInfo && (
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
			)}

			{/* Subset Checkboxes */}
			{visibleSubsets.length > 0 && (
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
						{visibleSubsets.map((subset) => (
							<Checkbox
								key={subset}
								text={subsetLabel(t, subset)}
								name={subset}
								checked={selectedSubsets.includes(subset)}
								onChange={handleSubsetToggle}
								noMargin
							/>
						))}
					</div>
					{selectedSubsets.length === 0 ? <p className={b('selector-hint')}>{t('trainer.catalog.pick_group')}</p> : null}
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
							{me && checkedAlgorithms.length > 0 && (
								<button
									type="button"
									className={b('selector-action-btn', {set: true})}
									onClick={() => openAddToSet(reduxDispatch, t, toAddItems(checkedAlgorithms))}
								>
									<Plus size={13} weight="bold" aria-hidden="true" />
									{t('trainer.sets.add_to.button')}
								</button>
							)}
							<button
								className={b('selector-action-btn')}
								onClick={allAlgsSelected ? handleDeselectAllAlgs : handleSelectAllAlgs}
							>
								{allAlgsSelected ? t('trainer.deselect_all') : t('trainer.select_all')}
							</button>
							<button
								className={b('selector-action-btn', {'pdf': true})}
								onClick={handlePdfExport}
								disabled={pdfLoading}
								title={t('trainer.export_pdf')}
								aria-label={t('trainer.export_pdf')}
							>
								<DownloadSimple size={13} weight="bold" aria-hidden="true" />
								{pdfLoading ? '...' : 'PDF'}
							</button>
						</div>
					</div>
					<div className={b('selector-algs')}>
						{visibleCards.slice(0, cardLimit).map(({alg, subset}) => (
							<AlgorithmCard
								key={alg.name}
								name={alg.name}
								algorithm={alg.algorithm}
								category={selectedCategory}
								subset={subset}
								checked={isChecked(alg.name)}
								onToggle={handleAlgToggle}
								onDetail={handleAlgDetail}
								topFace={options.topFace}
								frontFace={effectiveFrontFace}
							/>
						))}
					</div>
					{hasMoreCards ? <div ref={moreCardsRef} className={b('selector-more')} aria-hidden="true" /> : null}
				</div>
			)}
		{showCatInfo && catInfoTitle && catInfoDesc && (
				<div className={b('cat-info-overlay')} {...catInfoBackdrop}>
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
