import React, {useState, useEffect, useMemo, useCallback} from 'react';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';
import {useLLPatternsReady} from '../../../../util/trainer/ll_patterns';
import {isLLCategory, getDefaultFrontFace, getPuzzleType, algToId, expandNotation, computeSetupInverse} from '../../../../util/trainer/algorithm_engine';
import {fetchDefaultAlgs, getLastTimes, getEffectiveTime, deleteTrainerSolve} from '../../hooks/useAlgorithmData';
import {useTrainerDb} from '../../../../util/hooks/useTrainerDb';
import CubeViewer from './CubeViewer';
import TrainerTimer from './TrainerTimer';
import TrainerSmartCube from './TrainerSmartCube';
import AlternativesPicker from '../stats_panel/AlternativesPicker';
import TrainerTimeChart from '../stats_panel/TrainerTimeChart';
import {useTranslation} from 'react-i18next';
import {CaretLeft, CaretRight, CaretDown, CaretUp} from 'phosphor-react';

const b = block('trainer');

export default function TrainingArea() {
	const {t} = useTranslation();
	const {state, dispatch} = useTrainerContext();
	useLLPatternsReady();
	const {currentAlgorithm, options} = state;
	const dbVersion = useTrainerDb();

	const hasMultipleAlgorithms = state.checkedAlgorithms.length > 1;

	const [setupAlg, setSetupAlg] = useState<string | null>(null);
	const [showMobileAlts, setShowMobileAlts] = useState(false);

	useEffect(() => {
		if (!currentAlgorithm) {
			setSetupAlg(null);
			return;
		}

		let cancelled = false;

		fetchDefaultAlgs().then(async (defaults) => {
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
		});

		return () => { cancelled = true; };
	}, [currentAlgorithm?.name, currentAlgorithm?.category, currentAlgorithm?.algorithm]);

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

	if (!currentAlgorithm) {
		return (
			<div className={b('training-area')}>
				<div className={b('training-empty')}>
					<p>{t('trainer.select_algorithms_hint')}</p>
				</div>
			</div>
		);
	}

	const is3x3 = getPuzzleType(currentAlgorithm.category) === '3x3x3';
	const useSmartCube = state.smartConnected && is3x3;

	// Mobilde training-area'nin herhangi bir yerine dokunarak timer baslatma/durdurma
	const handleAreaTouch = useCallback((e: React.MouseEvent) => {
		if (window.innerWidth > 768) return;
		const target = e.target as HTMLElement;
		// Nav butonlarina veya mobil alg header'a tiklandiginda timer tetikleme
		if (target.closest(`.cd-trainer__timer`) || target.closest(`.cd-trainer__training-nav`) || target.closest(`.cd-trainer__mobile-alg-header`)) return;
		const timerEl = document.querySelector('.cd-trainer__timer') as HTMLElement;
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

			{/* Mobilde: kompakt alg ismi + alternatifler dropdown */}
			<div className={b('mobile-alg-header')} onClick={(e) => {
				e.stopPropagation();
				setShowMobileAlts((v) => !v);
			}}>
				<span className={b('mobile-alg-name')}>{currentAlgorithm.name}</span>
				{showMobileAlts ? <CaretUp size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
			</div>
			<div className={b('mobile-alts-dropdown', {open: showMobileAlts})} onClick={(e) => e.stopPropagation()}>
				<AlternativesPicker />
			</div>

			{/* Sol ust info panel: pattern + isim (desktop) */}
			<div className={b('training-info-panel')}>
				<div className={b('training-info-header')}>
					<div className={b('smart-pattern-preview')}>
						<CubeViewer
							algorithm={currentAlgorithm.algorithm}
							category={currentAlgorithm.category}
							topFace={options.topFace}
							frontFace={isLLCategory(currentAlgorithm.category) ? getDefaultFrontFace(options.topFace) : options.frontFace}
						/>
					</div>
					<div className={b('training-info-meta')}>
						<div className={b('training-alg-name')}>{currentAlgorithm.name}</div>
					</div>
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
								algorithm={currentAlgorithm.algorithm}
								category={currentAlgorithm.category}
								topFace={options.topFace}
								frontFace={isLLCategory(currentAlgorithm.category) ? getDefaultFrontFace(options.topFace) : options.frontFace}
							/>
						</div>
						{!state.isMoveMasked && (
							<div className={b('training-main-alg')}>
								<code>{currentAlgorithm.algorithm}</code>
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
