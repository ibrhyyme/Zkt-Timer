import React, { useRef, useEffect, useState, useCallback } from 'react';
import block from '../../../../styles/bem';
import { algToId, getStickering, getOrientationRotation, getPuzzleType, isCubeShapePuzzle, isLLCategory, getDefaultFrontFace, is2DPatternCategory, getPuzzlePatternType, isSQ1MirrorCategory } from '../../../../util/trainer/algorithm_engine';
import { getLLPattern, isLLPatternsLoaded } from '../../../../util/trainer/ll_patterns';
import { getPuzzlePattern, isPuzzlePatternsLoaded } from '../../../../util/trainer/puzzle_patterns';
import { getRemappedMask } from '../../../../util/trainer/stickering_remap';
import LLPatternView from '../LLPatternView';
import CubeTopPatternView from '../CubeTopPatternView';
import PyraminxPatternView from '../PyraminxPatternView';
import SkewbPatternView from '../SkewbPatternView';
import SQ1PatternView from '../SQ1PatternView';
import { getBestTime, averageOfFive, getLearnedStatus, setLearnedStatus, getLastTimes } from '../../hooks/useAlgorithmData';
import { useTrainerDb } from '../../../../util/hooks/useTrainerDb';
import { BookmarkSimple, Check, Plus } from 'phosphor-react';
import type { CubeFace, LearnedStatus } from '../../types';

const b = block('trainer');

interface AlgorithmCardProps {
	name: string;
	algorithm: string;
	category: string;
	subset: string;
	checked: boolean;
	onToggle: (algorithm: string, name: string, checked: boolean) => void;
	onDetail: (algorithm: string, name: string, category: string, subset: string) => void;
	topFace: CubeFace;
	frontFace: CubeFace;
}

function formatTimeShort(ms: number | null): string {
	if (!ms) return '-';
	const seconds = Math.floor(ms / 1000);
	const millis = Math.floor(ms % 1000);
	return `${seconds}.${millis.toString().padStart(3, '0')}`;
}

export default function AlgorithmCard({
	name,
	algorithm,
	category,
	subset,
	checked,
	onToggle,
	onDetail,
	topFace,
	frontFace,
}: AlgorithmCardProps) {
	const dbVersion = useTrainerDb();
	const effectiveFrontFace = isLLCategory(category) ? getDefaultFrontFace(topFace) : frontFace;
	const algId = algToId(algorithm);
	const best = getBestTime(algId);
	const ao5 = averageOfFive(algId);
	const learned = getLearnedStatus(algId);
	const solveCount = getLastTimes(algId).length;

	const containerRef = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);

	// Puzzle tipi ve 2D/3D secimi
	const puzzleType = getPuzzleType(category);
	const is3x3 = puzzleType === '3x3x3';
	const isLL = isLLCategory(category);
	const llPatternsLoaded = isLLPatternsLoaded();
	const llPattern = isLL ? getLLPattern(algorithm) : null;

	// Puzzle pattern (2x2, 4x4, pyraminx, skewb, sq1)
	const is2DPuzzle = is2DPatternCategory(category);
	const puzzlePatternType = getPuzzlePatternType(category);
	const puzzlePatternsLoaded = isPuzzlePatternsLoaded();
	const puzzlePattern = is2DPuzzle && puzzlePatternType ? getPuzzlePattern(puzzlePatternType, algorithm, category) : null;

	// 3D gerekli mi?
	const use3D = isLL
		? (llPatternsLoaded ? !llPattern : false)
		: is2DPuzzle
			? (puzzlePatternsLoaded ? !puzzlePattern : false)
			: true;

	// Lazy load: sadece 3D (TwistyPlayer) gerektiren kartlar için IntersectionObserver
	useEffect(() => {
		if (!use3D || !containerRef.current) return;

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setIsVisible(true);
					observer.disconnect();
				}
			},
			{ rootMargin: '100px' }
		);

		observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, [use3D]);

	const twistyRef = useRef<HTMLDivElement>(null);

	// 3D TwistyPlayer — sadece pattern bulunamayan kategoriler için
	useEffect(() => {
		if (!use3D || !isVisible || !twistyRef.current) return;

		let cancelled = false;

		(async () => {
			const { TwistyPlayer } = await import('cubing/twisty');
			if (cancelled || !twistyRef.current) return;

			const isCube = isCubeShapePuzzle(category);
			const rotation = isCube ? getOrientationRotation(topFace, effectiveFrontFace) : '';
			const baseStickering = is3x3 ? getStickering(category) : 'full';
			const needsRemap = !!rotation && topFace !== 'U' && baseStickering !== 'full';
			const remappedMask = needsRemap ? await getRemappedMask(baseStickering, rotation) : null;

			const player = new TwistyPlayer({
				puzzle: puzzleType as any,
				visualization: '3D',
				alg: algorithm,
				experimentalSetupAnchor: 'end',
				controlPanel: 'none',
				hintFacelets: 'none',
				experimentalDragInput: 'none',
				background: 'none',
				...(!remappedMask ? { experimentalStickering: (needsRemap ? 'full' : baseStickering) as any } : {}),
				...(rotation ? { experimentalSetupAlg: rotation } : {}),
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
	}, [use3D, isVisible, algorithm, category, topFace, effectiveFrontFace, puzzleType, is3x3]);

	const cycleLearnedStatus = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			const next = ((learned + 1) % 3) as LearnedStatus;
			setLearnedStatus(algId, next);
		},
		[algId, learned]
	);

	const learnedColor =
		learned === 2 ? 'var(--green-color, #66bb6a)' : learned === 1 ? '#ffa726' : undefined;

	const stickering = getStickering(category);

	return (
		<div
			ref={containerRef}
			className={b('alg-card', { checked })}
			onClick={() => onToggle(algorithm, name, !checked)}
			onDoubleClick={(e) => {
				e.preventDefault();
				onDetail(algorithm, name, category, subset);
			}}
		>
			<div className={b('alg-card-header')}>
				<span className={b('alg-card-name')} title={algorithm}>
					{name}
				</span>
				<button
					className={b('alg-card-bookmark')}
					onClick={cycleLearnedStatus}
					onDoubleClick={(e) => e.stopPropagation()}
					title="Learning status"
				>
					<BookmarkSimple
						size={20}
						weight={learned > 0 ? 'fill' : 'regular'}
						color={learnedColor}
					/>
				</button>
			</div>

			<div className={b('alg-card-stats')}>
				<span>Best: {formatTimeShort(best)}</span>
				<span>Ao5: {formatTimeShort(ao5)}</span>
			</div>

			<div className={b('alg-card-preview')}>
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
					<div ref={twistyRef} style={{
						width: '100%',
						height: '100%',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}} />
				)}
			</div>

			<div className={b('alg-card-toggle')}>
				<div className={b('alg-card-checkbox', { checked })}>
					{checked ? <Check size={14} weight="bold" /> : <Plus size={14} />}
				</div>
				{solveCount > 0 && (
					<span className={b('alg-card-solves')}>
						<Check size={12} /> {solveCount}
					</span>
				)}
			</div>
		</div>
	);
}
