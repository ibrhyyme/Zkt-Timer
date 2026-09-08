import type { VirtualProgressMethod } from '../../../shared/util/solve/virtual_progress';

import { makeCamera, moveCameraDelta, parseOrientation, VrcCamera } from './camera';
import { FACE_COLORS, HIDDEN_COLOR, NUM_SIDES } from './constants';
import { advanceMove, animateMove, MoveCounter } from './cube_moves';
import { buildCubePieces, buildHandMarks, updateHandMarks } from './cube_pieces';
import { getFacelet } from './facelet';
import {
	applySliceOffsetKey,
	ARROW_CAMERA_DELTAS,
	CodeMap,
	generateCodeMap,
	generateCubeKeyMapping,
	mapKeyCode,
	SLICE_OFFSET_KEYS,
} from './key_mapping';
import { isParallelMove } from './notation';
import { sizeCanvas, VirtualCubePainter } from './painter';
import { isSolved } from './solved';
import { getTouchMoves } from './touch_mapping';
import type { MoveListener, MoveStep, VrcHandMark, VrcMove, VrcSticker } from './types';

/**
 * The scene: move queue, animation loop, camera and input dispatch.
 * Port of `twistyjs.TwistyScene` (twisty.js:78-570) minus everything that
 * belongs to puzzles other than NxN.
 *
 * The queue is the part worth reading carefully. Moves do not simply play one
 * after another:
 *   - moves on the same axis (R and L) animate simultaneously
 *   - the animation speeds up as the queue grows, so a burst of fast keypresses
 *     does not fall behind
 *   - a move is committed to the authoritative state only when its animation
 *     finishes, and listeners hear about it then, which is what makes the
 *     solved-detection timing correct
 */

/** A queued move carries the timestamp of the input that produced it. */
type QueuedMove = [VrcMove, number];

export interface VirtualCubeSceneOptions {
	dimension: number;
	faceColors?: number[];
	/** cstimer `vrcOri`, e.g. '6,12'. */
	orientation?: string;
	/** cstimer `vrcSpeed` in ms. 0 means "no animation, apply instantly". */
	getSpeed: () => number;
	/** cstimer `vrcKBL`. */
	keyboardLayout?: string;
	/** cstimer `vrcAH`, two bits: colours and borders on cubes larger than 7x7. */
	getBigVisibility?: () => string;
}

export class VirtualCubeScene {
	dimension: number;

	pieces: VrcSticker[][];

	handMarks: VrcHandMark[];

	camera: VrcCamera;

	/** Left and right slice offsets, driven by the 3/4/7/8 keys. */
	oSl = 1;

	oSr = 1;

	private faceColors: number[];

	private keyMapping: Record<number, VrcMove>;

	private codeMap: CodeMap;

	private painter = new VirtualCubePainter();

	private canvas: HTMLCanvasElement | null = null;

	private ctx: CanvasRenderingContext2D | null = null;

	private cssSize = 0;

	private dpr = 1;

	private moveQueue: QueuedMove[] = [];

	private currentMove: QueuedMove[] = [];

	private moveProgress: number[] = [];

	/**
	 * Moves whose animation has finished but which have not been committed yet,
	 * because a parallel move is still in flight. They are drained together so
	 * two simultaneous turns commit as a unit.
	 */
	private cachedFireMoves: QueuedMove[] = [];

	private moveListeners: MoveListener[] = [];

	private moveCounter = new MoveCounter();

	private rafHandle: number | null = null;

	private lastTimeStamp = 0;

	private colorVisible = true;

	private getSpeed: () => number;

	private getBigVisibility: () => string;

	constructor(options: VirtualCubeSceneOptions) {
		this.dimension = options.dimension;
		this.faceColors = options.faceColors || FACE_COLORS;
		this.getSpeed = options.getSpeed;
		this.getBigVisibility = options.getBigVisibility || (() => '11');
		this.codeMap = generateCodeMap(options.keyboardLayout || 'qwerty');

		const { theta, phi } = parseOrientation(options.orientation || '6,12');
		this.camera = makeCamera(theta, phi);

		this.pieces = buildCubePieces(this.dimension, this.faceColors);
		this.handMarks = buildHandMarks(this.dimension, this.faceColors);
		this.keyMapping = generateCubeKeyMapping(this.oSl, this.oSr, this.dimension);
		updateHandMarks(this.handMarks, this.dimension, this.oSl, this.oSr);
	}

