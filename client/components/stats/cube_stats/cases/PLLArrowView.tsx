import React from 'react';
import { PLL_DATA } from './pll_arrow_data';

/**
 * PLL preview SVG renderer:
 *   - Top 3x3 face: hep solved sari (PLL convention)
 *   - 4 yan strip: pre-PLL scramble state'in sticker renkleri (permutasyon
 *     bilgisini tasir)
 *   - Top face uzerinde 3-cycle ok'lari (parca dolasim yonunu gosterir)
 *
 * cstimer'in pllImgParam veri formatindan SVG cizimi — kod orijinal.
 */

const FACE_COLOR: Record<string, string> = {
	U: '#FFFF49',  // top — sari (PLL solved)
	D: '#FFFF49',
	F: '#43FF43',  // front — yesil
	R: '#FF4343',  // right — kirmizi
	B: '#246BFD',  // back — mavi
	L: '#FF8A06',  // left — turuncu
	X: '#3a3a3a',
};

const ARROW_COLOR = '#111111';

interface Props {
	pllKey: string;
	size?: number;
}

// Layout (SVG units)
const S = 1;       // top face sticker
const W = 0.5;     // strip thickness
const G = 0.04;    // gap
const STROKE = 0.04;
const PAD = 0.15;  // outer padding
const TOTAL = 3 * S + 2 * W + 2 * PAD;

// Top face origin (top-left of 3x3 grid)
const TX = PAD + W;
const TY = PAD + W;

function topSticker(idx: number) {
	const col = idx % 3;
	const row = Math.floor(idx / 3);
	return {
		x: TX + col * S,
		y: TY + row * S,
	};
}

// Yan strip trapezoid kose noktalari — cstimer perspektif efektine uygun.
// Outer edge (uzak kenar) 0.9x merkeze dogru daraltilir.
//
// Strip = idx / 3 (0=front/alt, 1=right/sag, 2=back/ust, 3=left/sol).
// pos = idx % 3 (strip ici sol→sag, rotation flip'i halleder).
function sideStickerPoints(idx: number): string {
	const cx = TX + 1.5 * S;
	const cy = TY + 1.5 * S;
	const strip = Math.floor(idx / 3);
	const pos = idx % 3;

	// Canonical "bottom strip" frame (cube center at origin):
	//   inner edge at y = +1.5 (cube edge), outer at y = +1.5 + W
	//   inner x: pos - 1.5 to pos - 0.5
	//   outer x: scaled 0.9x toward center axis
	const gap = G / 2;
	const innerY = 1.5;
	const outerY = 1.5 + W;
	const innerL = pos - 1.5 + gap;
	const innerR = pos - 0.5 - gap;
	const outerL = (pos - 1.5) * 0.9 + gap * 0.9;
	const outerR = (pos - 0.5) * 0.9 - gap * 0.9;

	const localPts: Array<[number, number]> = [
		[innerL, innerY],
		[innerR, innerY],
		[outerR, outerY],
		[outerL, outerY],
	];

	// cstimer convention: -strip * PI/2 rotation (bottom→right→top→left)
	const rotRad = -strip * Math.PI / 2;
	const cosR = Math.cos(rotRad);
	const sinR = Math.sin(rotRad);

	return localPts
		.map(([x, y]) => {
			const rx = x * cosR - y * sinR;
			const ry = x * sinR + y * cosR;
			return `${(cx + rx).toFixed(3)},${(cy + ry).toFixed(3)}`;
		})
		.join(' ');
}

function arrowPath(fromIdx: number, toIdx: number): string {
	const f = topSticker(fromIdx);
	const t = topSticker(toIdx);
	const cx1 = f.x + S / 2;
	const cy1 = f.y + S / 2;
	const cx2 = t.x + S / 2;
	const cy2 = t.y + S / 2;
	const dx = cx2 - cx1;
	const dy = cy2 - cy1;
	const length = Math.sqrt(dx * dx + dy * dy);
	if (length < 0.01) return '';
	const angle = Math.atan2(dy, dx);

	// cstimer arrow geometry (image.js:670-673):
	//   shaft x: 0.2 .. length-0.4, thickness 0.10 (y: ±0.05)
	//   head:   length-0.4 .. length-0.1, width 0.30 (y: ±0.15)
	const startX = 0.2;
	const tipX = length - 0.1;
	const headLen = 0.3;
	const shaftEnd = tipX - headLen;
	const shaftThick = 0.10;
	const headWidth = 0.30;

	if (shaftEnd <= startX) return '';

	const pts: Array<[number, number]> = [
		[startX, -shaftThick / 2],
		[shaftEnd, -shaftThick / 2],
		[shaftEnd, -headWidth / 2],
		[tipX, 0],
		[shaftEnd, headWidth / 2],
		[shaftEnd, shaftThick / 2],
		[startX, shaftThick / 2],
	];

	const cos = Math.cos(angle);
	const sin = Math.sin(angle);

	return pts
		.map((p, i) => {
			const px = cx1 + p[0] * cos - p[1] * sin;
			const py = cy1 + p[0] * sin + p[1] * cos;
			return `${i === 0 ? 'M' : 'L'}${px.toFixed(3)} ${py.toFixed(3)}`;
		})
		.join(' ') + ' Z';
}

export default function PLLArrowView({ pllKey, size }: Props) {
	const data = PLL_DATA[pllKey];
	if (!data) return null;

	const stickers = data.stickers;

	// Top face stickers (solved sari)
	const topRects = [];
	for (let i = 0; i < 9; i++) {
		const p = topSticker(i);
		topRects.push(
			<rect
				key={`t${i}`}
				x={p.x + G / 2}
				y={p.y + G / 2}
				width={S - G}
				height={S - G}
				fill={FACE_COLOR.U}
				stroke="#222"
				strokeWidth={STROKE}
				rx={0.06}
			/>
		);
	}

	// Side strip stickers — trapezoid (cstimer perspektif efekti)
	const sideRects = [];
	for (let i = 0; i < 12; i++) {
		const points = sideStickerPoints(i);
		const ch = stickers[i] || 'X';
		sideRects.push(
			<polygon
				key={`s${i}`}
				points={points}
				fill={FACE_COLOR[ch] || FACE_COLOR.X}
				stroke="#222"
				strokeWidth={STROKE}
			/>
		);
	}

	// Arrows — every cycle pair drawn both ways for clarity
	const arrowPaths: string[] = [];
	for (const [a, b] of data.arrows) {
		arrowPaths.push(arrowPath(a, b));
		arrowPaths.push(arrowPath(b, a));
	}

	return (
		<svg
			viewBox={`0 0 ${TOTAL} ${TOTAL}`}
			width={size || '100%'}
			height={size || '100%'}
			style={{ display: 'block' }}
		>
			{topRects}
			{sideRects}
			{arrowPaths.filter(Boolean).map((d, i) => (
				<path key={`a${i}`} d={d} fill={ARROW_COLOR} />
			))}
		</svg>
	);
}
