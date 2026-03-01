import React, { useMemo } from 'react';
import type { CubeFace } from '../types';

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

type StickeringMode = 'OLL' | 'OLLCP' | 'PLL' | 'COLL' | 'CMLL' | 'full';

function getStickeringMode(stickering: string): StickeringMode {
	const s = stickering.toLowerCase();
	if (s === 'oll') return 'OLL';
	if (s === 'ollcp' || s.includes('ollcp')) return 'OLLCP';
	if (s === 'pll' || s === 'zbll') return 'PLL';
	if (s === 'cmll') return 'CMLL';
	if (s === 'coll') return 'COLL';
	return 'full';
}

interface LLPatternViewProps {
	pattern: string;
	topFace: CubeFace;
	frontFace: CubeFace;
	stickering: string;
	size?: number;
}

export default function LLPatternView({ pattern, topFace, frontFace, stickering, size }: LLPatternViewProps) {
	const colors = useMemo(() => {
		if (!pattern || pattern.length < 21) return null;

		const mapping = computeMapping(topFace, frontFace);
		const getColor = (face: string): string =>
			FACE_COLORS[mapping[face as CubeFace]] || FACE_COLORS[face] || FACE_COLORS.X;

		const mode = getStickeringMode(stickering);
		const result: string[] = [];

		// Top 9 stickers (indices 0-8)
		// Grid: 0=TL corner, 1=T edge, 2=TR corner, 3=L edge, 4=center, 5=R edge, 6=BL corner, 7=B edge, 8=BR corner
		for (let i = 0; i < 9; i++) {
			if (mode === 'OLL') {
				// OLL: sadece oryantasyon (U = ust renk, diger = gri)
				result.push(pattern[i] === 'U' ? getColor('U') : FACE_COLORS.X);
			} else if (mode === 'OLLCP') {
				// OLLCP: koseler gercek renk (permutasyon), kenarlar OLL oryantasyon
				const isCorner = i % 2 === 0 && i !== 4;
				if (isCorner) {
					result.push(pattern[i] === 'U' ? getColor('U') : getColor(pattern[i]));
				} else {
					result.push(pattern[i] === 'U' ? getColor('U') : FACE_COLORS.X);
				}
			} else if (mode === 'CMLL') {
				// CMLL: koseler + merkez renkli, kenarlar gri
				const isEdge = i % 2 === 1;
				result.push(isEdge ? FACE_COLORS.X : (pattern[i] === 'U' ? getColor('U') : getColor(pattern[i])));
			} else {
				// COLL, PLL, full: tam renkler
				result.push(pattern[i] === 'U' ? getColor('U') : getColor(pattern[i]));
			}
		}

		// Side stickers (indices 9-20)
		// front: 9,10,11 — right: 12,13,14 — back: 15,16,17 — left: 18,19,20
		// Her strip'te: pos 0 = kose, pos 1 = kenar, pos 2 = kose
		for (let i = 9; i < 21; i++) {
			if (mode === 'OLL') {
				// OLL: U rengi varsa goster, yoksa gri
				result.push(pattern[i] === 'U' ? getColor('U') : FACE_COLORS.X);
			} else if (mode === 'COLL' || mode === 'CMLL') {
				// COLL ve CMLL: koseler renkli, kenarlar gri
				const posInStrip = (i - 9) % 3;
				result.push(posInStrip === 1 ? FACE_COLORS.X : getColor(pattern[i]));
			} else if (mode === 'OLLCP') {
				// OLLCP: koseler renkli (permutasyon), kenarlar U/gri (oryantasyon)
				const posInStrip = (i - 9) % 3;
				if (posInStrip === 1) {
					result.push(pattern[i] === 'U' ? getColor('U') : FACE_COLORS.X);
				} else {
					result.push(getColor(pattern[i]));
				}
			} else {
				// PLL, full: tum renkler
				result.push(getColor(pattern[i]));
			}
		}

		return result;
	}, [pattern, topFace, frontFace, stickering]);

	if (!colors) return null;

	// Layout constants
	const S = 24;  // top face sticker size
	const G = 2;   // gap between stickers
	const W = 8;   // side strip thickness
	const off = W + G; // offset for top face grid start

	const rects: JSX.Element[] = [];

	// Top face 3×3 grid
	for (let row = 0; row < 3; row++) {
		for (let col = 0; col < 3; col++) {
			const idx = row * 3 + col;
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
					rx={2}
				/>
			);
		}
	}

	// Front strip (below top face)
	for (let i = 0; i < 3; i++) {
		rects.push(
			<rect
				key={`f${i}`}
				x={off + i * (S + G)}
				y={off + 3 * (S + G)}
				width={S}
				height={W}
				fill={colors[9 + i]}
				stroke="#333"
				strokeWidth={0.8}
				rx={1}
			/>
		);
	}

	// Right strip (right of top face)
	for (let i = 0; i < 3; i++) {
		rects.push(
			<rect
				key={`r${i}`}
				x={off + 3 * (S + G)}
				y={off + i * (S + G)}
				width={W}
				height={S}
				fill={colors[12 + i]}
				stroke="#333"
				strokeWidth={0.8}
				rx={1}
			/>
		);
	}

	// Back strip (above top face)
	for (let i = 0; i < 3; i++) {
		rects.push(
			<rect
				key={`b${i}`}
				x={off + i * (S + G)}
				y={0}
				width={S}
				height={W}
				fill={colors[15 + i]}
				stroke="#333"
				strokeWidth={0.8}
				rx={1}
			/>
		);
	}

	// Left strip (left of top face)
	for (let i = 0; i < 3; i++) {
		rects.push(
			<rect
				key={`l${i}`}
				x={0}
				y={off + i * (S + G)}
				width={W}
				height={S}
				fill={colors[18 + i]}
				stroke="#333"
				strokeWidth={0.8}
				rx={1}
			/>
		);
	}

	const total = off + 3 * (S + G) + W; // 10 + 78 + 8 = 96

	return (
		<svg
			viewBox={`0 0 ${total} ${total}`}
			width={size || '100%'}
			height={size || '100%'}
			style={{ display: 'block' }}
		>
			{rects}
		</svg>
	);
}
