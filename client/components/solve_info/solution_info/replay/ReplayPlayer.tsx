import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import type { GyroSample } from '../../../../../shared/smart_cube/gyro_rotations';
import { buildGyroTrack, GyroTrack, sampleGyroTrack } from './gyro_track';
import block from '../../../../styles/bem';
import { Solve } from '../../../../../server/schemas/Solve.schema';
import { SolveMethodStep } from '../../../../../server/schemas/SolveStepMethod.schema';
import { useMe } from '../../../../util/hooks/useMe';
import { canSeeSmartAnalysis } from '../../../../lib/pro';
import { getStepDisplayName } from '../../util/consts';
import { calculateNetRotationQuat, frameToQuat } from '../../../../util/cube_rotation_quat';
import type { Frame } from '../../../../../shared/smart_cube/rotation_reconstruction';
import { recolorPuzzle, stickerPaletteFromFaceColors } from '../../../timer/smart_cube/cube_view/cube_palette';
import { useCubePalette } from '../../../../util/cube_colors/useCubePalette';
import { useFlattenedMoves } from './useFlattenedMoves';
import ReplayControls from './ReplayControls';
import ReplayProUpsell from './ReplayProUpsell';
import './ReplayPlayer.scss';

const b = block('replay-player');

/**
 * Replay of a solve with gyro data (SolutionInfo builds it). One position per table token:
 * `move` is the core turns behind it, space separated (empty for a rotation, four for an M2),
 * and `frames[k]` how the solver held the cube with k tokens played.
 */
export interface GyroReplay {
	moves: { move: string; relativeMs: number; stepIdx: number }[];
	frames: Frame[];
	stepStarts: number[];
	/** Time of the first turn on the solve's time base: the zero of `relativeMs`. */
	t0: number;
	/** The raw gyro stream (fetched by SolutionInfo); empty without it. */
	samples: GyroSample[];
}

/** Pause before the first token when playing from the start; the first wait has no gap to copy. */
const FIRST_STEP_MS = 200;

/** The viewer's choice of the gyro's real motion, per device. A view preference, nothing more. */
const GYRO_PREF_KEY = 'zkt_replay_gyro';

function readGyroPref(): boolean {
	try {
		return window.localStorage.getItem(GYRO_PREF_KEY) !== 'off';
	} catch {
		return true;
	}
}

function writeGyroPref(on: boolean): void {
	try {
		window.localStorage.setItem(GYRO_PREF_KEY, on ? 'on' : 'off');
	} catch {
		// Private mode or blocked storage: the choice holds for this view only.
	}
}

/** The turns one replay position plays: one, several (a gyro token), or none (a rotation). */
function turnsAt(entry: { move: string }): string[] {
	return entry.move.split(' ').filter(Boolean);
}

/**
 * Time constant of the scene easing toward its target: a rotation settles in ~150 ms. By time,
 * not per frame: a fixed share per frame took ten seconds at the 1 fps a background window
 * gets, and would crawl the same way on a slow phone.
 */
const SCENE_EASE_MS = 58;

/** Share of the remaining turn to cover after `dtMs` of easing. */
function easeShare(dtMs: number): number {
	return 1 - Math.exp(-Math.max(0, dtMs) / SCENE_EASE_MS);
}

interface Props {
	solve: Solve;
	steps: SolveMethodStep[];
	rotation: string;
	gyroReplay?: GyroReplay | null;
	currentMoveIdx: number;
	onMoveIdxChange: (idx: number) => void;
}

