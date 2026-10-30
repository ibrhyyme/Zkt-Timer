import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useSelector } from 'react-redux';
import * as THREE from 'three';
import { isAppVisible, onVisibilityChange } from '../../../../util/app-visibility';
import type { SmartTurn } from '../../../../util/smart_scramble';
import { getSmartCubeManager } from '../../../../util/smart_cube/connection_manager';
import type { SmartCubePuzzle } from '../../../../../shared/smart_cube/puzzle';
import { useCubePalette } from '../../../../util/cube_colors/useCubePalette';
import { HOME_TILT_DEG, HOME_TURN_DEG } from './view_defaults';
import { CubeRenderer } from './render/cube_renderer';

/**
 * The 3D cube that mirrors a connected smart cube: turns animate as they arrive and the
 * gyroscope (when the cube has one) rotates the whole cube.
 *
 * Extracted from SmartCube.tsx so friendly rooms can show the same thing. The rules that
 * decide anything about a solve live in the shared engine; this component only draws, with
 * our own renderer (render/).
 */

export interface SmartCubeViewHandle {
	/**
	 * Show a reported state. Called when the engine re-anchors its tracker, otherwise the
	 * view keeps showing a state that never happened.
	 */
	syncToFacelets: (facelets: string) => void;
	/** Drop the gyro basis so the next reading re-establishes "home" orientation. */
	resetGyro: () => void;
}

interface Props {
	/** Re-subscribes the gyro when this flips, since a new connection means a new cube. */
	connected: boolean;
	size: number;
	/** Kept mounted but collapsed: tearing the renderer down would lose the visual state. */
	hidden?: boolean;
	/**
	 * When the caller clears its turn stream right after a scramble finishes, the visual
	 * state IS the scrambled state and must be left alone. On any other clear the view
	 * returns to solved.
	 */
	keepVisualOnClear?: boolean;
	onStreamCleared?: () => void;
	/**
	 * Where the cube's signals come from, for a caller that is not on the app-wide link.
	 *
	 * Left out, the view reads the Redux mirror and the app-wide connection manager, which is
	 * what the timer page and rooms have always done and still do. Battle passes them in
	 * because it runs two cubes at once, below the manager, and neither of its streams reaches
	 * Redux — without this the second cube would have nothing to draw from.
	 */
	turns?: SmartTurn[];
	/**
	 * Not read any more: it only guarded the old solve-and-replay sync against turns landing
	 * mid-solve, and states are now drawn directly. Still accepted so battle compiles unchanged.
	 */
	facelets?: string | null;
	/** Null disables the gyroscope (battle draws no gyro). Undefined means the app-wide manager. */
	gyroSource?: { subscribeGyro: (listener: (event: any) => void) => () => void } | null;
	/** Which cube to draw. Left out, the connected cube's (a 2x2 for the GAN 251 UI and WCU_MY22). */
	puzzle?: SmartCubePuzzle;
}

