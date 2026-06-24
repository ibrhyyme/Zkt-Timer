/**
 * Face-Turning Octahedron (FTO) / Diamond custom 2D net renderer.
 * Port of cstimer tools/image.js `polyhedronImage` (octahedron path) onto Canvas 2D.
 *
 * cubing.js TwistyPlayer does not support FTO, so the 2D net is drawn directly from the
 * poly3dlib geometry: getFamousPuzzle → makePuzzle → renderNet → apply moves → fill facelets.
 *
 * `renderType` selects the puzzle geometry: 'fto' (pyramid hold) or 'dmd' (Diamond hold).
 */

import React, { useEffect, useRef } from 'react';
import {
	getFamousPuzzle, makePuzzle, makePuzzleParser, renderNet, PolyhedronPuzzle
} from '../../../../shared/scramble/lib/poly3dlib';

// FTO face names (octahedron). faceNameMask 0xff in cstimer → all labelled.
const FACE_NAME_MASK = 0xff;

// Cache built puzzles (makePuzzle is geometry-heavy) per render type.
const puzzleCache: Record<string, PolyhedronPuzzle> = {};

interface RenderData {
	sizes: number[];
	polys: any[];
	faces: any[];
	posit: number[];
	colors: string[];
}

function buildRenderData(renderType: 'fto' | 'dmd', scramble: string): RenderData | null {
	const params = getFamousPuzzle(renderType);
	if (!params) {
		return null;
	}
	let puzzle = puzzleCache[renderType];
	if (!puzzle) {
		puzzle = makePuzzle.apply(null, params.polyParam as any);
		puzzleCache[renderType] = puzzle;
	}
	const parser = params.parser || makePuzzleParser(puzzle);
	const moves = parser.parseScramble(scramble || '');
	const gap = params.pieceGap;

	const poly2d = renderNet(puzzle, gap, 0);
	const sizes = poly2d[0];
	const polys = poly2d[1];
	const faces = poly2d[2];

	let posit: number[] = [];
	for (let i = 0; i < polys.length; i++) {
		posit[i] = polys[i] && polys[i][2];
	}
	for (let midx = 0; midx < moves.length; midx++) {
		const move = moves[midx];
		const moveIdx = puzzle.getTwistyIdx(move[0]);
		if (moveIdx == -1) {
			continue; // unknown move — skip (defensive)
		}
		const perm = puzzle.moveTable[moveIdx];
		const maxPow = puzzle.twistyDetails[moveIdx][1];
		const pow = (move[1] % maxPow + maxPow) % maxPow;
		const posit2: number[] = [];
		for (let i = 0; i < posit.length; i++) {
			let val = i;
			for (let j = 0; j < pow; j++) {
				val = perm[val] < 0 ? val : perm[val];
			}
			posit2[i] = posit[val];
		}
		posit = posit2;
	}

	const colors = params.colors.map((c) => '#' + c.toString(16).padStart(6, '0'));

	return { sizes, polys, faces, posit, colors };
}

function drawPolygon(
	ctx: CanvasRenderingContext2D,
	color: string,
	poly: any,
	scale: number
): void {
	const xs = poly[0], ys = poly[1];
	if (!xs || xs.length === 0) {
		return;
	}
	ctx.beginPath();
	ctx.moveTo(xs[0] * scale, ys[0] * scale);
	for (let i = 1; i < xs.length; i++) {
		ctx.lineTo(xs[i] * scale, ys[i] * scale);
	}
	ctx.closePath();
	ctx.fillStyle = color;
	ctx.fill();
	ctx.strokeStyle = '#000';
	ctx.lineWidth = Math.max(0.5, 0.012 * scale);
	ctx.lineJoin = 'round';
	ctx.stroke();
}

interface Props {
	scramble: string;
	renderType?: 'fto' | 'dmd';
	className?: string;
}

const FtoRenderer: React.FC<Props> = ({ scramble, renderType = 'fto', className }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) {
			return;
		}
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			return;
		}

		let data: RenderData | null = null;
		try {
			data = buildRenderData(renderType, scramble);
		} catch {
			data = null;
		}
		if (!data) {
			return;
		}

		const { sizes, polys, faces, posit, colors } = data;
		// cstimer: scale = min(1.6/sizes[0], 1.0/sizes[1]) * 300
		const scale = Math.min(1.6 / sizes[0], 1.0 / sizes[1]) * 300;
		const w = sizes[0] * scale;
		const h = sizes[1] * scale;

		const dpr = window.devicePixelRatio || 1;
		canvas.width = w * dpr;
		canvas.height = h * dpr;
		canvas.style.maxWidth = `${w}px`;
		canvas.style.width = '100%';
		canvas.style.height = 'auto';
		canvas.style.aspectRatio = `${w} / ${h}`;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);

		for (let i = 0; i < posit.length; i++) {
			if (polys[i]) {
				drawPolygon(ctx, colors[posit[i]], polys[i], scale);
			}
		}

		// Face name labels
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = '16px Arial';
		for (let i = 0; i < faces.length; i++) {
			if ((FACE_NAME_MASK >> i & 1) == 0 || !faces[i]) {
				continue;
			}
			const face = faces[i];
			const x = face[0] * scale;
			const y = face[1] * scale;
			ctx.lineWidth = 3;
			ctx.strokeStyle = 'rgba(0,0,0,0.55)';
			ctx.strokeText(String(face[2]).toUpperCase(), x, y);
			ctx.fillStyle = '#fff';
			ctx.fillText(String(face[2]).toUpperCase(), x, y);
		}
	}, [scramble, renderType]);

	return (
		<canvas
			ref={canvasRef}
			className={className}
			style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }}
		/>
	);
};

export default FtoRenderer;
