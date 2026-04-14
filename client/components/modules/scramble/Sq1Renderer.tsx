/**
 * Square-1 custom 2D canvas renderer.
 * cstimer image_sq1 + scramble_sq1_new.js portu.
 *
 * State: SquareOneState class — 24 slice (12 ust + 12 alt), her biri 4-bit piece id
 * Render: HTML Canvas 2D, iki daire yanyana + orta katman
 */

import React, { useEffect, useRef } from 'react';

// ==================== SquareOneState (cstimer sq1.SqCubie portu) ====================

class SquareOneState {
	ul: number; // Top-left 6 slice (24 bit = 6 x 4 bit piece id)
	ur: number; // Top-right 6 slice
	dl: number; // Bottom-left 6 slice
	dr: number; // Bottom-right 6 slice
	ml: number; // Middle layer flipped (0 veya 1)

	constructor() {
		// Solved state piece siralamasi:
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
	const cleaned = scramble.replace(/`/g, ''); // backtick temizle (generator bazen ekliyor)
	const moves = cleaned.split('/');
	for (let i = 0; i < moves.length; i++) {
		const mv = moves[i];
		if (/^\s*$/.test(mv)) {
			// Bos move, ama slash var → sadece slash uygula (son iterasyon haric)
			if (i < moves.length - 1) sc.doMove(0);
			continue;
		}
		const m = MOVE_RE.exec(mv);
		if (!m) continue;
		const top = ((~~Number(m[1])) + 12) % 12;
		const bot = ((~~Number(m[2])) + 12) % 12;
		if (top !== 0) sc.doMove(top);
		if (bot !== 0) sc.doMove(-bot);
		if (i < moves.length - 1) sc.doMove(0); // son degilse slash uygula
	}
}

// ==================== Geometri sabitleri ====================

const HSQ3 = Math.sqrt(3) / 2;
const SQA = HSQ3 + 1;
const SQB = SQA * Math.SQRT2;

// Edge polygon (uc nokta - trapez)
const EP: number[][] = [
	[0, -0.5, 0.5],
	[0, -SQA, -SQA],
];
// Corner polygon (4 nokta)
const CP: number[][] = [
	[0, -0.5, -SQA, -SQA],
	[0, -SQA, -SQA, -0.5],
];
// Corner sag yarisi
const CPR: number[][] = [
	[0, -0.5, -SQA],
	[0, -SQA, -SQA],
];
// Corner sol yarisi
const CPL: number[][] = [
	[0, -SQA, -SQA],
	[0, -SQA, -0.5],
];

// Ust-yuz renk indikatoru (0.66 scale inner)
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

// ==================== Renk tablolari (cstimer image.js'den) ====================

const COLORS: Record<string, string> = {
	U: '#ffff00',
	R: '#ff8000',
	F: '#00c000',
	D: '#ffffff',
	L: '#ff0000',
	B: '#0000ff',
};

const UDCOL = 'UD';
// Edge renkleri (piece 0, 2, 4, 6 ve 8, 10, 12, 14 icin yan renk)
const ECOL = 'R-B-L-F-F-L-B-R-';
// Corner renkleri (piece 1, 3, 5, 7 ve 9, 11, 13, 15 icin 2 renk: sol + sag)
const CCOL = 'RBBLLFFRRFFLLBBR';

// ==================== Draw tum state ====================

function drawState(
	ctx: CanvasRenderingContext2D,
	sc: SquareOneState,
	width: number
): void {
	// Tum slice'lar (ust 12 + alt 12)
	for (let i = 0; i < 24; i++) {
		const trans: [number, number, number] = i < 12
			? [width, SQB, SQB]
			: [width, SQB * 3, SQB];
		const val = sc.pieceAt(i);
		const colorUD = COLORS[UDCOL[val >= 8 ? 1 : 0]];
		const cRot = -(i < 12 ? (i - 1) : (i - 6)) * Math.PI / 6;
		const eRot = -(i < 12 ? i : (i - 5)) * Math.PI / 6;

		if (val % 2 === 1) {
			// Corner — 2 slice kaplar
			drawPoly(ctx, COLORS[CCOL[val - 1]], rotatePoly(CPR, cRot), trans);
			drawPoly(ctx, COLORS[CCOL[val]], rotatePoly(CPL, cRot), trans);
			drawPoly(ctx, colorUD, rotatePoly(CPS, cRot), trans);
			i++; // corner 2 slice kaplar, sonraki slice'i atla
		} else {
			// Edge — 1 slice
			drawPoly(ctx, COLORS[ECOL[val]], rotatePoly(EP, eRot), trans);
			drawPoly(ctx, colorUD, rotatePoly(EPS, eRot), trans);
		}
	}

	// Orta katman (L/R renk barlari)
	for (let i = 0; i < 2; i++) {
		const trans: [number, number, number] = i === 0
			? [width, SQB, SQB + SQA]
			: [width, SQB * 3, SQB - SQA - 0.7];
		// Sol yarim (hep L)
		drawPoly(ctx, COLORS['L'], [[-SQA, -SQA, -0.5, -0.5], [0, 0.7, 0.7, 0]], trans);
		// Sag yarim — ml=0 ise L (duz), ml=1 ise R (caprazlanmis)
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
}

const Sq1Renderer: React.FC<Props> = ({ scramble, className }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Canvas boyutu — cstimer 4*sqb*width x 2*sqb*width
		const baseWidth = 28; // scale factor (web boyutu icin optimize)
		const w = 4 * SQB * baseWidth;
		const h = 2 * SQB * baseWidth + baseWidth; // +extra for middle bar

		// Retina/HiDPI
		const dpr = window.devicePixelRatio || 1;
		canvas.width = w * dpr;
		canvas.height = h * dpr;
		canvas.style.width = `${w}px`;
		canvas.style.height = `${h}px`;
		ctx.scale(dpr, dpr);

		// Temizle
		ctx.clearRect(0, 0, w, h);

		// State olustur, scramble uygula
		const sc = new SquareOneState();
		try {
			parseAndApply(scramble || '', sc);
		} catch {
			// Parse hatasi — solved state cizilecek
		}

		drawState(ctx, sc, baseWidth);
	}, [scramble]);

	return (
		<canvas
			ref={canvasRef}
			className={className}
			style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }}
		/>
	);
};

export default Sq1Renderer;
