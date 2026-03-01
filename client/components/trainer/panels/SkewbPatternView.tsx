import React, {useMemo} from 'react';
import type {CubeFace} from '../types';

// Standart renk paleti (face index sirali: U, F, R, B, L, D, gray)
const FACE_COLORS: Record<string, string> = {
	U: '#ffffff',
	F: '#009b48',
	R: '#b71234',
	B: '#0046ad',
	L: '#ff5800',
	D: '#fedd00',
};
const GRAY = '#444444';

const OPPOSITE: Record<CubeFace, CubeFace> = {
	U: 'D', D: 'U', F: 'B', B: 'F', R: 'L', L: 'R',
};

// Pattern'deki face index → standart face harfi
const INDEX_TO_FACE: CubeFace[] = ['U', 'F', 'R', 'B', 'L', 'D'];

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

function computeMapping(top: CubeFace): Record<CubeFace, CubeFace> {
	// Skewb icin front face sabit 'F' kabul — sadece topFace degisir
	// Default front face secimi: top=U->F, top=D->B, top=F->D, top=B->U, top=R->F, top=L->F
	const DEFAULT_FRONT: Record<CubeFace, CubeFace> = {
		U: 'F', D: 'B', F: 'D', B: 'U', R: 'F', L: 'F',
	};
	const front = DEFAULT_FRONT[top];
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

// cubingapp main.js Skewb.getSvg()'den birebir polygon koordinatlari
const SKEWB_POLYGONS: {points: string}[] = [
	{points: '500,250 750,500 500,750 250,500'},    // U center
	{points: '250,250 500,250 250,500'},             // UBL
	{points: '750,250 500,250 750,500'},             // URB
	{points: '750,500 500,750 750,750'},             // UFR
	{points: '250,500 500,750 250,750'},             // ULF
	{points: '250,750 500,750 250,995'},             // FUL
	{points: '500,750 750,995 250,995'},             // F center
	{points: '750,750 500,750 750,995'},             // FRU
	{points: '750,750 750,500 990,750'},             // RUF
	{points: '990,750 990,250 750,500'},             // R center
	{points: '750,250 750,500 990,250'},             // RBU
	{points: '250,250 500,250 250,10'},              // BLU
	{points: '500,250 250,10 750,10'},               // B center
	{points: '750,250 500,250 750,10'},              // BUR
	{points: '250,750 250,500 10,750'},              // LFU
	{points: '10,750 10,250 250,500'},               // L center
	{points: '250,250 250,500 10,250'},              // LUB
];

interface SkewbPatternViewProps {
	pattern: string;
	topFace?: CubeFace;
	size?: number;
}

/**
 * Skewb 2D diamond layout SVG rendering.
 * Pattern: 17 digit string, her digit 0-5=face index, 6=gray (masked).
 * topFace degistiginde renk mapping'i uygulanir.
 */
export default function SkewbPatternView({pattern, topFace = 'U', size}: SkewbPatternViewProps) {
	const polygons = useMemo(() => {
		if (!pattern || pattern.length < 17) return null;

		const mapping = computeMapping(topFace);

		return SKEWB_POLYGONS.map((poly, i) => {
			const faceIdx = Number(pattern[i]);
			if (faceIdx === 6) {
				return {points: poly.points, fill: GRAY};
			}
			const originalFace = INDEX_TO_FACE[faceIdx];
			const mappedFace = mapping[originalFace];
			return {points: poly.points, fill: FACE_COLORS[mappedFace] || GRAY};
		});
	}, [pattern, topFace]);

	if (!polygons) return null;

	return (
		<svg
			viewBox="0 0 1000 1000"
			width={size || '100%'}
			height={size || '100%'}
			style={{display: 'block'}}
			stroke="#333"
			strokeWidth={8}
			strokeLinejoin="round"
		>
			{polygons.map((p, i) => (
				<polygon key={i} points={p.points} fill={p.fill} />
			))}
		</svg>
	);
}
