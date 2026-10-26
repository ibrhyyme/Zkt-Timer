import React, {useState, useEffect, useMemo, useCallback} from 'react';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';
import {useLLPatternsReady} from '../../../../util/trainer/ll_patterns';
import {isLLCategory, getDefaultFrontFace, getPuzzleType, algToId, expandNotation, computeSetupInverse, getEffectiveOrientation, buildRandomAUFAlg, cleanAlgorithmForCubing, ensureCubingReady} from '../../../../util/trainer/algorithm_engine';
import {generateLLPattern} from '../../../../util/trainer/pattern_utils';
import {fetchDefaultAlgs, getLastTimes, getEffectiveTime, deleteTrainerSolve} from '../../hooks/useAlgorithmData';
import {useTrainerDb} from '../../../../util/hooks/useTrainerDb';
import CubeViewer from './CubeViewer';
import TrainerTimer from './TrainerTimer';
import TrainerSmartCube from './TrainerSmartCube';
import AlternativesPicker from '../stats_panel/AlternativesPicker';
import TrainerTimeChart from '../stats_panel/TrainerTimeChart';
import {useTranslation} from 'react-i18next';
import {CaretLeft, CaretRight, CaretDown, CaretUp, X} from 'phosphor-react';
import {useMe} from '../../../../util/hooks/useMe';
import {isPro, isProEnabled} from '../../../../lib/pro';
import {useWakeLock} from '../../../../util/hooks/useWakeLock';
import {distinctCategoryCount, smartSkipSummary} from '../../../../util/trainer/set_queue';
import './SetStudy.scss';

const b = block('trainer');

/** Sets whose Smart Cube filter notice was closed in this app session (trainer-sets 6.5). */
const smartSkipDismissed = new Set<string>();