	// ---------------------------------------------------------------- lifecycle

	attach(canvas: HTMLCanvasElement): void {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
	}

	/**
	 * Rebuild for a different cube size. Cheaper than recreating the scene since
	 * the canvas, camera and listeners survive.
	 */
	setDimension(dimension: number): void {
		if (dimension === this.dimension) {
			this.reset();
			return;
		}
		this.stopAnimation();
		this.dimension = dimension;
		this.oSl = 1;
		this.oSr = 1;
		this.pieces = buildCubePieces(dimension, this.faceColors);
		this.handMarks = buildHandMarks(dimension, this.faceColors);
		this.keyMapping = generateCubeKeyMapping(1, 1, dimension);
		this.colorVisible = true;
		this.clearQueue();
		updateHandMarks(this.handMarks, dimension, this.oSl, this.oSr);
		this.render();
	}

	/** Return to a solved cube, discarding anything queued. */
	reset(): void {
		this.stopAnimation();
		this.clearQueue();
		this.pieces = buildCubePieces(this.dimension, this.faceColors);
		this.colorVisible = true;
		this.moveCounter.value(true);
		updateHandMarks(this.handMarks, this.dimension, this.oSl, this.oSr);
		this.render();
	}

	setOrientation(orientation: string): void {
		const { theta, phi } = parseOrientation(orientation);
		this.camera = makeCamera(theta, phi);
		this.render();
	}

	setKeyboardLayout(layout: string): void {
		this.codeMap = generateCodeMap(layout || 'qwerty');
	}

	resize(cssSize: number, dpr: number): void {
		this.cssSize = cssSize;
		this.dpr = dpr;
		if (this.canvas) {
			sizeCanvas(this.canvas, cssSize, dpr);
		}
		this.render();
	}

	dispose(): void {
		this.stopAnimation();
		this.moveListeners = [];
		this.canvas = null;
		this.ctx = null;
	}

	private clearQueue(): void {
		this.moveQueue = [];
		this.currentMove = [];
		this.moveProgress = [];
		this.cachedFireMoves = [];
	}

	// ------------------------------------------------------------------ drawing

	render(): void {
		if (!this.ctx || this.cssSize <= 0) return;
		this.painter.render(
			{ ctx: this.ctx, cssSize: this.cssSize, dpr: this.dpr },
			this.pieces,
			this.handMarks,
			this.camera,
			this.dimension
		);
	}

	// ----------------------------------------------------------------- listeners

	addMoveListener(listener: MoveListener): void {
		this.moveListeners.push(listener);
	}

	removeMoveListener(listener: MoveListener): void {
		const index = this.moveListeners.indexOf(listener);
		if (index !== -1) this.moveListeners.splice(index, 1);
	}

	private fire(move: QueuedMove, step: MoveStep): void {
		for (let i = 0; i < this.moveListeners.length; i++) {
			this.moveListeners[i](move[0], step, move[1]);
		}
	}

	// --------------------------------------------------------------- move queue

	/**
	 * Queue moves for animated playback. twisty.js:460-474.
	 *
	 * Listeners hear step 0 for every move immediately, which is what lets the
	 * timer start on the first keypress rather than when its animation ends.
	 */
	addMoves(moves: VrcMove[], ts?: number): void {
		const timestamp = ts || Date.now();
		const queued: QueuedMove[] = moves.map((move) => [move, timestamp] as QueuedMove);

		for (const move of queued) {
			this.fire(move, 0);
		}

		// Speed 0 is "infinite", i.e. no animation at all.
		if (~~this.getSpeed() === 0) {
			this.applyMovesInternal(queued);
			return;
		}

		this.moveQueue = this.moveQueue.concat(queued);
		if (this.moveQueue.length > 0) {
			this.startAnimation();
		}
	}

	/**
	 * Apply moves instantly, skipping animation entirely. Used for the scramble.
	 * twisty.js:484-504.
	 */
	applyMoves(moves: VrcMove[], ts?: number): void {
		const timestamp = ts || Date.now();
		this.applyMovesInternal(moves.map((move) => [move, timestamp] as QueuedMove));
	}

