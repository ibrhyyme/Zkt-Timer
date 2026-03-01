import React, {useMemo} from 'react';

// Zkt-Timer renk paleti (cubingapp: green, red, blue, yellow)
const PYRAMINX_COLORS = ['#009b48', '#b71234', '#0046ad', '#fedd00'];

// cubingapp main.js'den birebir: 9 baz polygon (front face)
// Her biri 240° (left face) ve 120° (right face) rotate edilir → toplam 27 gorunen polygon
const BASE_POLYGONS = [
	'500,577 666,673 334,673',        // tip
	'500,770 334,673 166,770',        // second layer
	'500,770 666,673 334,673',
	'500,770 666,673 834,770',
	'10,860 166,770 334,860',         // first layer
	'500,770 334,860 166,770',
	'500,770 334,860 666,860',
	'500,770 666,860 834,770',
	'990,860 666,860 834,770',
];

const CX = 500;
const CY = 577;

function rotatePoint(x: number, y: number, cx: number, cy: number, angle: number): [number, number] {
	const rad = (angle * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	return [
		cos * (x - cx) + sin * (y - cy) + cx,
		cos * (y - cy) - sin * (x - cx) + cy,
	];
}

function rotatePoints(points: string, cx: number, cy: number, angle: number): string {
	return points
		.split(' ')
		.map((p) => {
			const [x, y] = p.split(',').map(Number);
			const [nx, ny] = rotatePoint(x, y, cx, cy, angle);
			return `${Math.floor(nx)},${Math.floor(ny)}`;
		})
		.join(' ');
}

interface PyraminxPatternViewProps {
	pattern: string;
	size?: number;
}

/**
 * Pyraminx top-down SVG rendering.
 * cubingapp main.js Pyraminx.getSvg()'den birebir port.
 * Pattern: 36 digit string, her digit 0-3 arasi face index.
 * state[0..8] = F face, state[9..17] = L face, state[18..26] = R face, state[27..35] = D face (gorunmez)
 */
export default function PyraminxPatternView({pattern, size}: PyraminxPatternViewProps) {
	const polygons = useMemo(() => {
		if (!pattern || pattern.length < 27) return null;

		const state = pattern.split('').map(Number);
		const result: {points: string; fill: string}[] = [];

		BASE_POLYGONS.forEach((points, i) => {
			// F face (orijinal)
			result.push({points, fill: PYRAMINX_COLORS[state[i]]});
			// L face (240° rotated)
			result.push({points: rotatePoints(points, CX, CY, 240), fill: PYRAMINX_COLORS[state[i + 9]]});
			// R face (120° rotated)
			result.push({points: rotatePoints(points, CX, CY, 120), fill: PYRAMINX_COLORS[state[i + 18]]});
		});

		return result;
	}, [pattern]);

	if (!polygons) return null;

	return (
		<svg
			viewBox="0 0 1000 870"
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