export default function ReplayPlayer({ solve, steps, rotation, gyroReplay, currentMoveIdx, onMoveIdxChange }: Props) {
	const { t } = useTranslation();
	const me = useMe();
	// Virtual cube solves are replayable for everyone. Their moves are recorded for
	// free (cstimer never charged for reconstruction, and this is a 1:1 port of it),
	// so gating the viewer would store data nobody could look at. Smart cube replay
	// stays behind Pro: the viewer's, or the owner's for a solve they share.
	const userIsPro = canSeeSmartAnalysis(me, solve?.user) || !!(solve as any)?.is_virtual_cube;

	const containerRef = useRef<HTMLDivElement>(null);
	const twistyRef = useRef<any>(null);
	const [twistyReady, setTwistyReady] = useState(false);

	// The viewer's sticker colours, as on the scramble cube above and the live cube. Without
	// them the replay drew the renderer's neon stock colours next to the user's palette.
	// Recolouring is one-shot per puzzle (see cube_palette.ts), so a new palette rebuilds the
	// player: paletteKey is in its effect's dependencies.
	const cubeColors = useCubePalette();
	const paletteKey = cubeColors.nxn.join(',');
	const stickerPalette = useMemo(() => stickerPaletteFromFaceColors(cubeColors.nxn), [paletteKey]);
	const stickerPaletteRef = useRef(stickerPalette);
	stickerPaletteRef.current = stickerPalette;
	const [isPlaying, setIsPlaying] = useState(false);
	const [speed, setSpeed] = useState(1);

	// Flat moves list — SolutionInfo uses the same hook to get the same list. With gyro data
	// both use the raw turns instead (GyroReplay).
	const flattened = useFlattenedMoves(steps);
	const allMoves = gyroReplay ? gyroReplay.moves : flattened.allMoves;
	const stepStartIndices = gyroReplay ? gyroReplay.stepStarts : flattened.stepStartIndices;

	const totalMs = (solve.time || 0) * 1000;

	// Setup alg = ONLY scramble (rotation is NOT added to cube state).
	// Reason: solver calculated step.turns against default cube state (to solve the scramble).
	// If we add rotation to setup, cube state becomes rotated, and raw moves won't solve the scramble.
	// Rotation is applied visually via scene quaternion (animation loop below).
	const setupAlg = solve.scramble || '';

	const appliedMoveIdxRef = useRef(0);

	// The recorded gyro stream turns the scene when there is one. Without it (offline, an older
	// solve, one recorded before the stream was kept) the replay falls back to the
	// reconstruction's square frames below.
	const gyroTrack = useMemo((): GyroTrack | null => {
		if (!gyroReplay || !gyroReplay.samples.length) return null;
		return buildGyroTrack(
			gyroReplay.samples,
			gyroReplay.t0,
			gyroReplay.moves.map((m) => m.relativeMs),
			gyroReplay.frames
		);
	}, [gyroReplay]);

	// On by default; read after mount, so the server render and the first client render agree.
	const [gyroOn, setGyroOn] = useState(true);
	useEffect(() => setGyroOn(readGyroPref()), []);
	function changeGyro(on: boolean) {
		setGyroOn(on);
		writeGyroPref(on);
	}

	// The animation loop reads these each frame. With a gyro track the scene follows the replay
	// clock: the time of the token last played, moving on toward the next while playing.
	const gyroTrackRef = useRef<GyroTrack | null>(null);
	gyroTrackRef.current = gyroOn ? gyroTrack : null;
	const clockRef = useRef({ idx: 0, enteredAt: 0, playing: false, speed: 1, moves: allMoves });
	clockRef.current.playing = isPlaying;
	clockRef.current.speed = speed;
	clockRef.current.moves = allMoves;
	useEffect(() => {
		clockRef.current.idx = currentMoveIdx;
		clockRef.current.enteredAt = performance.now();
	}, [currentMoveIdx, isPlaying]);

	// Target scene quaternion: the holding, or with gyro data the frame at this position.
	// The scene eases toward it (sceneQuatRef), so a rotation turns the cube on screen and a
	// slice reads as the middle layer moving rather than the outer two and then a jump.
	const targetQuatRef = useRef(new THREE.Quaternion());
	const sceneQuatRef = useRef<THREE.Quaternion | null>(null);
	useEffect(() => {
		if (gyroReplay) {
			const frame = gyroReplay.frames[Math.max(0, Math.min(currentMoveIdx, gyroReplay.frames.length - 1))];
			targetQuatRef.current = frameToQuat(frame);
			return;
		}
		const rotMoves = (rotation || '').split(' ').filter(Boolean);
		targetQuatRef.current = calculateNetRotationQuat(rotMoves);
	}, [rotation, gyroReplay, currentMoveIdx]);

	// TwistyPlayer init — async dynamic import (SSR-safe)
	// requestAnimationFrame loop continuously forces scene quaternion to targetQuatRef
	// (even if TwistyPlayer's render loop overrides it, we reset it every frame).
	useEffect(() => {
		if (!containerRef.current || !userIsPro) return;
		let cancelled = false;
		let animFrameId: number | null = null;
		let sceneRef: THREE.Object3D | null = null;
		let vantageRef: any = null;
		let lastFrameAt = performance.now();
		const recolored = new WeakSet<object>();
		let recolorPending = true;

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
						// The puzzle shows up a few frames after the scene; once found, this is free.
						if (sceneRef && recolorPending) {
							if (recolorPuzzle(sceneRef, recolored, stickerPaletteRef.current) !== 'not-found') recolorPending = false;
						}
						if (sceneRef && vantageRef && targetQuatRef.current) {
							const frameAt = performance.now();
							let target = targetQuatRef.current;
							let ease = easeShare(frameAt - lastFrameAt);
							lastFrameAt = frameAt;
							const track = gyroTrackRef.current;
							if (track) {
								const { idx, enteredAt, playing, speed: rate, moves } = clockRef.current;
								const first = moves.length ? moves[0].relativeMs : 0;
								const from = idx === 0 ? first - FIRST_STEP_MS : moves[Math.min(idx, moves.length) - 1].relativeMs;
								const to = idx < moves.length ? moves[idx].relativeMs : from;
								const now = playing
									? Math.min(Math.max(from, to), from + (performance.now() - enteredAt) * rate)
									: from;
								target = sampleGyroTrack(track, now);
								// Playing follows the stream as recorded; a jump (a click, a step) eases.
								if (playing) ease = 1;
							}
							if (!sceneQuatRef.current) sceneQuatRef.current = target.clone();
							else sceneQuatRef.current.slerp(target, ease);
							sceneRef.quaternion.copy(sceneQuatRef.current);
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
			// A new player starts at its target, not eased in from the last solve's orientation.
			sceneQuatRef.current = null;
			setTwistyReady(false);
		};
	}, [solve.id, setupAlg, userIsPro, paletteKey]);

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
					for (const m of turnsAt(allMoves[i])) player.experimentalAddMove(m, { cancel: false });
				}
			} else {
				// Backward — reset alg, restart from setup, apply moves up to maxIdx (instant)
				player.alg = '';
				player.experimentalSetupAlg = setupAlg;
				for (let i = 0; i < maxIdx; i++) {
					for (const m of turnsAt(allMoves[i])) player.experimentalAddMove(m, { cancel: false });
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

		// The wait before playing a move is its gap from the one before it. Taking the gap to the
		// move after it, as this did, played every move one gap early or late; with the gyro
		// clock running on the same times, the cube's turning would drift off its moves.
		const move = allMoves[currentMoveIdx];
		const prev = allMoves[currentMoveIdx - 1];
		const delayMs = prev ? Math.max(50, move.relativeMs - prev.relativeMs) : FIRST_STEP_MS;

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
				gyro={gyroTrack ? { on: gyroOn, onChange: changeGyro } : undefined}
			/>
		</div>
	);
}
