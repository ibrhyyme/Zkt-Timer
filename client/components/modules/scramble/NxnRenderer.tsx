/**
 * NxN scramble preview drawn as a flat net on a 2D canvas.
 *
 * cubing.js draws the 2D view too, but it does not expose sticker colours: its SVG reads
 * each facelet's fill once, builds a gradient from it and repaints through that, so the
 * only way in is to rewrite generated gradients in its shadow DOM — a hack tied to the
 * library's internals, on a view that already has a simulator behind it here. Drawing the
 * net ourselves costs less and makes the user's palette the single input, the same way the
 * Square-1, Clock and FTO previews already work.
 *
 * The cube simulator is `util/cubes/cube_state.ts`, shared with the scramble PDF export, so
 * the printed sheet and the on-screen preview cannot drift apart.
 */

import React, { useEffect, useRef } from 'react';
import { applyScramble, FACE_NAMES } from '../../../util/cubes/cube_state';
import { useCubePalette } from '../../../util/cube_colors/useCubePalette';
import { NXN_FACES } from '../../../util/cube_colors/palette';

interface Props {
	/** Cube dimension: 2 through 7. */
	size: number;
	scramble: string;
	className?: string;
}

/** Gap between faces, in facelet widths. */
const FACE_GAP = 0.32;
/** Facelet size in CSS pixels at 3x3. Larger cubes keep the net's overall width instead. */
const BASE_FACELET = 22;

/**
 * Net layout, in face-widths from the top-left of the drawing:
 *
 *        U
 *    L   F   R   B
 *        D
 */
const NET_POSITIONS: Record<string, [number, number]> = {
	U: [1, 0],
	L: [0, 1],
	F: [1, 1],
	R: [2, 1],
	B: [3, 1],
	D: [1, 2],
};

const NxnRenderer: React.FC<Props> = ({ size, scramble, className }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const palette = useCubePalette();

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Hold the net's width steady as the cube grows, so a 7x7 preview occupies the same
		// strip as a 3x3 rather than pushing the scramble text off screen.
		const facelet = (BASE_FACELET * 3) / size;
		const faceSpan = size + FACE_GAP;
		const w = (4 * size + 3 * FACE_GAP) * facelet;
		const h = (3 * size + 2 * FACE_GAP) * facelet;

		const dpr = window.devicePixelRatio || 1;
		canvas.width = w * dpr;
		canvas.height = h * dpr;
		canvas.style.maxWidth = `${w}px`;
		canvas.style.width = '100%';
		canvas.style.height = 'auto';
		canvas.style.aspectRatio = `${w} / ${h}`;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);

		let state;
		try {
			state = applyScramble(size, scramble || '');
		} catch {
			// A scramble we cannot parse still deserves a picture: the solved cube is a
			// truthful answer to "what does this state look like" when there is no state.
			state = applyScramble(size, '');
		}

		ctx.lineWidth = Math.max(0.6, facelet * 0.06);
		ctx.lineJoin = 'round';
		ctx.strokeStyle = palette.outline;

		FACE_NAMES.forEach((face, faceIdx) => {
			const [col, row] = NET_POSITIONS[face];
			const originX = col * faceSpan * facelet;
			const originY = row * faceSpan * facelet;
			const stickers = state.faces[faceIdx];

			for (let r = 0; r < size; r++) {
				for (let c = 0; c < size; c++) {
					const letter = stickers[r * size + c];
					const colorIdx = NXN_FACES.indexOf(letter as typeof NXN_FACES[number]);
					ctx.fillStyle = colorIdx >= 0 ? palette.nxn[colorIdx] : palette.nxn[0];
					const x = originX + c * facelet;
					const y = originY + r * facelet;
					ctx.fillRect(x, y, facelet, facelet);
					ctx.strokeRect(x, y, facelet, facelet);
				}
			}
		});
	}, [size, scramble, palette]);

	return (
		<canvas
			ref={canvasRef}
			className={className}
			style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }}
		/>
	);
};

export default NxnRenderer;
