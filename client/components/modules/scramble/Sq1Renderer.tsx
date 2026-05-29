/**
 * Square-1 custom 2D canvas renderer.
 * Port of cstimer image_sq1 + scramble_sq1_new.js.
 *
 * State: SquareOneState class — 24 slices (12 top + 12 bottom), each with 4-bit piece id
 * Render: HTML Canvas 2D, two circles side-by-side + middle layer
 */

import React, { useEffect, useRef } from 'react';

// ==================== SquareOneState (cstimer sq1.SqCubie port) ====================

class SquareOneState {
	ul: number; // Top-left 6 slice (24 bit = 6 x 4 bit piece id)
	ur: number; // Top-right 6 slice
	dl: number; // Bottom-left 6 slice
	dr: number; // Bottom-right 6 slice
	ml: number; // Middle layer flipped (0 or 1)

	constructor() {
		// Solved state piece sequence:
		// 0 UB, 1 UBL, 2 UL, 3 UFL, 4 UF, 5 UFR, 6 UR, 7 UBR
		// 8 DF, 9 DFR, a DR, b DBR, c DB, d DBL, e DL, f DFL
		this.ul = 0x011233;
		this.ur = 0x455677;
		this.dl = 0x998bba;
		this.dr = 0xddcffe;
		this.ml = 0;
	}

	pieceAt(idx: number): number {
		let ret: number;
		if (idx < 6) {
			ret = this.ul >> ((5 - idx) << 2);
		} else if (idx < 12) {
			ret = this.ur >> ((11 - idx) << 2);
		} else if (idx < 18) {
			ret = this.dl >> ((17 - idx) << 2);
		} else {
			ret = this.dr >> ((23 - idx) << 2);
		}
		return ret & 0xf;
	}

	doMove(move: number): void {
		let temp: number;
		move <<= 2;
		if (move > 24) {
			move = 48 - move;
			temp = this.ul;
			this.ul = ((this.ul >>> move) | (this.ur << (24 - move))) & 0xffffff;
			this.ur = ((this.ur >>> move) | (temp << (24 - move))) & 0xffffff;
		} else if (move > 0) {
			temp = this.ul;
			this.ul = ((this.ul << move) | (this.ur >>> (24 - move))) & 0xffffff;
			this.ur = ((this.ur << move) | (temp >>> (24 - move))) & 0xffffff;
		} else if (move === 0) {
			temp = this.ur;
			this.ur = this.dl;
			this.dl = temp;
			this.ml = 1 - this.ml;
		} else if (move >= -24) {
			move = -move;
			temp = this.dl;
			this.dl = ((this.dl << move) | (this.dr >>> (24 - move))) & 0xffffff;
			this.dr = ((this.dr << move) | (temp >>> (24 - move))) & 0xffffff;
		} else {
			move = 48 + move;
			temp = this.dl;
			this.dl = ((this.dl >>> move) | (this.dr << (24 - move))) & 0xffffff;
			this.dr = ((this.dr >>> move) | (temp << (24 - move))) & 0xffffff;
		}
	}
}

// ==================== Scramble parser ====================

const MOVE_RE = /^\s*\(\s*(-?\d+),\s*(-?\d+)\s*\)\s*$/;

