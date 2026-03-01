import React, {useState, useEffect, useRef, useCallback} from 'react';
import block from '../../../../styles/bem';
import {algToId, getStickering, getOrientationRotation, getPuzzleType, isCubeShapePuzzle, expandNotation, isLLCategory, getDefaultFrontFace, is2DPatternCategory, getPuzzlePatternType, isSQ1MirrorCategory} from '../../../../util/trainer/algorithm_engine';
import {getLLPattern, isLLPatternsLoaded} from '../../../../util/trainer/ll_patterns';
import {getPuzzlePattern, isPuzzlePatternsLoaded} from '../../../../util/trainer/puzzle_patterns';
import {getRemappedMask} from '../../../../util/trainer/stickering_remap';
import LLPatternView from '../LLPatternView';
import CubeTopPatternView from '../CubeTopPatternView';
import PyraminxPatternView from '../PyraminxPatternView';
import SkewbPatternView from '../SkewbPatternView';
import SQ1PatternView from '../SQ1PatternView';
import {saveAlgorithm, fetchDefaultAlgs, getBestTime, averageOfFive, averageOfTwelve, getLastTimes} from '../../hooks/useAlgorithmData';
import {useTrainerDb} from '../../../../util/hooks/useTrainerDb';
import {useTranslation} from 'react-i18next';
import {Check} from 'phosphor-react';
import type {CubeFace} from '../../types';

const b = block('trainer');

interface AlgorithmDetailModalProps {
	name: string;
	algorithm: string;
	category: string;
	subset: string;
	topFace: CubeFace;
	frontFace: CubeFace;
	onClose?: () => void;
}

function formatTimeShort(ms: number | null): string {
	if (!ms) return '-';
	const seconds = Math.floor(ms / 1000);
	const millis = Math.floor(ms % 1000);
	return `${seconds}.${millis.toString().padStart(3, '0')}`;
}

