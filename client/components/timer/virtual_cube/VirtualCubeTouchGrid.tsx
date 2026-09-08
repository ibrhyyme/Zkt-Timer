import React, { useEffect, useRef, useState } from 'react';

import { HINT_BOARD_MS } from '../../../util/virtual_cube/touch_mapping';
import type { VrcMove } from '../../../util/virtual_cube/types';
import block from '../../../styles/bem';

/**
 * The mobile move input: a 3x3 grid laid invisibly over the cube.
 * Port of cstimer's `touchcube` (twisty.js:146-172, 222-298).
 *
 * You press a cell and drag to another; the pair is the move. cstimer does not
 * put buttons on screen for this, and neither do we: the grid costs no layout
 * space and the cube stays as large as it can be.
 *
 * It teaches itself. The moment a finger lands, every cell that forms a legal
 * move with the one under it is labelled with that move's name, the origin turns
 * red and a valid destination turns green. Nothing has to be memorised in advance.
 *
 *   1 2 3
 *   4 5 6
 *   7 8 9
 *
 * Edge swipes turn the adjacent face (6 to 3 is R), swipes through the centre are
 * whole-cube rotations (5 to 2 is x) and diagonals from the centre are wide moves.
 */

const b = block('virtual-cube-touch');

// Hoisted so the identity is stable across renders, matching KeyWatcher.
const PASSIVE_FALSE: AddEventListenerOptions = { passive: false };

interface Props {
	/** Side length in CSS pixels; the grid is square and overlays the canvas exactly. */
	size: number;
	/** Resolve a from/to cell pair into a move, or null when the pair means nothing. */
	resolveMove: (fromCell: number, toCell: number) => VrcMove | null;
	/** Labels for every legal destination from a cell, keyed by destination. */
	labelsFor: (fromCell: number) => Record<number, string>;
	onMove: (move: VrcMove) => void;
}

export default function VirtualCubeTouchGrid({ size, resolveMove, labelsFor, onMove }: Props) {
	const rootRef = useRef<HTMLDivElement>(null);
	const startCellRef = useRef<number | null>(null);
	const hintTimerRef = useRef<any>(null);

	const [active, setActive] = useState(false);
	const [board, setBoard] = useState(false);
	const [labels, setLabels] = useState<Record<number, string>>({});
	const [fromCell, setFromCell] = useState<number | null>(null);
	const [toCell, setToCell] = useState<number | null>(null);

	useEffect(() => {
		return () => {
			if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
		};
	}, []);

	// Native listeners, registered non-passive on purpose.
	//
	// React 17 attaches touchstart and touchmove as PASSIVE listeners, so calling
	// preventDefault from an onTouchStart/onTouchMove prop does nothing except log
	// "Unable to preventDefault inside passive event listener invocation" on every
	// single move event. Without a working preventDefault the page keeps handling
	// the gesture itself, so dragging to turn the cube also scrolls the page and
	// can trigger the edge-swipe back navigation.
	//
	// KeyWatcher hit the same thing and solves it the same way (PASSIVE_FALSE).
	const handlersRef = useRef({ handleStart, handleMove, handleEnd, handleCancel });
	handlersRef.current = { handleStart, handleMove, handleEnd, handleCancel };

	useEffect(() => {
		const root = rootRef.current;
		if (!root) return undefined;

		const onStart = (e: TouchEvent) => handlersRef.current.handleStart(e);
		const onMove = (e: TouchEvent) => handlersRef.current.handleMove(e);
		const onEnd = (e: TouchEvent) => handlersRef.current.handleEnd(e);
		const onCancel = () => handlersRef.current.handleCancel();

		root.addEventListener('touchstart', onStart, PASSIVE_FALSE);
		root.addEventListener('touchmove', onMove, PASSIVE_FALSE);
		root.addEventListener('touchend', onEnd, PASSIVE_FALSE);
		root.addEventListener('touchcancel', onCancel);

		return () => {
			root.removeEventListener('touchstart', onStart, PASSIVE_FALSE);
			root.removeEventListener('touchmove', onMove, PASSIVE_FALSE);
			root.removeEventListener('touchend', onEnd, PASSIVE_FALSE);
			root.removeEventListener('touchcancel', onCancel);
		};
	}, []);

	/** Which cell a point falls in, or 0 when it is outside the grid. */
	function cellAt(clientX: number, clientY: number): number {
		const root = rootRef.current;
		if (!root) return 0;

		const rect = root.getBoundingClientRect();
		const x = clientX - rect.left;
		const y = clientY - rect.top;
		if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return 0;

		const col = Math.min(2, Math.floor((x / rect.width) * 3));
		const row = Math.min(2, Math.floor((y / rect.height) * 3));
		return row * 3 + col + 1;
	}

	/** Keep the grid outline visible for a few seconds after any touch. */
	function hintBoard() {
		setBoard(true);
		if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
		hintTimerRef.current = setTimeout(() => setBoard(false), HINT_BOARD_MS);
	}

	function handleStart(e: TouchEvent) {
		const point = e.touches[0];
		if (!point) return;

		const cell = cellAt(point.clientX, point.clientY);
		if (!cell) return;

		// The cube owns this gesture: without this the page's own edge-swipe back
		// navigation fires while the user is trying to turn R.
		e.preventDefault();

		startCellRef.current = cell;
		setActive(true);
		setFromCell(cell);
		setToCell(null);
		setLabels(labelsFor(cell));
		hintBoard();
	}

	function handleMove(e: TouchEvent) {
		if (startCellRef.current === null) return;
		const point = e.touches[0];
		if (!point) return;

		e.preventDefault();

		const cell = cellAt(point.clientX, point.clientY);
		if (!cell) {
			setActive(false);
			setToCell(null);
			return;
		}

		setActive(true);
		hintBoard();
		setToCell(resolveMove(startCellRef.current, cell) ? cell : null);
	}

	function handleEnd(e: TouchEvent) {
		const start = startCellRef.current;
		startCellRef.current = null;
		setActive(false);
		setLabels({});
		setFromCell(null);
		setToCell(null);

		if (start === null) return;

		const point = e.changedTouches[0];
		if (!point) return;

		const cell = cellAt(point.clientX, point.clientY);
		if (!cell) return;

		const move = resolveMove(start, cell);
		if (move) {
			e.preventDefault();
			onMove(move);
		}
	}

	function handleCancel() {
		startCellRef.current = null;
		setActive(false);
		setLabels({});
		setFromCell(null);
		setToCell(null);
	}

	return (
		<div
			ref={rootRef}
			className={b({ active, board }).toString()}
			// Label size is a proportion of the cube, not a fixed rem: cstimer sets
			// `font-size: min * 0.15` on the grid (twisty.js:190) so the move names stay
			// readable whether the cube is the small idle one or the large focus one.
			// A fixed size looked fine on one and was unreadable on the other.
			style={{ width: size, height: size, fontSize: Math.round(size * 0.15) }}
		>
			{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((cell) => (
				<div
					key={cell}
					className={b('cell', {
						from: fromCell === cell,
						to: toCell === cell,
					}).toString()}
				>
					{labels[cell] || ''}
				</div>
			))}
		</div>
	);
}
