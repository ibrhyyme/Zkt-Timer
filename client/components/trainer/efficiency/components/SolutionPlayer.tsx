/**
 * SolutionPlayer — sets up scramble and plays solution step-by-step with custom
 * control bar (ReplayPlayer-inspired):
 *   - drawn by our cube engine (cube_view/render/), as the solve replay
 *   - forward: addMove (smooth animation) · backward: the position built at once (setMoves)
 *   - own UI: seek slider + play/pause + speed + move counter
 * if alg empty (before reveal) shows only scramble, controls hidden.
 * The cube is built on the client only; TrainerView still loads this with React.lazy.
 */
import React, {useEffect, useRef, useState, useMemo, useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {Play, Pause, ArrowCounterClockwise} from 'phosphor-react';
import * as THREE from 'three';
import block from '../../../../styles/bem';
import {getEfficiencyMask} from '../../../../util/trainer/efficiency/sticker_mask';
import {capLooksFromMask} from '../../../../util/trainer/case_cube';
import {CubeRenderer} from '../../../timer/smart_cube/cube_view/render/cube_renderer';
import {HOME_TILT_DEG} from '../../../timer/smart_cube/cube_view/view_defaults';
import {ViewDrag, followDrag} from '../../../timer/smart_cube/cube_view/view_drag';
import {useCubePalette} from '../../../../util/cube_colors/useCubePalette';
import {isAppVisible, onVisibilityChange} from '../../../../util/app-visibility';
import type {EfficiencyType} from '../types';

const b = block('eff-player');

interface Props {
	scramble: string;
	alg: string;
	className?: string;
	maskType?: EfficiencyType;
	maskSlot?: number;
	maskRotation?: string;
}

const SPEEDS = [1, 2, 4];
const DEG = Math.PI / 180;

const splitTurns = (text: string) => (text.trim() ? text.trim().split(/\s+/) : []);

const SolutionPlayer: React.FC<Props> = ({scramble, alg, className, maskType, maskSlot, maskRotation}) => {
	const {t} = useTranslation();
	/** The area the cube sits in, and the square inside it that holds the canvas. */
	const boxRef = useRef<HTMLDivElement>(null);
	const hostRef = useRef<HTMLDivElement>(null);
	const cubeRef = useRef<CubeRenderer | null>(null);
	const appliedRef = useRef(0);
	const dragRef = useRef(new ViewDrag());
	/** Turns the view to the drag (and coasts a flick); a no-op until the cube exists. */
	const showDragRef = useRef<() => void>(() => {});

	// The viewer's sticker colours, as on the solve replay.
	const cubeColors = useCubePalette();
	const faceColorsRef = useRef(cubeColors.nxn);
	faceColorsRef.current = cubeColors.nxn;
	const paletteKey = cubeColors.nxn.join(',');

	const [ready, setReady] = useState(false);
	// Mobilde drag-rotate kapali: acikken kube dikey touch'i yakalayip donduruyor, sayfa
	// kaymiyor. Kapatinca kube scroll-saydam olur (animasyonu izlemek hala mumkun). Read after
	// mount, so the server render and the first client render agree.
	const [canDrag, setCanDrag] = useState(false);
	const [moveIdx, setMoveIdx] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [speed, setSpeed] = useState(1);

	const moves = useMemo(() => splitTurns(alg), [alg]);
	const total = moves.length;
	const scrambleRef = useRef(scramble);
	scrambleRef.current = scramble;

	// Cube set up once (puzzle always 3x3x3)
	useEffect(() => {
		const box = boxRef.current;
		const host = hostRef.current;
		if (!box || !host) return undefined;
		setCanDrag(window.innerWidth > 900);
		const drag = dragRef.current;
		drag.reset();
		const q = new THREE.Quaternion();

		let cube: CubeRenderer;
		try {
			cube = new CubeRenderer({
				size: 3,
				faceColors: faceColorsRef.current,
				tableTilt: HOME_TILT_DEG * DEG,
				orientation: drag.quat(q),
			});
		} catch (error) {
			// No WebGL (blocked, lost, very old device): the solutions are still listed.
			console.error('[SolutionPlayer] 3D view unavailable:', error);
			return undefined;
		}
		cube.setMoves(splitTurns(scrambleRef.current));
		appliedRef.current = 0;
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

		cube.setActive(isAppVisible());
		const unsubVisibility = onVisibilityChange((visible) => cube.setActive(visible));

		// The drag puts the view straight on the cube; a flick coasts on (view_drag.ts).
		const view = followDrag(cube, drag);
		showDragRef.current = view.show;

		cubeRef.current = cube;
		setReady(true);
		return () => {
			view.stop();
			showDragRef.current = () => {};
			if (observer) observer.disconnect();
			else window.removeEventListener('resize', fit);
			unsubVisibility();
			cube.dispose();
			if (cubeRef.current === cube) cubeRef.current = null;
			setReady(false);
		};
	}, []);

	useEffect(() => {
		cubeRef.current?.setFaceColors(faceColorsRef.current);
	}, [paletteKey]);

	// Sticker mask — only parts relevant to algorithm in color, rest gray. The mask comes
	// unrotated and is read for the places the holding rotation puts pieces in (case_cube.ts).
	useEffect(() => {
		if (!ready || !cubeRef.current) return undefined;
		let cancelled = false;
		const rotation = maskRotation || '';
		(maskType ? getEfficiencyMask(maskType, maskSlot, '') : Promise.resolve(null))
			.catch(() => null)
			.then((mask) => {
				const cube = cubeRef.current;
				if (cancelled || !cube) return;
				// No mask (none asked for, or cubing.js could not give one): full colour.
				cube.setCapLooks(mask ? capLooksFromMask(mask, rotation) : null);
			});
		return () => {
			cancelled = true;
		};
	}, [maskType, maskSlot, maskRotation, ready]);

	// When scramble or alg changes: return to setup, reset move
	useEffect(() => {
		setMoveIdx(0);
		setIsPlaying(false);
		appliedRef.current = 0;
		cubeRef.current?.setMoves(splitTurns(scramble));
	}, [scramble, alg]);

	// The cube follows moveIdx
	useEffect(() => {
		const cube = cubeRef.current;
		if (!ready || !cube) return;
		const applied = appliedRef.current;
		const target = Math.max(0, Math.min(moveIdx, total));
		if (target === applied) return;
		if (target > applied) {
			// Forward — smooth animation
			for (let i = applied; i < target; i++) cube.addMove(moves[i]);
		} else {
			// Backward — setup + 0..target, at once
			cube.setMoves([...splitTurns(scramble), ...moves.slice(0, target)]);
		}
		appliedRef.current = target;
	}, [moveIdx, moves, ready, scramble, total]);

	// Playback — advances currentMoveIdx
	useEffect(() => {
		if (!isPlaying || !ready) return;
		if (moveIdx >= total) {
			setIsPlaying(false);
			return;
		}
		const tid = setTimeout(() => setMoveIdx((i) => i + 1), 520 / speed);
		return () => clearTimeout(tid);
	}, [isPlaying, moveIdx, total, speed, ready]);

	const onPlayPause = useCallback(() => {
		if (moveIdx >= total) setMoveIdx(0);
		setIsPlaying((p) => !p);
	}, [moveIdx, total]);

	const onSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setIsPlaying(false);
		setMoveIdx(Number(e.target.value));
	}, []);

	const onReset = useCallback(() => {
		setIsPlaying(false);
		setMoveIdx(0);
	}, []);

	const dragHandlers = canDrag
		? {
				onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => dragRef.current.down(e),
				onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
					if (dragRef.current.move(e)) showDragRef.current();
				},
				onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
					dragRef.current.end(e);
					showDragRef.current();
				},
				onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => {
					dragRef.current.end(e);
					showDragRef.current();
				},
			}
		: {};

	const shown = Math.min(moveIdx, total);

	return (
		<div className={[b(), className].filter(Boolean).join(' ')}>
			<div className={b('cube')} ref={boxRef}>
				<div className={b('canvas', {drag: canDrag})} ref={hostRef} {...dragHandlers} />
			</div>
			{total > 0 && (
				<div className={b('controls')}>
					<input
						type="range"
						min={0}
						max={total}
						value={shown}
						onChange={onSeek}
						className={b('seek')}
						aria-label={t('trainer.efficiency.player_seek', {defaultValue: 'Seek'})}
						style={{['--pct' as any]: `${total > 0 ? (shown / total) * 100 : 0}%`}}
					/>
					<div className={b('row')}>
						<button
							type="button"
							className={b('btn', {primary: true})}
							onClick={onPlayPause}
							aria-label={isPlaying ? t('trainer.efficiency.player_pause', {defaultValue: 'Pause'}) : t('trainer.efficiency.player_play', {defaultValue: 'Play'})}
						>
							{isPlaying ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}
						</button>
						<button
							type="button"
							className={b('btn')}
							onClick={onReset}
							aria-label={t('trainer.efficiency.player_reset', {defaultValue: 'Restart'})}
						>
							<ArrowCounterClockwise size={18} weight="bold" />
						</button>
						<div className={b('count')}>
							{shown}<span className={b('count-sep')}>/</span>{total}
						</div>
						<div className={b('speeds')}>
							{SPEEDS.map((s) => (
								<button
									key={s}
									type="button"
									className={b('speed', {active: s === speed})}
									onClick={() => setSpeed(s)}
								>
									{s}x
								</button>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default SolutionPlayer;