	private applyMovesInternal(queued: QueuedMove[]): void {
		this.moveQueue = this.moveQueue.concat(queued);

		while (this.cachedFireMoves.length !== 0) {
			this.commit(this.cachedFireMoves[0][0]);
			this.fire(this.cachedFireMoves.shift() as QueuedMove, 2);
		}

		while (this.moveQueue.length > 0) {
			if (this.isAnimationFinished()) {
				this.startMove();
			}
			this.commit(this.currentMove[0][0]);
			this.fire(this.currentMove.shift() as QueuedMove, 2);
			this.moveProgress.shift();
		}

		this.render();
	}

	private commit(move: VrcMove): void {
		this.moveCounter.count(move, this.dimension);
		advanceMove(this.pieces, move, this.dimension);
	}

	/** Nothing animating and nothing waiting. twisty.js:476-478. */
	isMoveFinished(): boolean {
		return (
			this.moveQueue.length === 0 &&
			this.currentMove.length === 0 &&
			this.cachedFireMoves.length === 0
		);
	}

	/** Nothing animating right now, though more may be queued. twisty.js:480-482. */
	isAnimationFinished(): boolean {
		return this.currentMove.length === 0;
	}

	private startMove(): void {
		const next = this.moveQueue.shift() as QueuedMove;
		this.currentMove.push(next);
		this.moveProgress.push(0);
		this.fire(next, 1);
	}

	// ---------------------------------------------------------------- animation

	private startAnimation(): void {
		if (this.rafHandle === null) {
			this.startMove();
			this.lastTimeStamp = Date.now();
			this.rafHandle = requestAnimationFrame(this.animateLoop);
		} else if (
			!this.currentMove[0] ||
			isParallelMove(this.currentMove[0][0], this.moveQueue[0][0])
		) {
			// Same axis as what is already turning, so it can animate alongside it
			// instead of waiting. twisty.js:548.
			this.startMove();
		}
	}

	private stopAnimation(): void {
		if (this.rafHandle !== null) {
			cancelAnimationFrame(this.rafHandle);
			this.rafHandle = null;
		}
	}

	private animateLoop = (): void => {
		const timeStamp = Date.now();
		// The longer the queue, the faster each move plays, so a fast solver never
		// watches the cube lag behind their fingers. twisty.js:558.
		const speed = this.getSpeed() || 1e-3;
		const timeProgress = (((timeStamp - this.lastTimeStamp) / speed) * (this.moveQueue.length + 2)) / 2;
		this.lastTimeStamp = timeStamp;

		this.stepAnimation(Math.max(Math.min(timeProgress, 1), 0.0001));
		this.render();

		// stepAnimation may have stopped the loop, so re-check rather than assume.
		if (this.rafHandle !== null) {
			this.rafHandle = requestAnimationFrame(this.animateLoop);
		}
	};

	private stepAnimation(animationStep: number): void {
		for (let i = 0; i < this.moveProgress.length; i++) {
			this.moveProgress[i] += animationStep;
		}

		if (this.moveProgress[0] < 1) {
			for (let i = 0; i < this.currentMove.length; i++) {
				animateMove(this.pieces, this.currentMove[i][0], animationStep, this.dimension);
			}
			return;
		}

		this.cachedFireMoves.push(this.currentMove.shift() as QueuedMove);
		this.moveProgress.shift();

		if (this.currentMove.length === 0) {
			while (this.cachedFireMoves.length !== 0) {
				this.commit(this.cachedFireMoves[0][0]);
				this.fire(this.cachedFireMoves.shift() as QueuedMove, 2);
			}
		}

		if (this.moveQueue.length === 0 && this.currentMove.length === 0) {
			this.stopAnimation();
		} else if (this.currentMove.length === 0) {
			this.startMove();
		}
	}

	// -------------------------------------------------------------------- input

