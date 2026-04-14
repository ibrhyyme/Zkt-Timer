/**
 * Clock custom 2D canvas renderer.
 * cstimer image.js clkImage portu.
 *
 * State: 18 dial (9 on + 9 arka yuz) + 8 pin (her yuzde 4)
 * Scramble parse: WCA notation ("UR4+ DR2- ... y2 U4+ ... UR DL")
 * Render: HTML Canvas 2D, iki 3x3 dial gridi yanyana + pinler arasi
 */

import React, { useEffect, useRef } from 'react';
import { moveArr } from '../../../util/cubes/scramble_clock';

// ==================== Scramble parser + simulator ====================

const MOVE_RE = /([UD][RL]|ALL|[UDRLy]|all)(?:(\d[+-]?)|\((\d[+-]?),(\d[+-]?)\))?/;
const MOVE_STR = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'];

interface ClockState {
	clks: number[]; // 18 dial positions (on 0-8, arka 9-17), her biri 0-11
	buttons: number[]; // 8 pin durumu
}

function simulateScramble(scramble: string): ClockState {
	let flip = 9; // flip=9 ust-yuz baslar; y2 ile 0 olur
	const buttons = [0, 0, 0, 0];
	const clks = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 14 bagimsiz dial

	const tokens = scramble.trim().split(/\s+/).filter(Boolean);

	for (const tok of tokens) {
		const m = MOVE_RE.exec(tok);
		if (!m) continue;
		if (m[0] === 'y2') {
			flip = 9 - flip;
			continue;
		}
		let axis = MOVE_STR.indexOf(m[1]) + flip;
		if (m[2] === undefined && m[3] === undefined) {
			// Pin toggle
			if (axis % 9 < 4) buttons[axis % 9] = 1;
			continue;
		}
		const actions: number[] = [];
		if (m[1] === 'all') {
			const power = ~~m[2][0] * (m[2][1] === '+' ? -1 : 1) + 12;
			actions.push(8 + 9 - flip, power);
		} else if (m[2]) {
			const power = ~~m[2][0] * (m[2][1] === '+' ? 1 : -1) + 12;
			actions.push(axis, power);
		} else {
			let power = ~~m[3][0] * (m[3][1] === '+' ? 1 : -1) + 12;
			actions.push(axis, power);
			power = ~~m[4][0] * (m[4][1] === '+' ? -1 : 1) + 12;
			axis = (10 - axis % 9) % 4 + 4 + 9 - flip;
			actions.push(axis, power);
		}

		for (let k = 0; k < actions.length; k += 2) {
			for (let j = 0; j < 14; j++) {
				clks[j] = (clks[j] + moveArr[actions[k]][j] * actions[k + 1]) % 12;
			}
		}
	}

	// 14-dial state → 18-dial state (cstimer format)
	const fullClks = [
		clks[0], clks[3], clks[6], clks[1], clks[4], clks[7], clks[2], clks[5], clks[8],
		(12 - clks[2]) % 12, clks[10], (12 - clks[8]) % 12,
		clks[9], clks[11], clks[13],
		(12 - clks[0]) % 12, clks[12], (12 - clks[6]) % 12,
	];

	const fullButtons = [
		buttons[3], buttons[2], buttons[0], buttons[1],
		1 - buttons[0], 1 - buttons[1], 1 - buttons[3], 1 - buttons[2],
	];

	return { clks: fullClks, buttons: fullButtons };
}

// ==================== Geometri & cizim ====================

const CLOCK_POLY_X = [1, 1, 0, -1, -1, -1, 1, 0];
const CLOCK_POLY_Y = [0, -1, -8, -1, 0, 1, 1, 0];

// Renk paleti (cstimer default)
const COLORS = {
	frame: '#f00',       // dial stroke (kirmizi cerceve)
	faceFront: '#37b',   // on yuz dial arka plani
	faceBack: '#5cf',    // arka yuz dial arka plani
	hand: '#ff0',        // ibre rengi (sari)
	pinUp: '#850',       // pin up (koyu sari)
};

function rotatePoly(xs: number[], ys: number[], angle: number): [number[], number[]] {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	const rx: number[] = new Array(xs.length);
	const ry: number[] = new Array(ys.length);
	for (let i = 0; i < xs.length; i++) {
		rx[i] = xs[i] * c - ys[i] * s;
		ry[i] = xs[i] * s + ys[i] * c;
	}
	return [rx, ry];
}