const SmartCubeView = forwardRef<SmartCubeViewHandle, Props>(function SmartCubeView(
	{ connected, size, hidden, keepVisualOnClear, onStreamCleared, turns, gyroSource, puzzle: puzzleProp },
	ref
) {
	const containerRef = useRef<HTMLDivElement>(null);
	const rendererRef = useRef<CubeRenderer | null>(null);

	const gyroBasisRef = useRef<THREE.Quaternion | null>(null);
	// The viewing angle (see view_defaults.ts). The idle cube, the gyro view and "reset
	// gyro" all derive from this one quaternion, so they move together.
	const HOME_ORIENTATION = useRef(
		new THREE.Quaternion().setFromEuler(
			new THREE.Euler((HOME_TILT_DEG * Math.PI) / 180, (-HOME_TURN_DEG * Math.PI) / 180, 0)
		)
	);
	const cubeQuaternion = useRef(HOME_ORIENTATION.current.clone());
	const appliedTurnsRef = useRef(0);

	// The user's own sticker colours, applied in place: a palette change keeps the cube's state.
	const cubeColors = useCubePalette();
	const faceColorsRef = useRef(cubeColors.nxn);
	faceColorsRef.current = cubeColors.nxn;
	const paletteKey = cubeColors.nxn.join(',');

	// Hooks run unconditionally; the props simply win when a caller supplies them.
	const reduxTurns: SmartTurn[] = useSelector((state: any) => state.timer?.smartTurns || []);
	const reduxPuzzle: SmartCubePuzzle = useSelector((state: any) => state.smartCube?.smartCubePuzzle || '333');
	const puzzle = puzzleProp ?? reduxPuzzle;

	const smartTurns: SmartTurn[] = turns ?? reduxTurns;

	// Props read inside long-lived callbacks; refs keep them current without re-subscribing.
	const keepVisualRef = useRef(keepVisualOnClear);
	keepVisualRef.current = keepVisualOnClear;
	const onStreamClearedRef = useRef(onStreamCleared);
	onStreamClearedRef.current = onStreamCleared;
	const sizeRef = useRef(size);
	sizeRef.current = size;
	const hiddenRef = useRef(hidden);
	hiddenRef.current = hidden;

	// ── Renderer lifecycle ──
	// Rebuilt only for a different puzzle. Like the player it replaced, a new renderer starts
	// solved and the move mirror carries on from the turns already applied.
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return undefined;

		let cube: CubeRenderer;
		try {
			cube = new CubeRenderer({
				size: puzzle === '222' ? 2 : 3,
				faceColors: faceColorsRef.current,
				tableTilt: (HOME_TILT_DEG * Math.PI) / 180,
				orientation: cubeQuaternion.current,
			});
		} catch (error) {
			// No WebGL (blocked, lost, very old device): the rest of the page still works.
			console.error('[SmartCubeView] 3D view unavailable:', error);
			return undefined;
		}
		container.appendChild(cube.canvas);
		cube.resize(sizeRef.current);
		cube.setActive(!hiddenRef.current && isAppVisible());
		rendererRef.current = cube;

		// A backgrounded tab should not keep drawing.
		const unsubVisibility = onVisibilityChange((visible) => cube.setActive(visible && !hiddenRef.current));

		return () => {
			unsubVisibility();
			cube.dispose();
			if (rendererRef.current === cube) rendererRef.current = null;
		};
	}, [puzzle]);

	useEffect(() => {
		rendererRef.current?.setFaceColors(faceColorsRef.current);
	}, [paletteKey]);

	useEffect(() => {
		rendererRef.current?.resize(size);
	}, [size]);

	useEffect(() => {
		rendererRef.current?.setActive(!hidden && isAppVisible());
	}, [hidden]);

	// ── Move mirror ──
	useEffect(() => {
		const cube = rendererRef.current;
		if (smartTurns.length > appliedTurnsRef.current && cube) {
			for (const turnObj of smartTurns.slice(appliedTurnsRef.current)) cube.addMove(turnObj.turn);
			appliedTurnsRef.current = smartTurns.length;
		} else if (smartTurns.length === 0 && appliedTurnsRef.current > 0) {
			if (!keepVisualRef.current) cube?.reset();
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
		// undefined means "use the app-wide manager" (timer, rooms); null means this caller
		// has no gyro to offer and the whole subscription is skipped.
		const source = gyroSource === undefined ? getSmartCubeManager() : gyroSource;
		if (!source) return;
		const unsubscribe = source.subscribeGyro((event: any) => {
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
			rendererRef.current?.setOrientation(cubeQuaternion.current);
		});

		return () => unsubscribe();
	}, [connected, gyroSource]);

	useImperativeHandle(ref, () => ({
		syncToFacelets: (facelets: string) => {
			const cube = rendererRef.current;
			if (!cube) return;
			appliedTurnsRef.current = smartTurns.length;
			// The state is drawn directly. No solve and replay, so no window in which a turn
			// arriving mid-sync could be applied twice.
			cube.setFacelets(facelets);
		},
		resetGyro: () => {
			gyroBasisRef.current = null;
			cubeQuaternion.current.copy(HOME_ORIENTATION.current);
			rendererRef.current?.setOrientation(cubeQuaternion.current);
		},
	}));

	return (
		<div style={hidden ? { display: 'none' } : undefined}>
			<div ref={containerRef} style={{ width: size, height: size }} />
		</div>
	);
});

export default SmartCubeView;
