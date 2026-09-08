import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import type { VirtualProgressMethod } from '../../../../shared/util/solve/virtual_progress';
import { onVisibilityChange } from '../../../util/app-visibility';
import { VirtualCubeScene } from '../../../util/virtual_cube/scene';
import type { MoveListener, VrcMove } from '../../../util/virtual_cube/types';
import block from '../../../styles/bem';
import VirtualCubeTouchGrid from './VirtualCubeTouchGrid';

/**
 * The virtual cube's renderer. Owns the canvas and the scene; decides nothing.
 *
 * Split from the controller the same way SmartCubeView is split from SmartCube:
 * everything that reads or writes timer state lives in VirtualCube.tsx, and this
 * component only draws and forwards input.
 *
 * Kept mounted and hidden with CSS rather than unmounted, because tearing the
 * scene down would lose the cube's state mid-solve.
 */

const b = block('virtual-cube');

export interface VirtualCubeViewHandle {
	/** Apply the scramble instantly, with no animation whatever the speed setting. */
	applyMoves: (moves: VrcMove[], ts?: number) => void;
	/** Queue moves for animated playback. */
	addMoves: (moves: VrcMove[], ts?: number) => void;
	/** Return to a solved cube and clear the move counter. */
	reset: () => void;
	/** Route a key to the cube. Returns true when it was consumed. */
	keydown: (keyCode: number, modifiers?: { altKey?: boolean; ctrlKey?: boolean }) => boolean;
	/** Remaining phases, 0 when solved, 99 while animating. */
	isSolved: (method: VirtualProgressMethod) => number;
	getFacelet: () => string;
	/** Reads the count; pass true to zero it (which returns 0, see MoveCounter). */
	moveCnt: (clear?: boolean) => number;
	isMoveFinished: () => boolean;
	/** Blindfolded events grey the stickers once the solve starts. */
	toggleColorVisible: (visible: boolean) => void;
	/** Resolve a touch-grid swipe, for the mobile gesture layer. */
	touchMove: (fromCell: number, toCell: number) => VrcMove | null;
	touchLabels: (fromCell: number) => Record<number, string>;
}

interface Props {
	dimension: number;
	/** Rendered side length in CSS pixels. */
	size: number;
	/** cstimer `vrcSpeed`, in ms. 0 disables animation. */
	speed: number;
	/** cstimer `vrcOri`, e.g. '6,12'. */
	orientation: string;
	/** cstimer `vrcKBL`. */
	keyboardLayout?: string;
	/** cstimer `vrcAH`, two bits: colours and borders on huge cubes. */
	bigVisibility?: string;
	hidden?: boolean;
	/** Mobile only: overlay the 3x3 swipe grid that turns the cube by gesture. */
	showTouchGrid?: boolean;
	onMove?: MoveListener;
}

const VirtualCubeView = forwardRef<VirtualCubeViewHandle, Props>(function VirtualCubeView(
	{ dimension, size, speed, orientation, keyboardLayout, bigVisibility, hidden, showTouchGrid, onMove },
	ref
) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const sceneRef = useRef<VirtualCubeScene | null>(null);

	// Read through refs so the scene never closes over a stale prop. The animation
	// loop and the key handler both outlive any given render.
	const speedRef = useRef(speed);
	speedRef.current = speed;
	const bigVisibilityRef = useRef(bigVisibility);
	bigVisibilityRef.current = bigVisibility;
	const onMoveRef = useRef(onMove);
	onMoveRef.current = onMove;

	// Create the scene once. Canvas access is confined to this effect so the
	// component renders safely during SSR.
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return undefined;

		const scene = new VirtualCubeScene({
			dimension,
			orientation,
			keyboardLayout,
			getSpeed: () => speedRef.current,
			getBigVisibility: () => bigVisibilityRef.current || '11',
		});
		scene.attach(canvas);
		scene.addMoveListener((move, step, ts) => onMoveRef.current?.(move, step, ts));
		sceneRef.current = scene;

		scene.resize(size, window.devicePixelRatio || 1);

		return () => {
			scene.dispose();
			sceneRef.current = null;
		};
		// Deliberately created once. Dimension, size and the settings below are
		// applied through their own effects so a change never drops cube state.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		sceneRef.current?.setDimension(dimension);
	}, [dimension]);

	useEffect(() => {
		sceneRef.current?.setOrientation(orientation);
	}, [orientation]);

	useEffect(() => {
		sceneRef.current?.setKeyboardLayout(keyboardLayout || 'qwerty');
	}, [keyboardLayout]);

	useEffect(() => {
		sceneRef.current?.resize(size, window.devicePixelRatio || 1);
	}, [size]);

	// Huge cubes can grey their unreachable interior. Only above 7x7, which is
	// where the reference applies it.
	useEffect(() => {
		const scene = sceneRef.current;
		if (!scene || dimension <= 7) return;
		const bits = bigVisibility || '11';
		scene.toggleColorVisibleHuge(bits[0] !== '0', bits[1] !== '0');
	}, [bigVisibility, dimension]);

	// A backgrounded tab stops firing animation frames while the clock keeps
	// running, so the first frame back would carry a huge delta. The step is
	// clamped to one full turn so that degrades to an instant move rather than a
	// glitch, but stopping the loop is still cheaper than spinning it.
	useEffect(() => {
		return onVisibilityChange((visible) => {
			if (visible) sceneRef.current?.render();
		});
	}, []);

	// No ResizeObserver here on purpose. The size is fully determined by the `size`
	// prop, and the container carries it as an inline width/height, so nothing else
	// can legitimately change it. An observer that re-measured and resized on its
	// own put the canvas on a different number from the touch grid, which reads the
	// same prop — the grid then covered a different area than the cube it overlays.

	useImperativeHandle(
		ref,
		(): VirtualCubeViewHandle => ({
			applyMoves: (moves, ts) => sceneRef.current?.applyMoves(moves, ts),
			addMoves: (moves, ts) => sceneRef.current?.addMoves(moves, ts),
			reset: () => sceneRef.current?.reset(),
			keydown: (keyCode, modifiers) => sceneRef.current?.keydown(keyCode, modifiers) ?? false,
			isSolved: (method) => sceneRef.current?.isSolved(method) ?? 99,
			getFacelet: () => sceneRef.current?.getFacelet() ?? '',
			moveCnt: (clear) => sceneRef.current?.moveCnt(clear) ?? 0,
			isMoveFinished: () => sceneRef.current?.isMoveFinished() ?? true,
			toggleColorVisible: (visible) => sceneRef.current?.toggleColorVisible(visible),
			touchMove: (from, to) => sceneRef.current?.touchMove(from, to) ?? null,
			touchLabels: (from) => sceneRef.current?.touchLabels(from) ?? {},
		}),
		[]
	);

	return (
		<div className={b({hidden: !!hidden}).toString()} style={{width: size, height: size}}>
			<canvas ref={canvasRef} className={b('canvas').toString()} />
			{showTouchGrid && (
				<VirtualCubeTouchGrid
					size={size}
					resolveMove={(from, to) => sceneRef.current?.touchMove(from, to) ?? null}
					labelsFor={(from) => sceneRef.current?.touchLabels(from) ?? {}}
					onMove={(move) => sceneRef.current?.addMoves([move])}
				/>
			)}
		</div>
	);
});

export default VirtualCubeView;
