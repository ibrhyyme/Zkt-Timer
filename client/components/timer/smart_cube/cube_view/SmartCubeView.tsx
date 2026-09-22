import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import * as THREE from 'three';
import Cube from 'cubejs';
import type { TwistyPlayer } from 'cubing/twisty';
import { solveAsync } from '../../../../util/solver_worker_manager';
import { getReverseTurns } from '../../../../util/solve/turns';
import { onVisibilityChange } from '../../../../util/app-visibility';
import { DEFAULT_SOLVED_STATE } from '../../../../util/smart_cube';
import type { SmartTurn } from '../../../../util/smart_scramble';
import { getSmartCubeManager } from '../../../../util/smart_cube/connection_manager';
import { recolorPuzzle, stickerPaletteFromFaceColors } from './cube_palette';
import { useCubePalette } from '../../../../util/cube_colors/useCubePalette';
import { HOME_TILT_DEG, HOME_TURN_DEG } from './view_defaults';

/**
 * The 3D cube that mirrors a connected smart cube: turns animate as they arrive and the
 * gyroscope (when the cube has one) rotates the whole scene.
 *
 * Extracted from SmartCube.tsx so friendly rooms can show the same thing. The rules that
 * decide anything about a solve live in the shared engine; this component only draws.
 */

export interface SmartCubeViewHandle {
	/**
	 * Replay the cube to a reported state. The player is driven by moves, so a state is
	 * reached by applying the inverse of its solution. Called when the engine re-anchors
	 * its tracker, otherwise the view keeps showing a state that never happened.
	 */
	syncToFacelets: (facelets: string) => void;
	/** Drop the gyro basis so the next reading re-establishes "home" orientation. */
	resetGyro: () => void;
}

interface Props {
	/** Re-subscribes the gyro when this flips, since a new connection means a new cube. */
	connected: boolean;
	size: number;
	/** Kept mounted but collapsed: tearing the player down would lose the visual state. */
	hidden?: boolean;
	/**
	 * When the caller clears its turn stream right after a scramble finishes, the visual
	 * state IS the scrambled state and must be left alone. On any other clear the view
	 * returns to solved.
	 */
	keepVisualOnClear?: boolean;
	onStreamCleared?: () => void;
}

