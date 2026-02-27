import React, { useRef, useEffect, useState, useCallback } from 'react';
import block from '../../../../styles/bem';
import { algToId, getStickering, getOrientationRotation } from '../../../../util/trainer/algorithm_engine';
import { getLLPattern } from '../../../../util/trainer/ll_patterns';
import LLPatternView from '../LLPatternView';
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
	topFace,
	frontFace,
}: AlgorithmCardProps) {
	const dbVersion = useTrainerDb();
	const algId = algToId(algorithm);
	const best = getBestTime(algId);
	const ao5 = averageOfFive(algId);
	const learned = getLearnedStatus(algId);
	const solveCount = getLastTimes(algId).length;

	const containerRef = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);

	// Kategori 2D-LL mi yoksa 3D mi?
	const isLLCategory = category.toLowerCase().includes('ll') || getStickering(category) === 'OLL';
	const llPattern = isLLCategory ? getLLPattern(algorithm) : null;
	const use3D = !llPattern;

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

			const rotation = getOrientationRotation(topFace, frontFace);
			const baseStickering = getStickering(category);
			const stickering = rotation ? 'full' : baseStickering;

			const player = new TwistyPlayer({
				puzzle: '3x3x3',
				visualization: '3D',
				alg: algorithm,
				experimentalSetupAnchor: 'end',
				controlPanel: 'none',
				hintFacelets: 'none',
				experimentalDragInput: 'none',
				background: 'none',
				experimentalStickering: stickering as any,
				...(rotation ? { experimentalSetupAlg: rotation } : {}),
			});

			if (!cancelled && twistyRef.current) {
				twistyRef.current.innerHTML = '';
				twistyRef.current.appendChild(player);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [use3D, isVisible, algorithm, category, topFace, frontFace]);

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
		>
			<div className={b('alg-card-header')}>
				<span className={b('alg-card-name')} title={algorithm}>
					{name}
				</span>
				<button
					className={b('alg-card-bookmark')}
					onClick={cycleLearnedStatus}
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
						frontFace={frontFace}
						stickering={stickering}
					/>
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
