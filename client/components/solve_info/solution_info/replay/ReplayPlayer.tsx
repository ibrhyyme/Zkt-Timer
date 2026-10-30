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
import { CubeRenderer } from '../../../timer/smart_cube/cube_view/render/cube_renderer';
import { HOME_TILT_DEG } from '../../../timer/smart_cube/cube_view/view_defaults';
import { ViewDrag } from '../../../timer/smart_cube/cube_view/view_drag';
import { useCubePalette } from '../../../../util/cube_colors/useCubePalette';
import { isAppVisible, onVisibilityChange } from '../../../../util/app-visibility';
import { useFlattenedMoves } from './useFlattenedMoves';
import { turnsAt, turnsUpTo } from './replay_turns';
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

const DEG = Math.PI / 180;

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

	/** The area the cube sits in, and the square inside it that holds the canvas. */
	const boxRef = useRef<HTMLDivElement>(null);
	const hostRef = useRef<HTMLDivElement>(null);
	const rendererRef = useRef<CubeRenderer | null>(null);
	const [rendererReady, setRendererReady] = useState(false);

	// The viewer's sticker colours, as on the scramble cube above and the live cube. Applied in
	// place: a palette change keeps the position.
	const cubeColors = useCubePalette();
	const faceColorsRef = useRef(cubeColors.nxn);
	faceColorsRef.current = cubeColors.nxn;
	const paletteKey = cubeColors.nxn.join(',');
	const [isPlaying, setIsPlaying] = useState(false);
	const [speed, setSpeed] = useState(1);

	// Flat moves list — SolutionInfo uses the same hook to get the same list. With gyro data
	// both use the raw turns instead (GyroReplay).
	const flattened = useFlattenedMoves(steps);
	const allMoves = gyroReplay ? gyroReplay.moves : flattened.allMoves;
	const stepStartIndices = gyroReplay ? gyroReplay.stepStarts : flattened.stepStartIndices;
	const hasMoves = allMoves.length > 0;
	// What the positions are. It changes when the last-layer algorithms arrive and the rows are
	// read again; the array itself is rebuilt on every render of a solve without gyro data.
	const movesKey = allMoves.map((m) => m.move).join('|');

	const totalMs = (solve.time || 0) * 1000;

	// Setup = ONLY the scramble; the holding is the scene's orientation (see replay_turns.ts).
	const setupAlg = solve.scramble || '';

	// What the cube shows: this many positions played, of the positions under this key.
	const appliedRef = useRef({ idx: 0, key: '' });
	// Read when the cube is built, without rebuilding it on every move.
	const currentIdxRef = useRef(currentMoveIdx);
	currentIdxRef.current = currentMoveIdx;
	const allMovesRef = useRef(allMoves);
	allMovesRef.current = allMoves;
	const movesKeyRef = useRef(movesKey);
	movesKeyRef.current = movesKey;

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

	// The scene loop asks for frames only while something moves; anything that gives it a new
	// target wakes it. A no-op until the cube exists.
	const wakeSceneRef = useRef<() => void>(() => {});
	// The viewer's drag on top of the scene (view_drag.ts); back to the home view with every new cube.
	const dragRef = useRef(new ViewDrag());

	// The scene loop reads these each frame. With a gyro track the scene follows the replay
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
		wakeSceneRef.current();
	}, [currentMoveIdx, isPlaying]);

	// Target scene quaternion: the holding, or with gyro data the frame at this position.
	// The scene eases toward it, so a rotation turns the cube on screen and a slice reads as
	// the middle layer moving rather than the outer two and then a jump.
	const targetQuatRef = useRef(new THREE.Quaternion());
	useEffect(() => {
		if (gyroReplay) {
			const frame = gyroReplay.frames[Math.max(0, Math.min(currentMoveIdx, gyroReplay.frames.length - 1))];
			targetQuatRef.current = frameToQuat(frame);
		} else {
			const rotMoves = (rotation || '').split(' ').filter(Boolean);
			targetQuatRef.current = calculateNetRotationQuat(rotMoves);
		}
		wakeSceneRef.current();
	}, [rotation, gyroReplay, currentMoveIdx]);

	// The gyro switch, or the stream arriving, changes what the scene follows.
	useEffect(() => {
		wakeSceneRef.current();
	}, [gyroOn, gyroTrack]);

	useEffect(() => {
		rendererRef.current?.setFaceColors(faceColorsRef.current);
	}, [paletteKey]);

	// The cube: our own renderer (cube_view/render/), built on the client only, one per solve,
	// at the position the replay is on. The scene loop in here turns it; the effect below plays
	// the turns.
	useEffect(() => {
		const box = boxRef.current;
		const host = hostRef.current;
		if (!box || !host || !userIsPro) return undefined;

		let cube: CubeRenderer;
		try {
			cube = new CubeRenderer({
				size: 3,
				faceColors: faceColorsRef.current,
				tableTilt: HOME_TILT_DEG * DEG,
				orientation: new THREE.Quaternion(),
			});
		} catch (error) {
			// No WebGL (blocked, lost, very old device): the table and the controls still work.
			console.error('[ReplayPlayer] 3D view unavailable:', error);
			return undefined;
		}
		dragRef.current.reset();
		const idx = Math.max(0, Math.min(currentIdxRef.current, allMovesRef.current.length));
		cube.setMoves(turnsUpTo(setupAlg, allMovesRef.current, idx));
		appliedRef.current = { idx, key: movesKeyRef.current };
		host.appendChild(cube.canvas);

		// A square canvas, as large as the box allows.
		const fit = () => {
			const side = Math.max(1, Math.floor(Math.min(box.clientWidth, box.clientHeight)));
			host.style.width = `${side}px`;
			host.style.height = `${side}px`;
			cube.resize(side);
		};
		fit();
		const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
		if (observer) observer.observe(box);
		else window.addEventListener('resize', fit);

		// A backgrounded tab should not keep drawing.
		cube.setActive(isAppVisible());
		const unsubVisibility = onVisibilityChange((visible) => cube.setActive(visible));

		// The scene loop: eases toward the target on its own clock (or follows the gyro stream as
		// recorded while playing) and puts the cube there, the viewer's drag on top. The renderer
		// does no easing of its own here and draws only when the orientation changed.
		let raf = 0;
		let lastAt = 0;
		let shown: THREE.Quaternion | null = null;
		const view = new THREE.Quaternion();
		const sceneFrame = () => {
			raf = 0;
			const now = performance.now();
			const dt = lastAt ? now - lastAt : 0;
			lastAt = now;

			const drag = dragRef.current;
			const flinging = drag.step(dt);

			let target = targetQuatRef.current;
			let ease = easeShare(dt);
			let following = false;
			const track = gyroTrackRef.current;
			if (track) {
				const { idx: at, enteredAt, playing, speed: rate, moves } = clockRef.current;
				const first = moves.length ? moves[0].relativeMs : 0;
				const prev = moves[Math.min(at, moves.length) - 1];
				const from = at === 0 || !prev ? first - FIRST_STEP_MS : prev.relativeMs;
				const to = at < moves.length ? moves[at].relativeMs : from;
				const end = Math.max(from, to);
				const clock = playing ? Math.min(end, from + (now - enteredAt) * rate) : from;
				target = sampleGyroTrack(track, clock);
				// Playing follows the stream as recorded; a jump (a click, a step) eases.
				if (playing) {
					ease = 1;
					following = clock < end;
				}
			}
			if (!shown) shown = target.clone();
			else shown.slerp(target, ease);
			cube.setOrientation(drag.quat(view).multiply(shown), true);

			if (following || flinging || shown.angleTo(target) > 1e-4) raf = requestAnimationFrame(sceneFrame);
			else lastAt = 0;
		};
		wakeSceneRef.current = () => {
			if (raf) return;
			lastAt = performance.now();
			raf = requestAnimationFrame(sceneFrame);
		};
		// The first orientation goes in before the renderer draws its first frame.
		sceneFrame();

		rendererRef.current = cube;
		setRendererReady(true);

		return () => {
			if (raf) cancelAnimationFrame(raf);
			wakeSceneRef.current = () => {};
			if (observer) observer.disconnect();
			else window.removeEventListener('resize', fit);
			unsubVisibility();
			cube.dispose();
			if (rendererRef.current === cube) rendererRef.current = null;
			setRendererReady(false);
		};
	}, [solve.id, setupAlg, userIsPro, hasMoves]);

	// The cube's state follows the position. Forward plays the turns, animated; back, or the
	// positions read again (the last-layer algorithms arrived), builds it at once from the
	// scramble.
	useEffect(() => {
		const cube = rendererRef.current;
		if (!rendererReady || !cube) return;
		const idx = Math.max(0, Math.min(currentMoveIdx, allMoves.length));
		const applied = appliedRef.current;
		if (applied.key === movesKey && applied.idx === idx) return;
		if (applied.key === movesKey && idx > applied.idx) {
			for (let i = applied.idx; i < idx; i++) {
				for (const m of turnsAt(allMoves[i])) cube.addMove(m);
			}
		} else {
			cube.setMoves(turnsUpTo(setupAlg, allMoves, idx));
		}
		appliedRef.current = { idx, key: movesKey };
	}, [currentMoveIdx, allMoves, movesKey, setupAlg, rendererReady]);

	// Playback timer — advances currentMoveIdx. It does not wait for the cube: one built later
	// starts at the position the replay is on.
	useEffect(() => {
		if (!isPlaying) return;
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
	}, [isPlaying, currentMoveIdx, allMoves, speed, onMoveIdxChange]);

	// Dragging turns the view (view_drag.ts); the scene loop draws it and coasts a flick.
	function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
		dragRef.current.down(e);
	}

	function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
		if (dragRef.current.move(e)) wakeSceneRef.current();
	}

	function handlePointerEnd(e: React.PointerEvent<HTMLDivElement>) {
		dragRef.current.end(e);
		wakeSceneRef.current();
	}

	// Seek — only change currentMoveIdx, the sync effect updates the cube
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
			<div className={b('cube')} ref={boxRef}>
				<div
					className={b('canvas')}
					ref={hostRef}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerEnd}
					onPointerCancel={handlePointerEnd}
				/>
			</div>
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