function parseAndApply(scramble: string, sc: SquareOneState): void {
	const cleaned = scramble.replace(/`/g, ''); // Clean backticks (generator adds them sometimes)
	const moves = cleaned.split('/');
	for (let i = 0; i < moves.length; i++) {
		const mv = moves[i];
		if (/^\s*$/.test(mv)) {
			// Empty move, but slash present — apply only slash (except last iteration)
			if (i < moves.length - 1) sc.doMove(0);
			continue;
		}
		const m = MOVE_RE.exec(mv);
		if (!m) continue;
		const top = ((~~Number(m[1])) + 12) % 12;
		const bot = ((~~Number(m[2])) + 12) % 12;
		if (top !== 0) sc.doMove(top);
		if (bot !== 0) sc.doMove(-bot);
		if (i < moves.length - 1) sc.doMove(0); // Apply slash if not last
	}
}

// ==================== Geometry constants ====================

const HSQ3 = Math.sqrt(3) / 2;
const SQA = HSQ3 + 1;
const SQB = SQA * Math.SQRT2;

// Edge polygon (three points - trapezoid)
const EP: number[][] = [
	[0, -0.5, 0.5],
	[0, -SQA, -SQA],
];
// Corner polygon (4 points)
const CP: number[][] = [
	[0, -0.5, -SQA, -SQA],
	[0, -SQA, -SQA, -0.5],
];
// Corner right half
const CPR: number[][] = [
	[0, -0.5, -SQA],
	[0, -SQA, -SQA],
];
// Corner left half
const CPL: number[][] = [
	[0, -SQA, -SQA],
	[0, -SQA, -0.5],
];

// Top-face color indicator (0.66 scale inner)
const EPS = scalePoly(EP, 0.66);
const CPS = scalePoly(CP, 0.66);
const CPRS = scalePoly(CPR, 0.66);
const CPLS = scalePoly(CPL, 0.66);

function scalePoly(poly: number[][], scale: number): number[][] {
	return [poly[0].map(x => x * scale), poly[1].map(y => y * scale)];
}

function rotatePoly(poly: number[][], angle: number): number[][] {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	const xs = poly[0], ys = poly[1];
	const rx: number[] = new Array(xs.length);
	const ry: number[] = new Array(ys.length);
	for (let i = 0; i < xs.length; i++) {
		rx[i] = xs[i] * c - ys[i] * s;
		ry[i] = xs[i] * s + ys[i] * c;
	}
	return [rx, ry];
}

function drawPoly(
	ctx: CanvasRenderingContext2D,
	color: string,
	poly: number[][],
	trans: [number, number, number] // [scale, offsetX, offsetY]
): void {
	const [scale, ox, oy] = trans;
	ctx.beginPath();
	ctx.moveTo(poly[0][0] * scale + ox * scale, poly[1][0] * scale + oy * scale);
	for (let i = 1; i < poly[0].length; i++) {
		ctx.lineTo(poly[0][i] * scale + ox * scale, poly[1][i] * scale + oy * scale);
	}
	ctx.closePath();
	ctx.fillStyle = color;
	ctx.fill();
	ctx.strokeStyle = '#000';
	ctx.lineWidth = 0.03 * scale;
	ctx.stroke();
}

// ==================== Color tables (from cstimer image.js) ====================

const COLORS: Record<string, string> = {
	U: '#ffff00',
	R: '#ff8000',
	F: '#00c000',
	D: '#ffffff',
	L: '#ff0000',
	B: '#0000ff',
};

const UDCOL = 'UD';
// Edge colors (pieces 0, 2, 4, 6 and 8, 10, 12, 14 side color)
const ECOL = 'R-B-L-F-F-L-B-R-';
// Corner colors (pieces 1, 3, 5, 7 and 9, 11, 13, 15 two colors: left + right)
const CCOL = 'RBBLLFFRRFFLLBBR';

// ==================== Draw entire state ====================

function drawState(
	ctx: CanvasRenderingContext2D,
	sc: SquareOneState,
	width: number
): void {
	// All slices (top 12 + bottom 12)
	for (let i = 0; i < 24; i++) {
		const trans: [number, number, number] = i < 12
			? [width, SQB, SQB]
			: [width, SQB * 3, SQB];
		const val = sc.pieceAt(i);
		const colorUD = COLORS[UDCOL[val >= 8 ? 1 : 0]];
		const cRot = -(i < 12 ? (i - 1) : (i - 6)) * Math.PI / 6;
		const eRot = -(i < 12 ? i : (i - 5)) * Math.PI / 6;

		if (val % 2 === 1) {
			// Corner — covers 2 slices
			drawPoly(ctx, COLORS[CCOL[val - 1]], rotatePoly(CPR, cRot), trans);
			drawPoly(ctx, COLORS[CCOL[val]], rotatePoly(CPL, cRot), trans);
			drawPoly(ctx, colorUD, rotatePoly(CPS, cRot), trans);
			i++; // corner covers 2 slices, skip next
		} else {
			// Edge — 1 slice
			drawPoly(ctx, COLORS[ECOL[val]], rotatePoly(EP, eRot), trans);
			drawPoly(ctx, colorUD, rotatePoly(EPS, eRot), trans);
		}
	}

	// Middle layer (L/R color bars)
	for (let i = 0; i < 2; i++) {
		const trans: [number, number, number] = i === 0
			? [width, SQB, SQB + SQA]
			: [width, SQB * 3, SQB - SQA - 0.7];
		// Left half (always L)
		drawPoly(ctx, COLORS['L'], [[-SQA, -SQA, -0.5, -0.5], [0, 0.7, 0.7, 0]], trans);
		// Right half — if ml=0 then L (straight), if ml=1 then R (crossed)
		if (sc.ml === 0) {
			drawPoly(ctx, COLORS['L'], [[SQA, SQA, -0.5, -0.5], [0, 0.7, 0.7, 0]], trans);
		} else {
			drawPoly(ctx, COLORS['R'], [[HSQ3, HSQ3, -0.5, -0.5], [0, 0.7, 0.7, 0]], trans);
		}
	}
}

// ==================== React component ====================

interface Props {
	scramble: string;
	className?: string;
	baseWidth?: number;
}

const Sq1Renderer: React.FC<Props> = ({ scramble, className, baseWidth: baseWidthProp }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Canvas size — cstimer 4*sqb*width x 2*sqb*width
		const baseWidth = baseWidthProp ?? 28; // scale factor (optimized for web size)
		const w = 4 * SQB * baseWidth;
		const h = 2 * SQB * baseWidth + baseWidth; // +extra for middle bar

		// Retina/HiDPI
		const dpr = window.devicePixelRatio || 1;
		canvas.width = w * dpr;
		canvas.height = h * dpr;
		// Preserve aspect ratio when fitting to container (1.74:1 aspect)
		canvas.style.maxWidth = `${w}px`;
		canvas.style.width = '100%';
		canvas.style.height = 'auto';
		canvas.style.aspectRatio = `${w} / ${h}`;
		ctx.scale(dpr, dpr);

		// Clear
		ctx.clearRect(0, 0, w, h);

		// Create state and apply scramble
		const sc = new SquareOneState();
		try {
			parseAndApply(scramble || '', sc);
		} catch {
			// Parse error — solved state will be drawn
		}

		drawState(ctx, sc, baseWidth);
	}, [scramble, baseWidthProp]);

	return (
		<canvas
			ref={canvasRef}
			className={className}
			style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }}
		/>
	);
};

export default Sq1Renderer;
