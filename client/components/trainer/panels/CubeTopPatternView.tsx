import React, {useMemo} from 'react';
import type {CubeFace} from '../types';

const FACE_COLORS: Record<string, string> = {
	U: '#ffffff',
	D: '#fedd00',
	R: '#b71234',
	L: '#ff5800',
	F: '#009b48',
	B: '#0046ad',
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

interface CubeTopPatternViewProps {
	pattern: string;
	layers: 2 | 4;
	topFace?: CubeFace;
	size?: number;
}

/**
 * 2x2 ve 4x4 icin 2D top-view SVG rendering.
 * Pattern format:
 *   2x2 (12 char): [4 top][2 front][2 right][2 back][2 left]
 *   4x4 (32 char): [16 top][4 front][4 right][4 back][4 left]
 */
export default function CubeTopPatternView({pattern, layers, topFace = 'U', size}: CubeTopPatternViewProps) {
	const colors = useMemo(() => {
		const expectedLen = layers === 2 ? 12 : 32;
		if (!pattern || pattern.length < expectedLen) return null;

		// Sadece topFace mapping — frontFace gerekmez (full stickering, side strip'ler zaten dogru renkte)
		const mapping = computeMapping(topFace, 'F');
		const getColor = (face: string): string =>
			FACE_COLORS[mapping[face as CubeFace]] || FACE_COLORS[face] || '#444444';

		return pattern.split('').map((ch) => getColor(ch));
	}, [pattern, topFace, layers]);

	if (!colors) return null;

	const N = layers;
	const topCount = N * N;

	const S = layers === 2 ? 24 : 14; // sticker size
	const G = 2;  // gap
	const W = layers === 2 ? 8 : 5; // side strip thickness
	const off = W + G;

	const rects: JSX.Element[] = [];

	// Top face NxN grid
	for (let row = 0; row < N; row++) {
		for (let col = 0; col < N; col++) {
			const idx = row * N + col;
			rects.push(
				<rect
					key={`t${idx}`}
					x={off + col * (S + G)}
					y={off + row * (S + G)}
					width={S}
					height={S}
					fill={colors[idx]}
					stroke="#333"
					strokeWidth={0.8}
					rx={layers === 2 ? 2 : 1}
				/>
			);
		}
	}

	// Front strip (below top face)
	for (let i = 0; i < N; i++) {
		rects.push(
			<rect
				key={`f${i}`}
				x={off + i * (S + G)}
				y={off + N * (S + G)}
				width={S}
				height={W}
				fill={colors[topCount + i]}
				stroke="#333"
				strokeWidth={0.8}
				rx={1}
			/>
		);
	}

	// Right strip (right of top face)
	for (let i = 0; i < N; i++) {
		rects.push(
			<rect
				key={`r${i}`}
				x={off + N * (S + G)}
				y={off + i * (S + G)}
				width={W}
				height={S}
				fill={colors[topCount + N + i]}
				stroke="#333"
				strokeWidth={0.8}
				rx={1}
			/>
		);
	}

	// Back strip (above top face)
	for (let i = 0; i < N; i++) {
		rects.push(
			<rect
				key={`b${i}`}
				x={off + i * (S + G)}
				y={0}
				width={S}
				height={W}
				fill={colors[topCount + 2 * N + i]}
				stroke="#333"
				strokeWidth={0.8}
				rx={1}
			/>
		);
	}

	// Left strip (left of top face)
	for (let i = 0; i < N; i++) {
		rects.push(
			<rect
				key={`l${i}`}
				x={0}
				y={off + i * (S + G)}
				width={W}
				height={S}
				fill={colors[topCount + 3 * N + i]}
				stroke="#333"
				strokeWidth={0.8}
				rx={1}
			/>
		);
	}

	const total = off + N * (S + G) + W;

	return (
		<svg
			viewBox={`0 0 ${total} ${total}`}
			width={size || '100%'}
			height={size || '100%'}
			style={{display: 'block'}}
		>
			{rects}
		</svg>
	);
}