export default function AlgorithmDetailModal({
	name,
	algorithm: initialAlgorithm,
	category,
	subset,
	topFace,
	frontFace,
	onClose,
}: AlgorithmDetailModalProps) {
	const {t} = useTranslation();
	const dbVersion = useTrainerDb();
	const effectiveFrontFace = isLLCategory(category) ? getDefaultFrontFace(topFace) : frontFace;

	const [editedAlg, setEditedAlg] = useState(initialAlgorithm);
	const [currentAlgorithm, setCurrentAlgorithm] = useState(initialAlgorithm);
	const [alternatives, setAlternatives] = useState<string[]>([]);

	// Alternatifleri default-algs.json'dan yukle
	useEffect(() => {
		fetchDefaultAlgs().then((defaults) => {
			const categoryData = defaults[category];
			if (!categoryData) return;

			for (const sub of categoryData) {
				if (sub.subset === subset) {
					const entry = sub.algorithms.find((a: any) => a.name === name);
					if (entry && (entry as any).alternatives) {
						setAlternatives((entry as any).alternatives);
					}
					break;
				}
			}
		});
	}, [category, subset, name]);

	const algId = algToId(currentAlgorithm);
	const best = getBestTime(algId);
	const ao5 = averageOfFive(algId);
	const ao12 = averageOfTwelve(algId);
	const solveCount = getLastTimes(algId).length;

	// 2D/3D secimi
	const puzzleType = getPuzzleType(category);
	const is3x3 = puzzleType === '3x3x3';
	const isLL = isLLCategory(category);
	const llPatternsLoaded = isLLPatternsLoaded();
	const llPattern = isLL ? getLLPattern(editedAlg) : null;

	// Puzzle pattern (2x2, 4x4, pyraminx, skewb, sq1)
	const is2DPuzzle = is2DPatternCategory(category);
	const puzzlePatternType = getPuzzlePatternType(category);
	const puzzlePatternsLoaded = isPuzzlePatternsLoaded();
	const puzzlePattern = is2DPuzzle && puzzlePatternType ? getPuzzlePattern(puzzlePatternType, editedAlg, category) : null;

	const use3D = isLL
		? (llPatternsLoaded ? !llPattern : false)
		: is2DPuzzle
			? (puzzlePatternsLoaded ? !puzzlePattern : false)
			: true;

	const twistyRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!use3D || !twistyRef.current) return;

		let cancelled = false;

		(async () => {
			const {TwistyPlayer} = await import('cubing/twisty');
			if (cancelled || !twistyRef.current) return;

			const isCube = isCubeShapePuzzle(category);
			const rotation = isCube ? getOrientationRotation(topFace, effectiveFrontFace) : '';
			const baseStickering = is3x3 ? getStickering(category) : 'full';
			const needsRemap = !!rotation && topFace !== 'U' && baseStickering !== 'full';
			const remappedMask = needsRemap ? await getRemappedMask(baseStickering, rotation) : null;

			const player = new TwistyPlayer({
				puzzle: puzzleType as any,
				visualization: '3D',
				alg: editedAlg,
				experimentalSetupAnchor: 'end',
				controlPanel: 'none',
				hintFacelets: 'none',
				experimentalDragInput: 'none',
				background: 'none',
				...(!remappedMask ? {experimentalStickering: (needsRemap ? 'full' : baseStickering) as any} : {}),
				...(rotation ? {experimentalSetupAlg: rotation} : {}),
			});

			if (remappedMask) {
				(player as any).experimentalStickeringMaskOrbits = remappedMask;
			}

			if (!cancelled && twistyRef.current) {
				twistyRef.current.innerHTML = '';
				twistyRef.current.appendChild(player);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [use3D, editedAlg, category, topFace, effectiveFrontFace, puzzleType, is3x3]);

	const handleSelectAlternative = useCallback((alg: string) => {
		setEditedAlg(alg);
	}, []);

	const handleSave = useCallback(() => {
		const trimmed = editedAlg.trim();
		if (!trimmed) return;

		saveAlgorithm(category, subset, name, trimmed);
		setCurrentAlgorithm(trimmed);
	}, [editedAlg, category, subset, name]);

	const handleReset = useCallback(async () => {
		const defaults = await fetchDefaultAlgs();
		const categoryData = defaults[category];
		if (!categoryData) return;

		for (const sub of categoryData) {
			if (sub.subset === subset) {
				const original = sub.algorithms.find((a) => a.name === name);
				if (original) {
					saveAlgorithm(category, subset, name, original.algorithm);
					setCurrentAlgorithm(original.algorithm);
					setEditedAlg(original.algorithm);
					return;
				}
			}
		}
	}, [category, subset, name]);

	const stickering = is3x3 ? getStickering(category) : 'full';

	return (
		<div className={b('alg-detail')}>
			<div className={b('alg-detail-viewer')}>
				{llPattern ? (
					<LLPatternView
						pattern={llPattern}
						topFace={topFace}
						frontFace={effectiveFrontFace}
						stickering={stickering}
					/>
				) : puzzlePattern && puzzlePatternType ? (
					<>
						{puzzlePatternType === '2x2' && typeof puzzlePattern === 'string' && (
							<CubeTopPatternView pattern={puzzlePattern} layers={2} topFace={topFace} />
						)}
						{puzzlePatternType === '4x4' && typeof puzzlePattern === 'string' && (
							<CubeTopPatternView pattern={puzzlePattern} layers={4} topFace={topFace} />
						)}
						{puzzlePatternType === 'pyraminx' && typeof puzzlePattern === 'string' && (
							<PyraminxPatternView pattern={puzzlePattern} />
						)}
						{puzzlePatternType === 'skewb' && typeof puzzlePattern === 'string' && (
							<SkewbPatternView pattern={puzzlePattern} topFace={topFace} />
						)}
						{puzzlePatternType === 'sq1' && typeof puzzlePattern === 'object' && (
							<SQ1PatternView
								top={(puzzlePattern as any).t}
								bottom={(puzzlePattern as any).b}
								mirror={isSQ1MirrorCategory(category)}
							/>
						)}
					</>
				) : (
					<div
						ref={twistyRef}
						style={{
							width: '100%',
							height: '100%',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					/>
				)}
			</div>

			<div className={b('alg-detail-meta')}>
				<span className={b('alg-detail-meta-pill')}>{category}</span>
				<span className={b('alg-detail-meta-pill')}>{subset}</span>
			</div>

			<div className={b('alg-detail-notation')}>
				<code>{editedAlg}</code>
			</div>

			<div className={b('alg-detail-stats')}>
				<div className={b('alg-detail-stat')}>
					<span className={b('alg-detail-stat-label')}>Best</span>
					<span className={b('alg-detail-stat-value')}>{formatTimeShort(best)}</span>
				</div>
				<div className={b('alg-detail-stat')}>
					<span className={b('alg-detail-stat-label')}>Ao5</span>
					<span className={b('alg-detail-stat-value')}>{formatTimeShort(ao5)}</span>
				</div>
				<div className={b('alg-detail-stat')}>
					<span className={b('alg-detail-stat-label')}>Ao12</span>
					<span className={b('alg-detail-stat-value')}>{formatTimeShort(ao12)}</span>
				</div>
				<div className={b('alg-detail-stat')}>
					<span className={b('alg-detail-stat-label')}>{t('trainer.solves')}</span>
					<span className={b('alg-detail-stat-value')}>{solveCount}</span>
				</div>
			</div>

			{alternatives.length > 0 && (
				<div className={b('alg-detail-alternatives')}>
					<label className={b('alg-detail-alternatives-label')}>
						{t('trainer.alg_detail_alternatives')} ({alternatives.length})
					</label>
					<div className={b('alg-detail-alternatives-list')}>
						{alternatives.map((alt, i) => {
							const isSelected = expandNotation(alt) === expandNotation(editedAlg);
							return (
								<button
									key={i}
									className={b('alg-detail-alt-item', {selected: isSelected})}
									onClick={() => handleSelectAlternative(alt)}
								>
									<code>{alt}</code>
									{isSelected && <Check size={14} weight="bold" />}
								</button>
							);
						})}
					</div>
				</div>
			)}

			{expandNotation(editedAlg) !== expandNotation(currentAlgorithm) && (
				<div className={b('alg-detail-actions')}>
					<button className={b('alg-detail-btn', {primary: true})} onClick={handleSave}>
						{t('trainer.alg_detail_save')}
					</button>
					<button className={b('alg-detail-btn', {danger: true})} onClick={handleReset}>
						{t('trainer.alg_detail_reset')}
					</button>
				</div>
			)}
		</div>
	);
}