function drawClock(
	ctx: CanvasRenderingContext2D,
	faceColor: string,
	scale: number,
	cx: number,
	cy: number,
	time: number
): void {
	// Arka plan daire
	ctx.beginPath();
	ctx.arc(cx, cy, 9 * scale, 0, Math.PI * 2);
	ctx.fillStyle = faceColor;
	ctx.fill();
	ctx.strokeStyle = '#000';
	ctx.lineWidth = 0.2 * scale;
	ctx.stroke();

	// Ibre — 8 nokta, time/6 * PI radyan rotate
	const angle = (time / 6) * Math.PI;
	const [rx, ry] = rotatePoly(CLOCK_POLY_X, CLOCK_POLY_Y, angle);

	// Transform (scale + translate)
	const px = rx.map(x => x * scale + cx);
	const py = ry.map(y => y * scale + cy);

	ctx.beginPath();
	ctx.moveTo(px[0], py[0]);
	// Q x[1],y[1] → x[2],y[2] (quadratic curve)
	ctx.quadraticCurveTo(px[1], py[1], px[2], py[2]);
	// Q x[3],y[3] → x[4],y[4]
	ctx.quadraticCurveTo(px[3], py[3], px[4], py[4]);
	// C x[5],y[5],x[6],y[6] → x[0],y[0] (cubic curve)
	ctx.bezierCurveTo(px[5], py[5], px[6], py[6], px[0], py[0]);
	ctx.closePath();
	ctx.fillStyle = COLORS.hand;
	ctx.fill();
	ctx.strokeStyle = COLORS.frame;
	ctx.lineWidth = 0.2 * scale;
	ctx.stroke();
}

function drawButton(
	ctx: CanvasRenderingContext2D,
	color: string,
	scale: number,
	cx: number,
	cy: number
): void {
	ctx.beginPath();
	ctx.arc(cx, cy, 3 * scale, 0, Math.PI * 2);
	ctx.fillStyle = color;
	ctx.fill();
	ctx.strokeStyle = '#000';
	ctx.lineWidth = 0.3 * scale;
	ctx.stroke();
}

function drawClockState(
	ctx: CanvasRenderingContext2D,
	state: ClockState,
	scale: number
): void {
	// 18 dial — on yuz (0-8): x=[10,30,50], y=[10,30,50], arka yuz (9-17): x=[75,95,115]
	const dialY = [10, 30, 50];
	const dialX = [10, 30, 50, 75, 95, 115];

	for (let ii = 0; ii < 18; ii++) {
		const i = ii; // cstimer flip offset uyguluyor; biz state'te zaten uyguladik
		const isBack = ii >= 9;
		const faceColor = isBack ? COLORS.faceBack : COLORS.faceFront;
		const cx = dialX[~~(i / 3)] * scale;
		const cy = dialY[i % 3] * scale;
		drawClock(ctx, faceColor, scale, cx, cy, state.clks[ii]);
	}

	// 8 pin — her yuzde 4 (2x2 grid, dial'lar arasinda)
	const pinY = [20, 40];
	const pinX = [20, 40, 85, 105];
	for (let i = 0; i < 8; i++) {
		const color = state.buttons[i] === 1 ? COLORS.hand : COLORS.pinUp;
		const cx = pinX[~~(i / 2)] * scale;
		const cy = pinY[i % 2] * scale;
		drawButton(ctx, color, scale, cx, cy);
	}
}

// ==================== React component ====================

interface Props {
	scramble: string;
	className?: string;
}

const ClockRenderer: React.FC<Props> = ({ scramble, className }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Canvas boyutu — 6.25 * 20 = 125 unit wide, 3 * 20 = 60 unit high
		const scale = 3; // cstimer width=3
		const w = 125 * scale;
		const h = 60 * scale;

		const dpr = window.devicePixelRatio || 1;
		canvas.width = w * dpr;
		canvas.height = h * dpr;
		canvas.style.width = `${w}px`;
		canvas.style.height = `${h}px`;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, w, h);

		let state: ClockState;
		try {
			state = simulateScramble(scramble || '');
		} catch {
			state = { clks: new Array(18).fill(0), buttons: new Array(8).fill(0) };
		}

		drawClockState(ctx, state, scale);
	}, [scramble]);

	return (
		<canvas
			ref={canvasRef}
			className={className}
			style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }}
		/>
	);
};

export default ClockRenderer;