export default function TrainingArea() {
	const {t} = useTranslation();
	const me = useMe();
	const {state, dispatch} = useTrainerContext();
	useLLPatternsReady();
	const {currentAlgorithm, options} = state;
	const dbVersion = useTrainerDb();

	// Wake lock — timer aktifken ekran sonmesin (smart mode kendi wake lock'unu yonetir)
	useWakeLock(options.wakeLockEnabled && state.timerState === 'RUNNING');

	const hasMultipleAlgorithms = state.checkedAlgorithms.length > 1;

	const [setupAlg, setSetupAlg] = useState<string | null>(null);
	// Random AUF acikken fiilen calisilan (AUF eklenmis) alg + LL pattern override.
	// baseAlg/category ile eslesme kontrolu yapilarak kart degisiminde eski AUF sizmaz.
	const [aufState, setAufState] = useState<{baseAlg: string; category: string; alg: string; pattern: string | null} | null>(null);
	const [showMobileAlts, setShowMobileAlts] = useState(false);

	// Setup algoritmasi + random AUF. currentAlgorithm obje referansina bagli:
	// her ADVANCE (tek kart spread dahil) yeni AUF atar (cubedex davranisi).
	useEffect(() => {
		if (!currentAlgorithm) {
			setSetupAlg(null);
			setAufState(null);
			return;
		}

		let cancelled = false;
		// AUF sadece 3x3 kategorilerinde anlamli (U-yuzu ayari)
		const useAUF = options.randomizeAUF && getPuzzleType(currentAlgorithm.category) === '3x3x3';

		const run = async () => {
			if (useAUF) {
				await ensureCubingReady();
				if (cancelled) return;
				const cleaned = cleanAlgorithmForCubing(currentAlgorithm.algorithm);
				const algMoves = buildRandomAUFAlg(cleaned.split(/\s+/), currentAlgorithm.category, true);
				const effAlg = algMoves.join(' ');
				const inverse = await computeSetupInverse(effAlg);
				if (cancelled) return;
				setSetupAlg(inverse);
				// LL kategorilerde AUF'lu alg pattern JSON'unda bulunmaz — runtime uret ki 2D korunsun
				const pattern = isLLCategory(currentAlgorithm.category)
					? await generateLLPattern(effAlg)
					: null;
				if (cancelled) return;
				setAufState({
					baseAlg: currentAlgorithm.algorithm,
					category: currentAlgorithm.category,
					alg: effAlg,
					pattern,
				});
				return;
			}

			// AUF kapali: mevcut davranis (primary → entry.setup, alt → runtime inverse)
			setAufState(null);
			const defaults = await fetchDefaultAlgs();
			if (cancelled) return;
			const subsets = defaults[currentAlgorithm.category];
			if (!subsets) {
				setSetupAlg(null);
				return;
			}
			for (const sub of subsets) {
				const entry = sub.algorithms.find((a: any) => a.name === currentAlgorithm.name);
				if (entry) {
					// Primary algoritma ise pre-computed Kociemba-optimized setup kullan
					if (expandNotation(entry.algorithm) === expandNotation(currentAlgorithm.algorithm)) {
						if (!cancelled) setSetupAlg(entry.setup || null);
						return;
					}
					// Alternatif secilmisse runtime'da inverse hesapla
					const inverse = await computeSetupInverse(currentAlgorithm.algorithm);
					if (!cancelled) setSetupAlg(inverse);
					return;
				}
			}
			if (!cancelled) setSetupAlg(null);
		};

		run();
		return () => { cancelled = true; };
	}, [currentAlgorithm, options.randomizeAUF]);

	// Algoritma degistiginde mobil alternatifleri kapat
	useEffect(() => {
		setShowMobileAlts(false);
	}, [currentAlgorithm?.algorithm]);

	// Timer calisirken mobil alternatifleri kapat
	useEffect(() => {
		if (state.timerState === 'RUNNING') setShowMobileAlts(false);
	}, [state.timerState]);

	// Disariya tiklaninca alternatifleri kapat
	useEffect(() => {
		if (!showMobileAlts) return;
		const handleClose = () => setShowMobileAlts(false);
		document.addEventListener('click', handleClose);
		return () => document.removeEventListener('click', handleClose);
	}, [showMobileAlts]);

	const chartTimes = useMemo(() => {
		if (!currentAlgorithm) return [];
		const records = getLastTimes(algToId(currentAlgorithm.algorithm));
		return records.map((r) => getEffectiveTime(r)).filter((t): t is number => t !== null);
	}, [currentAlgorithm, dbVersion]);

	// Mobilde training-area'nin herhangi bir yerine dokunarak timer baslatma/durdurma
	const handleAreaTouch = useCallback((e: React.MouseEvent) => {
		if (window.innerWidth > 768) return;
		const target = e.target as HTMLElement;
		// Nav butonlarina veya mobil alg header'a tiklandiginda timer tetikleme
		if (target.closest(`.zt-trainer__timer`) || target.closest(`.zt-trainer__training-nav`) || target.closest(`.zt-trainer__mobile-alg-header`)) return;
		const timerEl = document.querySelector('.zt-trainer__timer') as HTMLElement;
		timerEl?.click();
	}, []);

	const handlePrev = useCallback(() => {
		if (state.timerState === 'RUNNING') return;
		dispatch({type: 'PREVIOUS_ALGORITHM'});
	}, [state.timerState, dispatch]);

	const handleNext = useCallback(() => {
		if (state.timerState === 'RUNNING') return;
		dispatch({type: 'ADVANCE_ALGORITHM'});
	}, [state.timerState, dispatch]);

	// Sol/sag ok + Backspace klavye kisayollari
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (state.timerState === 'RUNNING') return;

			if (hasMultipleAlgorithms && e.code === 'ArrowLeft') {
				e.preventDefault();
				dispatch({type: 'PREVIOUS_ALGORITHM'});
			} else if (hasMultipleAlgorithms && e.code === 'ArrowRight') {
				e.preventDefault();
				dispatch({type: 'ADVANCE_ALGORITHM'});
			} else if (e.code === 'Backspace' && currentAlgorithm) {
				e.preventDefault();
				const algId = algToId(currentAlgorithm.algorithm);
				const records = getLastTimes(algId);
				if (records.length > 0) {
					deleteTrainerSolve(algId, records.length - 1);
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [hasMultipleAlgorithms, state.timerState, dispatch, currentAlgorithm]);

	// ── Set study (trainer-sets 6.1, 6.4, 6.5) ──
	const activeSet = state.activeSet;
	const setItems = activeSet?.items;
	// Smart Cube mode runs only the 3x3 rows of a set; the rest wait for Standard (filterForMode).
	const smartSkip = useMemo(
		() => (setItems && state.mode === 'smart' ? smartSkipSummary(setItems) : null),
		[setItems, state.mode]
	);
	// A category tag above the case name only when the set mixes categories.
	const mixedCategories = useMemo(() => (setItems ? distinctCategoryCount(setItems) > 1 : false), [setItems]);
	const [skipNoticeHidden, setSkipNoticeHidden] = useState(() => !!activeSet && smartSkipDismissed.has(activeSet.id));
	useEffect(() => {
		setSkipNoticeHidden(!!activeSet && smartSkipDismissed.has(activeSet.id));
	}, [activeSet?.id]);
	const dismissSkipNotice = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			if (activeSet) smartSkipDismissed.add(activeSet.id);
			setSkipNoticeHidden(true);
		},
		[activeSet]
	);
	const studyStandard = useCallback(() => {
		dispatch({type: 'SET_STUDY_MODE', payload: 'standard'});
	}, [dispatch]);

	// Cold /trainer/algorithms/train?set=<code>: the set is still loading (useTrainerUrlSync).
	if (state.pendingSetCode && !activeSet) {
		return (
			<div className={b('training-area')}>
				<div className={b('set-state')} role="status">
					<div className={b('set-state-spinner')} aria-hidden="true" />
					<p className={b('set-state-title')}>{t('trainer.sets.loading')}</p>
				</div>
			</div>
		);
	}

	// Smart Cube mode on a set with no 3x3 row: nothing to run here, offer Standard.
	if (activeSet && smartSkip && smartSkip.count > 0 && smartSkip.count === activeSet.items.length) {
		return (
			<div className={b('training-area')}>
				<div className={b('set-state')}>
					<p className={b('set-state-title')}>{t('trainer.sets.smart_none')}</p>
					<button type="button" className={b('set-state-btn')} onClick={studyStandard}>
						{t('trainer.sets.study_standard')}
					</button>
				</div>
			</div>
		);
	}

	if (!currentAlgorithm) {
		return (
			<div className={b('training-area')}>
				<div className={b('training-empty')}>
					<p>{t('trainer.select_algorithms_hint')}</p>
				</div>
			</div>
		);
	}

	const showSkipNotice = !!smartSkip && smartSkip.count > 0 && !skipNoticeHidden;
	const categoryTag =
		mixedCategories && options.showCaseName ? (
			<span className={b('set-category-tag')}>{currentAlgorithm.category}</span>
		) : null;

	const is3x3 = getPuzzleType(currentAlgorithm.category) === '3x3x3';
	// A 2x2 smart cube stays on the link but is not used: the drills match 3x3 patterns.
	const useSmartCube = state.smartConnected && state.smartPuzzle === '333' && is3x3 && (!isProEnabled() || isPro(me));

	// Etkin top/front face — whiteOnBottom aktifse D/F preset'i uygulanir
	const effectiveOrientation = getEffectiveOrientation({
		topFace: options.topFace,
		frontFace: options.frontFace,
		whiteOnBottom: options.whiteOnBottom,
	});
	const cubeViewerTopFace = effectiveOrientation.topFace;
	const cubeViewerFrontFace = isLLCategory(currentAlgorithm.category)
		? getDefaultFrontFace(cubeViewerTopFace)
		: effectiveOrientation.frontFace;

	// Random AUF acikken gosterilecek alg + LL pattern override.
	// aufState yalniz mevcut karta aitse gecerli (kart degisiminde eski AUF gosterilmez).
	const aufActive =
		options.randomizeAUF &&
		aufState != null &&
		aufState.baseAlg === currentAlgorithm.algorithm &&
		aufState.category === currentAlgorithm.category;
	const displayAlg = aufActive ? aufState!.alg : currentAlgorithm.algorithm;
	const llPatternOverride = aufActive ? aufState!.pattern : null;

	return (
		<div className={b('training-area')} onClick={handleAreaTouch}>
			{/* Onceki/Sonraki navigasyon butonlari */}
			{hasMultipleAlgorithms && state.timerState !== 'RUNNING' && (
				<>
					<button className={b('training-nav', {prev: true})} onClick={handlePrev}>
						<CaretLeft size={24} weight="bold" />
					</button>
					<button className={b('training-nav', {next: true})} onClick={handleNext}>
						<CaretRight size={24} weight="bold" />
					</button>
				</>
			)}

			{/* Set in Smart Cube mode: which rows wait for Standard (dismissable, once per session) */}
			{showSkipNotice && (
				<div className={b('set-notice')} role="note" onClick={(e) => e.stopPropagation()}>
					<span>
						{t('trainer.sets.smart_skipped', {
							count: smartSkip!.count,
							puzzles: smartSkip!.cubeTypes.join(', '),
						})}
					</span>
					<button
						type="button"
						className={b('set-notice-close')}
						onClick={dismissSkipNotice}
						aria-label={t('trainer.sets.dismiss')}
						title={t('trainer.sets.dismiss')}
					>
						<X size={16} weight="bold" />
					</button>
				</div>
			)}

			{/* Mobilde: kompakt alg ismi + alternatifler dropdown */}
			{options.showCaseName && (
				<div className={b('mobile-alg-header')} onClick={(e) => {
					e.stopPropagation();
					setShowMobileAlts((v) => !v);
				}}>
					{categoryTag}
					<span className={b('mobile-alg-name')}>{currentAlgorithm.name}</span>
					{showMobileAlts ? <CaretUp size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
				</div>
			)}
			<div className={b('mobile-alts-dropdown', {open: showMobileAlts})} onClick={(e) => e.stopPropagation()}>
				<AlternativesPicker />
			</div>

			{/* Sol ust info panel: pattern + isim (desktop) */}
			<div className={b('training-info-panel')}>
				<div className={b('training-info-header')}>
					<div className={b('smart-pattern-preview')}>
						<CubeViewer
							algorithm={displayAlg}
							category={currentAlgorithm.category}
							topFace={cubeViewerTopFace}
							frontFace={cubeViewerFrontFace}
							backView={options.backView}
							llPatternOverride={llPatternOverride}
						/>
					</div>
					{options.showCaseName && (
						<div className={b('training-info-meta')}>
							{categoryTag}
							<div className={b('training-alg-name')}>{currentAlgorithm.name}</div>
						</div>
					)}
				</div>
			</div>

			{/* Ana icerik: kup + hamleler + timer + grafik */}
			<div className={b('training-main')}>
				{useSmartCube ? (
					<TrainerSmartCube />
				) : (
					<>
						{setupAlg && (
							<div className={b('training-setup')}>
								<code>Setup: {setupAlg}</code>
							</div>
						)}
						<div className={b('training-cube')}>
							<CubeViewer
								algorithm={displayAlg}
								category={currentAlgorithm.category}
								topFace={cubeViewerTopFace}
								frontFace={cubeViewerFrontFace}
								backView={options.backView}
								llPatternOverride={llPatternOverride}
							/>
						</div>
						{!state.isMoveMasked && (
							<div className={b('training-main-alg')}>
								<code>{displayAlg}</code>
							</div>
						)}
					</>
				)}

				{/* Smart cube: timer + chart yan yana / Standard: timer ust, chart alt */}
				{useSmartCube ? (
					<div className={b('smart-timer-row')}>
						<TrainerTimer />
						{chartTimes.length >= 3 && (
							<div className={b('training-chart', {compact: true})}>
								<TrainerTimeChart times={chartTimes} />
							</div>
						)}
					</div>
				) : (
					<>
						<TrainerTimer />
						{chartTimes.length >= 3 && (
							<div className={b('training-chart-row')}>
								<div className={b('training-chart')}>
									<TrainerTimeChart times={chartTimes} />
								</div>
								<div className={b('training-chart-legend')}>
									<div className={b('training-chart-legend-item')}>
										<span className={b('training-chart-dot', {single: true})} />
										<span>Single</span>
									</div>
									<div className={b('training-chart-legend-item')}>
										<span className={b('training-chart-dot', {ao5: true})} />
										<span>Ao5</span>
									</div>
									<div className={b('training-chart-legend-item')}>
										<span className={b('training-chart-dot', {ao12: true})} />
										<span>Ao12</span>
									</div>
								</div>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