	/**
	 * Handle a key. Returns true when the caller should redraw.
	 * Port of `TwistyScene.keydown` (twisty.js:195-219) plus `keydownCallback`
	 * (twistynnn.js:393-424).
	 *
	 * Modifier combinations are passed over rather than eaten, so application
	 * shortcuts stay reachable while the cube has the keyboard.
	 */
	keydown(keyCode: number, modifiers?: { altKey?: boolean; ctrlKey?: boolean }): boolean {
		if (modifiers && (modifiers.altKey || modifiers.ctrlKey)) {
			return false;
		}

		const code = mapKeyCode(keyCode, this.codeMap);

		const arrow = ARROW_CAMERA_DELTAS[code];
		if (arrow) {
			this.camera = moveCameraDelta(this.camera, arrow[0], arrow[1]);
			this.render();
			return true;
		}

		if (SLICE_OFFSET_KEYS.indexOf(code) !== -1) {
			const next = applySliceOffsetKey(code, this.oSl, this.oSr, this.dimension);
			if (next) {
				this.oSl = next.oSl;
				this.oSr = next.oSr;
				this.keyMapping = generateCubeKeyMapping(this.oSl, this.oSr, this.dimension);
				updateHandMarks(this.handMarks, this.dimension, this.oSl, this.oSr);

				// Which rings stay coloured depends on the offsets, so moving them has
				// to re-apply the visibility. twistynnn.js:413-418.
				//
				// Unreachable today: getVirtualCubeSize caps at 7x7, because that is
				// where Zkt-Timer's cube types stop. cstimer goes to 11x11. Ported so
				// the behaviour is already correct if larger cubes are ever added.
				if (this.dimension > 7) {
					const bits = this.getBigVisibility() || '11';
					this.toggleColorVisibleHuge(bits[0] !== '0', bits[1] !== '0');
				}

				this.render();
				return true;
			}
		}

		const move = this.keyMapping[code];
		if (move) {
			this.addMoves([move]);
			return true;
		}

		return false;
	}

	/** Resolve a swipe between two grid cells into a move. See touch_mapping.ts. */
	touchMove(fromCell: number, toCell: number): VrcMove | null {
		const entry = getTouchMoves(this.oSl, this.oSr, this.dimension)[fromCell * 10 + toCell];
		return entry ? entry.move : null;
	}

	/** Labels to paint on the grid while a drag is in progress. */
	touchLabels(fromCell: number): Record<number, string> {
		const moves = getTouchMoves(this.oSl, this.oSr, this.dimension);
		const labels: Record<number, string> = {};
		for (let to = 1; to <= 9; to++) {
			const entry = moves[fromCell * 10 + to];
			if (entry) labels[to] = entry.label;
		}
		return labels;
	}

	// ------------------------------------------------------------------- queries

	getFacelet(): string {
		return getFacelet(this.pieces, this.dimension);
	}

	isSolved(method: VirtualProgressMethod): number {
		return isSolved(this.pieces, this.dimension, method, {
			animationFinished: this.isAnimationFinished(),
			moveFinished: this.isMoveFinished(),
		});
	}

	moveCnt(clear = false): number {
		return this.moveCounter.value(clear);
	}

	// ------------------------------------------------------------- visibility

	/**
	 * Grey out every sticker, used by blindfolded events once the solve starts.
	 * twistynnn.js:278-291.
	 */
	toggleColorVisible(visible: boolean): void {
		if (this.colorVisible === visible) return;
		this.colorVisible = visible;

		for (let faceIndex = 0; faceIndex < NUM_SIDES; faceIndex++) {
			const color = visible ? this.faceColors[faceIndex] : HIDDEN_COLOR;
			for (const sticker of this.pieces[faceIndex]) {
				sticker.color = color;
			}
		}
		this.render();
	}

	/**
	 * Big-cube decluttering: keep the rings the current slice offsets can actually
	 * reach, grey the rest. Only meaningful above 7x7. twistynnn.js:293-320.
	 */
	toggleColorVisibleHuge(colorVisible: boolean, borderVisible: boolean): void {
		const dim = this.dimension;
		const effLayers = new Set([0, 1, this.oSl - 1, this.oSl, this.oSl + 1, this.oSr - 1, this.oSr, this.oSr + 1]);

		for (let faceIndex = 0; faceIndex < NUM_SIDES; faceIndex++) {
			const faceStickers = this.pieces[faceIndex];
			for (let stickerIndex = 0; stickerIndex < faceStickers.length; stickerIndex++) {
				const cord1 = stickerIndex % dim;
				const cord2 = ~~(stickerIndex / dim);
				const hit =
					effLayers.has(cord1) ||
					effLayers.has(dim - 1 - cord1) ||
					effLayers.has(cord2) ||
					effLayers.has(dim - 1 - cord2);

				const sticker = faceStickers[stickerIndex];
				sticker.color = hit || colorVisible ? this.faceColors[faceIndex] : HIDDEN_COLOR;
				sticker.border = hit || borderVisible;
			}
		}
		this.render();
	}
}
