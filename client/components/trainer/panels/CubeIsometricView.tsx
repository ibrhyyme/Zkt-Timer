import React, { useMemo } from 'react';
import type { CubeFace } from '../types';

/**
 * Isometric 3-yuz kup gorunumu (U + F + R).
 * cubingapp/speedcubedb stilinde 2D izometrik projeksiyon.
 *
 * Pattern formati: 27 char (column-major sirayla)
 *   - 0..8:  U face
 *   - 9..17: F face
 *   - 18..26: R face
 *   - Her char: U/F/D/B/L/R (yuz rengi) veya X (gray)
 *
 * Column-major → (row, col) mapping: index = col * 3 + row
 */

const FACE_COLORS: Record<string, string> = {
	U: '#ffffff',
	D: '#fedd00',
	R: '#b71234',
	L: '#ff5800',
	F: '#009b48',
	B: '#0046ad',
	X: '#444444',
};

const OPPOSITE: Record<CubeFace, CubeFace> = {
	U: 'D', D: 'U', F: 'B', B: 'F', R: 'L', L: 'R',
};

function getRightFace(top: CubeFace, front: CubeFace): CubeFace {
	const V: Record<CubeFace, [number, number, number]> = {
		U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1],
	};
	const u = V[top], f = V[front];
	const c: [number, number, number] = [
		u[1] * f[2] - u[2] * f[1],
		u[2] * f[0] - u[0] * f[2],
		u[0] * f[1] - u[1] * f[0],
	];
	for (const [face, v] of Object.entries(V) as [CubeFace, [number, number, number]][]) {
		if (c[0] === v[0] && c[1] === v[1] && c[2] === v[2]) return face;
	}
	return 'R';
}

function computeMapping(top: CubeFace, front: CubeFace): Record<CubeFace, CubeFace> {
	const right = getRightFace(top, front);
	return {
		U: top,
		D: OPPOSITE[top],
		F: front,
		B: OPPOSITE[front],
		R: right,
		L: OPPOSITE[right],
	};
}

type Pt = [number, number];

/** Polygon'u merkezine dogru shrink_factor kadar kucultur */
function shrinkPolygon(pts: Pt[], factor: number): Pt[] {
	const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
	const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
	return pts.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor] as Pt);
}

function ptsToString(pts: Pt[]): string {
	return pts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
}

interface CubeIsometricViewProps {
	pattern: string;
	topFace?: CubeFace;
	frontFace?: CubeFace;
	size?: number;
}

export default function CubeIsometricView({ pattern, topFace = 'U', frontFace = 'F', size }: CubeIsometricViewProps) {
	const polygons = useMemo(() => {
		if (!pattern || pattern.length < 27) return null;

		const mapping = computeMapping(topFace, frontFace);
		const getColor = (face: string): string => {
			if (face === 'X') return FACE_COLORS.X;
			return FACE_COLORS[mapping[face as CubeFace]] || FACE_COLORS[face] || FACE_COLORS.X;
		};

		const N = 3;
		const cellDx = 20;
		const cellDy = 11.5;
		const cellH = 20;
		const shrink = 0.88; // gap icin kuculme orani

		const result: React.ReactElement[] = [];

		// ── U face (ust parallelogram — elmas seklinde) ──
		// rightStep = (cellDx, cellDy), leftStep = (-cellDx, cellDy)
		for (let row = 0; row < N; row++) {
			for (let col = 0; col < N; col++) {
				const cmIdx = col * N + row;
				const color = getColor(pattern[cmIdx]);

				// Hucre kose noktalari (saat yonunde: top, right, bottom, left)
				const tl: Pt = [(N + col - row) * cellDx, (col + row) * cellDy];
				const tr: Pt = [(N + col + 1 - row) * cellDx, (col + 1 + row) * cellDy];
				const br: Pt = [(N + col - row) * cellDx, (col + row + 2) * cellDy];
				const bl: Pt = [(N + col - 1 - row) * cellDx, (col + row + 1) * cellDy];

				const pts = shrinkPolygon([tl, tr, br, bl], shrink);
				result.push(
					<polygon key={`u${cmIdx}`} points={ptsToString(pts)} fill={color}
						stroke="#222" strokeWidth={0.8} strokeLinejoin="round" />
				);
			}
		}

		// ── F face (on-sol parallelogram) ──
		// Origin: Left = (0, N*cellDy)
		// rightStep = (cellDx, cellDy), downStep = (0, cellH)
		for (let row = 0; row < N; row++) {
			for (let col = 0; col < N; col++) {
				const cmIdx = col * N + row;
				const color = getColor(pattern[9 + cmIdx]);

				const ox = col * cellDx;
				const oy = N * cellDy + col * cellDy + row * cellH;

				const tl: Pt = [ox, oy];
				const tr: Pt = [ox + cellDx, oy + cellDy];
				const br: Pt = [ox + cellDx, oy + cellDy + cellH];
				const bl: Pt = [ox, oy + cellH];

				const pts = shrinkPolygon([tl, tr, br, bl], shrink);
				result.push(
					<polygon key={`f${cmIdx}`} points={ptsToString(pts)} fill={color}
						stroke="#222" strokeWidth={0.8} strokeLinejoin="round" />
				);
			}
		}

		// ── R face (on-sag parallelogram) ──
		// Origin: Center = (N*cellDx, 2*N*cellDy)
		// rightStep = (cellDx, -cellDy), downStep = (0, cellH)
		for (let row = 0; row < N; row++) {
			for (let col = 0; col < N; col++) {
				const cmIdx = col * N + row;
				const color = getColor(pattern[18 + cmIdx]);

				const ox = N * cellDx + col * cellDx;
				const oy = 2 * N * cellDy - col * cellDy + row * cellH;

				const tl: Pt = [ox, oy];
				const tr: Pt = [ox + cellDx, oy - cellDy];
				const br: Pt = [ox + cellDx, oy - cellDy + cellH];
				const bl: Pt = [ox, oy + cellH];

				const pts = shrinkPolygon([tl, tr, br, bl], shrink);
				result.push(
					<polygon key={`r${cmIdx}`} points={ptsToString(pts)} fill={color}
						stroke="#222" strokeWidth={0.8} strokeLinejoin="round" />
				);
			}
		}

		return result;
	}, [pattern, topFace, frontFace]);

	if (!polygons) return null;

	// ViewBox: 2*N*cellDx x (2*N*cellDy + N*cellH)
	const vw = 122; // 120 + 2 margin
	const vh = 131; // 129 + 2 margin

	return (
		<svg
			viewBox={`-1 -1 ${vw} ${vh}`}
			width={size || '100%'}
			height={size || '100%'}
			style={{ display: 'block' }}
		>
			{polygons}
		</svg>
	);
}