const SmartCubeView = forwardRef<SmartCubeViewHandle, Props>(function SmartCubeView(
	{ connected, size, hidden, keepVisualOnClear, onStreamCleared },
	ref
) {
	const containerRef = useRef<HTMLDivElement>(null);
	const twistyPlayerRef = useRef<TwistyPlayer | null>(null);

	const twistySceneRef = useRef<THREE.Scene | null>(null);
	const twistyVantageRef = useRef<any>(null);
	const gyroBasisRef = useRef<THREE.Quaternion | null>(null);
	// The viewing angle (see view_defaults.ts). The idle cube, the gyro view and "reset
	// gyro" all derive from this one quaternion, so they move together.
	const HOME_ORIENTATION = useRef(
		new THREE.Quaternion().setFromEuler(
			new THREE.Euler((HOME_TILT_DEG * Math.PI) / 180, (-HOME_TURN_DEG * Math.PI) / 180, 0)
		)
	);
	const cubeQuaternion = useRef(HOME_ORIENTATION.current.clone());
	const animFrameRef = useRef<number | null>(null);
	// Sticker palette: which puzzle instances are already repainted, and whether the
	// current scene still needs checking. See cube_palette.ts for why this is needed.
	const paletteDoneRef = useRef(new WeakSet<object>());

	// The user's own sticker colours. `paletteKey` is what the player's effect depends on:
	// recolouring is one-shot per puzzle instance (it matches on the renderer's stock colours,
	// which are gone after the first pass), so a changed palette has to rebuild the player
	// rather than repaint it.
	const cubeColors = useCubePalette();
	const paletteKey = cubeColors.nxn.join(',');
	const stickerPalette = useMemo(() => stickerPaletteFromFaceColors(cubeColors.nxn), [paletteKey]);
	const stickerPaletteRef = useRef(stickerPalette);
	stickerPaletteRef.current = stickerPalette;
	const recolorPendingRef = useRef(true);
	const appliedTurnsRef = useRef(0);

	const smartTurns: SmartTurn[] = useSelector((state: any) => state.timer?.smartTurns || []);
	const smartCurrentState: string | null = useSelector((state: any) => state.smartCube?.smartCurrentState || null);
	const smartCurrentStateRef = useRef(smartCurrentState);
	smartCurrentStateRef.current = smartCurrentState;

	// Props read inside long-lived callbacks; refs keep them current without re-subscribing.
	const keepVisualRef = useRef(keepVisualOnClear);
	keepVisualRef.current = keepVisualOnClear;
	const onStreamClearedRef = useRef(onStreamCleared);
	onStreamClearedRef.current = onStreamCleared;

	// ── TwistyPlayer lifecycle ──
	useEffect(() => {
		if (!containerRef.current) return;

		containerRef.current.innerHTML = '';
		if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

		let twisty: TwistyPlayer;
		let cancelled = false;
		let unsubVisibility: (() => void) | undefined;

		const initTwisty = async () => {
			try {
				const { TwistyPlayer } = await import('cubing/twisty');
				if (cancelled) return;

				twisty = new TwistyPlayer({
					puzzle: '3x3x3',
					visualization: 'PG3D',
					alg: '',
					experimentalSetupAnchor: 'start',
					background: 'none',
					controlPanel: 'none',
					hintFacelets: 'none',
					experimentalDragInput: 'none',
					cameraLatitude: 0,
					cameraLongitude: 0,
					cameraLatitudeLimit: 0,
					tempoScale: 5, // Same as reference (gan-cube-sample): visible but fast
				});

				if (containerRef.current) {
					containerRef.current.appendChild(twisty);
					twisty.style.width = '100%';
					twisty.style.height = '100%';
					twistyPlayerRef.current = twisty;
				}

				let animRunning = true;

				const animate = async () => {
					if (cancelled || !animRunning) return;

					if (!twistySceneRef.current || !twistyVantageRef.current) {
						try {
							const vantageList = await (twisty as any).experimentalCurrentVantages();
							twistyVantageRef.current = [...vantageList][0];
							twistySceneRef.current = await twistyVantageRef.current.scene.scene();
							// A (re)acquired scene may hold a puzzle that has not been repainted.
							recolorPendingRef.current = true;
						} catch (e) {
							// Scene not ready yet
						}
					}

					if (twistySceneRef.current && twistyVantageRef.current) {
						// The puzzle object appears a little after the scene does, so keep
						// looking until it is there; once found this costs nothing more.
						if (recolorPendingRef.current) {
							const result = recolorPuzzle(twistySceneRef.current, paletteDoneRef.current, stickerPaletteRef.current);
							if (result !== 'not-found') recolorPendingRef.current = false;
						}
						twistySceneRef.current.quaternion.slerp(cubeQuaternion.current, 0.25);
						twistyVantageRef.current.render();
					}

					animFrameRef.current = requestAnimationFrame(animate);
				};
				animate();

				// A backgrounded tab should not keep a render loop alive.
				unsubVisibility = onVisibilityChange((visible) => {
					if (visible && !animRunning && !cancelled) {
						animRunning = true;
						animate();
					} else if (!visible) {
						animRunning = false;
						if (animFrameRef.current) {
							cancelAnimationFrame(animFrameRef.current);
							animFrameRef.current = null;
						}
					}
				});
			} catch (error) {
				console.error('Failed to load TwistyPlayer:', error);
			}
		};

		initTwisty();

		return () => {
			cancelled = true;
			unsubVisibility?.();
			if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
			if (containerRef.current) containerRef.current.innerHTML = '';
		};
	}, [paletteKey]);

	// ── Move mirror ──
	useEffect(() => {
		if (smartTurns.length > appliedTurnsRef.current && twistyPlayerRef.current) {
			const newTurns = smartTurns.slice(appliedTurnsRef.current);
			newTurns.forEach((turnObj) => {
				(twistyPlayerRef.current as any).experimentalAddMove(turnObj.turn, { cancel: false });
			});
			appliedTurnsRef.current = smartTurns.length;
		} else if (smartTurns.length === 0 && appliedTurnsRef.current > 0) {
			if (!keepVisualRef.current) {
				resetVisualToSolved();
			}
			appliedTurnsRef.current = 0;
			onStreamClearedRef.current?.();
		}
	}, [smartTurns]);

	// ── Gyro ──
	// The manager owns the cube and reports whether it has a gyroscope (the driver raises it
	// from the HARDWARE packet), so this component only asks for the stream. Subscribing is
	// also what tells the manager a page is drawing gyro data: with nobody subscribed it
	// stops processing those packets entirely.
	useEffect(() => {
		if (!connected) return;
		const unsubscribe = getSmartCubeManager().subscribeGyro((event: any) => {
			if (event.type !== 'GYRO' || !event.quaternion) return;
			const { x: qx, y: qy, z: qz, w: qw } = event.quaternion;
			const quat = new THREE.Quaternion(qx, qz, -qy, qw).normalize();

			if (!gyroBasisRef.current) {
				// Capture the first full reading and invert it, same as the reference project.
				gyroBasisRef.current = quat.clone().conjugate();
			}

			cubeQuaternion.current.copy(
				quat.premultiply(gyroBasisRef.current).premultiply(HOME_ORIENTATION.current)
			);
		});

		return () => unsubscribe();
	}, [connected]);

	function resetVisualToSolved() {
		if (!twistyPlayerRef.current) return;
		twistyPlayerRef.current.alg = '';
		// The scene object is replaced when alg is reset; drop the cached handles.
		twistySceneRef.current = null;
		twistyVantageRef.current = null;
	}

	useImperativeHandle(ref, () => ({
		syncToFacelets: async (facelets: string) => {
			const twisty = twistyPlayerRef.current;
			if (!twisty) return;
			try {
				resetVisualToSolved();
				appliedTurnsRef.current = smartTurns.length;
				if (facelets === DEFAULT_SOLVED_STATE) return;

				const solution = await solveAsync(Cube.fromString(facelets).toJSON());
				// The solve runs in a worker; if the cube moved meanwhile, replaying the setup
				// would fight with the moves the mirror effect already applied.
				if (smartCurrentStateRef.current !== facelets) return;

				for (const move of getReverseTurns((solution || '').trim())) {
					(twisty as any).experimentalAddMove(move, { cancel: false });
				}
			} catch (e) {
				console.warn('[SmartCubeView] visual sync to physical state failed:', e);
			}
		},
		resetGyro: () => {
			gyroBasisRef.current = null;
			cubeQuaternion.current.copy(HOME_ORIENTATION.current);
		},
	}));

	return (
		<div style={hidden ? { display: 'none' } : undefined}>
			<div ref={containerRef} style={{ width: size, height: size }} />
		</div>
	);
});

export default SmartCubeView;
