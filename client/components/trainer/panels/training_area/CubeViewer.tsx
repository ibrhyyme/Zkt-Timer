import React, { useEffect, useRef } from 'react';
import block from '../../../../styles/bem';
import { getStickering, getOrientationRotation } from '../../../../util/trainer/algorithm_engine';
import { getLLPattern } from '../../../../util/trainer/ll_patterns';
import LLPatternView from '../LLPatternView';
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

	const stickering = category === 'custom' ? 'full' : getStickering(category);
	const isLLCategory = category.toLowerCase().includes('ll') || stickering === 'OLL';
	const llPattern = isLLCategory ? getLLPattern(algorithm) : null;
	const use3D = !llPattern;

	// 3D TwistyPlayer — sadece pattern bulunamayan kategoriler için
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

			const rotation = getOrientationRotation(topFace, frontFace);
			const stickeringValue = rotation ? 'full' : stickering;

			const player = new TwistyPlayer({
				puzzle: '3x3x3',
				visualization: '3D',
				alg: algorithm,
				experimentalSetupAnchor: 'end',
				controlPanel: 'none',
				hintFacelets: 'none',
				experimentalDragInput: 'none',
				background: 'none',
				experimentalStickering: stickeringValue as any,
				...(rotation ? { experimentalSetupAlg: rotation } : {}),
			});

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
	}, [use3D, algorithm, category, backView, topFace, frontFace, stickering]);

	if (llPattern) {
		return (
			<div className={b('cube-viewer')}>
				<LLPatternView
					pattern={llPattern}
					topFace={topFace}
					frontFace={frontFace}
					stickering={stickering}
					size={200}
				/>
			</div>
		);
	}

	return <div ref={containerRef} className={b('cube-viewer')} />;
}
