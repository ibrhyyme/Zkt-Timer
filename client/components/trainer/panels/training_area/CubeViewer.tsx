import React, { useEffect, useRef } from 'react';
import block from '../../../../styles/bem';
import { getStickering, getOrientationRotation, getPuzzleType, isCubeShapePuzzle, isLLCategory as isLLCategoryFn, getDefaultFrontFace, is2DPatternCategory, getPuzzlePatternType, isSQ1MirrorCategory } from '../../../../util/trainer/algorithm_engine';
import { getLLPattern, isLLPatternsLoaded } from '../../../../util/trainer/ll_patterns';
import { getPuzzlePattern, isPuzzlePatternsLoaded } from '../../../../util/trainer/puzzle_patterns';
import { getRemappedMask } from '../../../../util/trainer/stickering_remap';
import LLPatternView from '../LLPatternView';
import CubeTopPatternView from '../CubeTopPatternView';
import PyraminxPatternView from '../PyraminxPatternView';
import SkewbPatternView from '../SkewbPatternView';
import SQ1PatternView from '../SQ1PatternView';
import type { TwistyPlayer } from 'cubing/twisty';
import type { CubeFace } from '../../types';

const b = block('trainer');

interface CubeViewerProps {
	algorithm: string;
	category: string;
	backView?: boolean;
	topFace?: CubeFace;
	frontFace?: CubeFace;
}

export default function CubeViewer({ algorithm, category, backView, topFace = 'U', frontFace = 'F' }: CubeViewerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const playerRef = useRef<TwistyPlayer | null>(null);

	const puzzleType = getPuzzleType(category);
	const is3x3 = puzzleType === '3x3x3';
	const isCube = isCubeShapePuzzle(category);
	const stickering = category === 'custom' ? 'full' : getStickering(category);
	const isLL = isLLCategoryFn(category);
	const effectiveFrontFace = isLL ? getDefaultFrontFace(topFace) : frontFace;

	// LL pattern (3x3)
	const llPatternsLoaded = isLLPatternsLoaded();
	const llPattern = isLL ? getLLPattern(algorithm) : null;

	// Puzzle pattern (2x2, 4x4, pyraminx, skewb, sq1)
	const is2DPuzzle = is2DPatternCategory(category);
	const puzzlePatternType = getPuzzlePatternType(category);
	const puzzlePatternsLoaded = isPuzzlePatternsLoaded();
	const puzzlePattern = is2DPuzzle && puzzlePatternType ? getPuzzlePattern(puzzlePatternType, algorithm, category) : null;

	// 3D TwistyPlayer gerekli mi?
	const use3D = isLL
		? (llPatternsLoaded ? !llPattern : false)
		: is2DPuzzle
			? (puzzlePatternsLoaded ? !puzzlePattern : false)
			: true;

	// 3D TwistyPlayer
	useEffect(() => {
		if (!use3D || !containerRef.current) return;

		let cancelled = false;

		(async () => {
			const { TwistyPlayer } = await import('cubing/twisty');
			if (cancelled) return;

			if (playerRef.current && containerRef.current) {
				containerRef.current.innerHTML = '';
				playerRef.current = null;
			}

			const rotation = isCube ? getOrientationRotation(topFace, effectiveFrontFace) : '';
			const baseStickering = is3x3 ? stickering : 'full';
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

			if (backView) {
				player.backView = 'top-right';
			}

			if (containerRef.current && !cancelled) {
				containerRef.current.appendChild(player);
				playerRef.current = player;
			}
		})();

		return () => {
			cancelled = true;
			if (containerRef.current) {
				containerRef.current.innerHTML = '';
			}
			playerRef.current = null;
		};
	}, [use3D, algorithm, category, backView, topFace, effectiveFrontFace, stickering, puzzleType, isCube, is3x3]);

	// 3x3 LL 2D pattern
	if (llPattern) {
		return (
			<div className={b('cube-viewer')}>
				<LLPatternView
					pattern={llPattern}
					topFace={topFace}
					frontFace={effectiveFrontFace}
					stickering={stickering}
					size={200}
				/>
			</div>
		);
	}

	// 2D puzzle patterns
	if (puzzlePattern && puzzlePatternType) {
		return (
			<div className={b('cube-viewer')}>
				{puzzlePatternType === '2x2' && typeof puzzlePattern === 'string' && (
					<CubeTopPatternView pattern={puzzlePattern} layers={2} topFace={topFace} size={200} />
				)}
				{puzzlePatternType === '4x4' && typeof puzzlePattern === 'string' && (
					<CubeTopPatternView pattern={puzzlePattern} layers={4} topFace={topFace} size={200} />
				)}
				{puzzlePatternType === 'pyraminx' && typeof puzzlePattern === 'string' && (
					<PyraminxPatternView pattern={puzzlePattern} size={200} />
				)}
				{puzzlePatternType === 'skewb' && typeof puzzlePattern === 'string' && (
					<SkewbPatternView pattern={puzzlePattern} topFace={topFace} size={200} />
				)}
				{puzzlePatternType === 'sq1' && typeof puzzlePattern === 'object' && (
					<SQ1PatternView
						top={(puzzlePattern as any).t}
						bottom={(puzzlePattern as any).b}
						mirror={isSQ1MirrorCategory(category)}
						size={200}
					/>
				)}
			</div>
		);
	}

	return <div ref={containerRef} className={b('cube-viewer')} />;
}
