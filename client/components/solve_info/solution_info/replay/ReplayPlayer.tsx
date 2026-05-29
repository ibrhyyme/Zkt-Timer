import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import block from '../../../../styles/bem';
import { Solve } from '../../../../../server/schemas/Solve.schema';
import { SolveMethodStep } from '../../../../../server/schemas/SolveStepMethod.schema';
import { useMe } from '../../../../util/hooks/useMe';
import { isPro, isProEnabled } from '../../../../lib/pro';
import { getStepDisplayName } from '../../util/consts';
import { calculateNetRotationQuat } from '../../../../util/cube_rotation_quat';
import { useFlattenedMoves } from './useFlattenedMoves';
import ReplayControls from './ReplayControls';
import ReplayProUpsell from './ReplayProUpsell';
import './ReplayPlayer.scss';

const b = block('replay-player');

interface Props {
	solve: Solve;
	steps: SolveMethodStep[];
	rotation: string;
	currentMoveIdx: number;
	onMoveIdxChange: (idx: number) => void;
}

export default function ReplayPlayer({ solve, steps, rotation, currentMoveIdx, onMoveIdxChange }: Props) {
	const { t } = useTranslation();
	const me = useMe();
	const userIsPro = isPro(me) || !isProEnabled(); // If Pro feature disabled, open to everyone

	const containerRef = useRef<HTMLDivElement>(null);
	const twistyRef = useRef<any>(null);
	const [twistyReady, setTwistyReady] = useState(false);
	const [isPlaying, setIsPlaying] = useState(false);
	const [speed, setSpeed] = useState(1);

	// Flat moves list — SolutionInfo uses the same hook to get the same list
	const { allMoves, stepStartIndices } = useFlattenedMoves(steps);

	const totalMs = (solve.time || 0) * 1000;

	// Setup alg = ONLY scramble (rotation is NOT added to cube state).
	// Reason: solver calculated step.turns against default cube state (to solve the scramble).
	// If we add rotation to setup, cube state becomes rotated, and raw moves won't solve the scramble.
	// Rotation is applied visually via scene quaternion (animation loop below).
	const setupAlg = solve.scramble || '';

	const appliedMoveIdxRef = useRef(0);

	// Target scene quaternion — calculated from rotation prop.
	const targetQuatRef = useRef(new THREE.Quaternion());
	useEffect(() => {
		const rotMoves = (rotation || '').split(' ').filter(Boolean);
		targetQuatRef.current = calculateNetRotationQuat(rotMoves);
	}, [rotation]);

	// TwistyPlayer init — async dynamic import (SSR-safe)
	// requestAnimationFrame loop continuously forces scene quaternion to targetQuatRef
	// (even if TwistyPlayer's render loop overrides it, we reset it every frame).
	useEffect(() => {
		if (!containerRef.current || !userIsPro) return;
		let cancelled = false;
		let animFrameId: number | null = null;
		let sceneRef: THREE.Object3D | null = null;
		let vantageRef: any = null;

		(async () => {
			try {
				const mod = await import('cubing/twisty');
				if (cancelled) return;
				const TwistyPlayer = (mod as any).TwistyPlayer;
				const player = new TwistyPlayer({
					puzzle: '3x3x3',
					visualization: 'PG3D',
					alg: '',
					experimentalSetupAlg: setupAlg,
					background: 'none',
					controlPanel: 'none',
					hintFacelets: 'none',
					experimentalDragInput: 'auto',  // Rotate cube with mouse/touch
					cameraLatitude: 30,
					cameraLongitude: -30,
					tempoScale: 4,
				});
				if (containerRef.current) {
					containerRef.current.innerHTML = '';
					containerRef.current.appendChild(player);
					player.style.width = '100%';
					player.style.height = '100%';
					twistyRef.current = player;
					appliedMoveIdxRef.current = 0;
					setTwistyReady(true);
				}

				// Scene quaternion sync animation loop
				const animate = async () => {
					if (cancelled) return;
					try {
						if (!sceneRef || !vantageRef) {
							const vantageList = await player.experimentalCurrentVantages();
							vantageRef = [...vantageList][0];
							if (vantageRef) {
								sceneRef = await vantageRef.scene.scene();
							}
						}
						if (sceneRef && vantageRef && targetQuatRef.current) {
							sceneRef.quaternion.copy(targetQuatRef.current);
							vantageRef.render();
						}
					} catch {
						// Scene not ready yet, try again next frame
					}
					if (!cancelled) {
						animFrameId = requestAnimationFrame(animate);
					}
				};
				animate();
			} catch (e) {
				console.error('[ReplayPlayer] TwistyPlayer load failed', e);
			}
		})();

		return () => {
			cancelled = true;
			if (animFrameId !== null) cancelAnimationFrame(animFrameId);
			if (twistyRef.current && twistyRef.current.parentNode) {
				twistyRef.current.parentNode.removeChild(twistyRef.current);
			}
			twistyRef.current = null;
			appliedMoveIdxRef.current = 0;
			setTwistyReady(false);
		};
	}, [solve.id, setupAlg, userIsPro]);

	// Synchronize TwistyPlayer state when currentMoveIdx changes.
	// Forward (next move): incremental experimentalAddMove (smooth animation)
	// Backward (seek backward): reset TwistyPlayer + setup + apply moves 0..currentIdx (instant)
	useEffect(() => {
		if (!twistyReady || !twistyRef.current) return;
		const player = twistyRef.current;
		const applied = appliedMoveIdxRef.current;

		if (currentMoveIdx === applied) return;

		// Defensive clamp: if currentMoveIdx > allMoves.length, undefined access would occur
		const maxIdx = Math.max(0, Math.min(currentMoveIdx, allMoves.length));

		try {
			if (maxIdx > applied) {
				// Forward — apply added moves one by one (smooth animation)
				for (let i = applied; i < maxIdx; i++) {
					player.experimentalAddMove(allMoves[i].move, { cancel: false });
				}
			} else {
				// Backward — reset alg, restart from setup, apply moves up to maxIdx (instant)
				player.alg = '';
				player.experimentalSetupAlg = setupAlg;
				for (let i = 0; i < maxIdx; i++) {
					player.experimentalAddMove(allMoves[i].move, { cancel: false });
				}
			}
			appliedMoveIdxRef.current = maxIdx;
		} catch (e) {
			console.warn('[ReplayPlayer] sync failed', e);
		}
	}, [currentMoveIdx, allMoves, setupAlg, twistyReady]);

	// Playback timer — advances currentMoveIdx
	useEffect(() => {
		if (!isPlaying || !twistyReady) return;
		if (currentMoveIdx >= allMoves.length) {
			setIsPlaying(false);
			return;
		}

		const move = allMoves[currentMoveIdx];
		const next = allMoves[currentMoveIdx + 1];
		const delayMs = next ? Math.max(50, next.relativeMs - move.relativeMs) : 200;

		const tid = setTimeout(() => {
			onMoveIdxChange(currentMoveIdx + 1);
		}, delayMs / speed);

		return () => clearTimeout(tid);
	}, [isPlaying, currentMoveIdx, allMoves, speed, twistyReady, onMoveIdxChange]);

	// Seek — only change currentMoveIdx, sync useEffect updates TwistyPlayer
	function seekTo(targetIdx: number) {
		const clamped = Math.max(0, Math.min(targetIdx, allMoves.length));
		onMoveIdxChange(clamped);
	}

	function handlePrevStep() {
		const currStep = allMoves[Math.max(0, currentMoveIdx - 1)]?.stepIdx ?? 0;
		const targetStep = currentMoveIdx === 0 ? 0 : Math.max(0, currStep);
		seekTo(stepStartIndices[targetStep] ?? 0);
	}

	function handleNextStep() {
		const currStep = allMoves[Math.min(allMoves.length - 1, currentMoveIdx)]?.stepIdx ?? 0;
		const next = stepStartIndices[currStep + 1];
		seekTo(next != null ? next : allMoves.length);
	}

	function handlePlayPause() {
		if (currentMoveIdx >= allMoves.length) {
			seekTo(0);
		}
		setIsPlaying((p) => !p);
	}

	if (!userIsPro) {
		return <ReplayProUpsell />;
	}

	if (allMoves.length === 0) {
		return (
			<div className={b()}>
				<div className={b('empty')}>{t('solve_info.replay.no_data')}</div>
			</div>
		);
	}

	const currentMove = allMoves[Math.min(currentMoveIdx, allMoves.length - 1)];
	const elapsedMs = currentMove ? currentMove.relativeMs : totalMs;
	const currentStep = steps[currentMove?.stepIdx ?? 0];
	const currentStepName = currentStep ? getStepDisplayName(currentStep) : '';

	return (
		<div className={b()}>
			<div className={b('cube')} ref={containerRef} />
			<ReplayControls
				isPlaying={isPlaying}
				currentMoveIdx={Math.min(currentMoveIdx, allMoves.length)}
				totalMoves={allMoves.length}
				elapsedMs={elapsedMs}
				totalMs={totalMs}
				currentStepName={currentStepName}
				speed={speed}
				onPlayPause={handlePlayPause}
				onSeek={seekTo}
				onPrevStep={handlePrevStep}
				onNextStep={handleNextStep}
				onSpeedChange={setSpeed}
			/>
		</div>
	);
}
