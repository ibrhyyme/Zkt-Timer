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

// Yan strip sticker konumlari — PLL_DATA stickers indekslemesine uygun
function sideSticker(idx: number) {
	// 0..2 front (alt strip, sol→sag)
	if (idx < 3) {
		return { x: TX + idx * S, y: TY + 3 * S, w: S, h: W };
	}
	// 3..5 right (sag strip, ust→alt)
	if (idx < 6) {
		return { x: TX + 3 * S, y: TY + (idx - 3) * S, w: W, h: S };
	}
	// 6..8 back (ust strip, sag→sol)
	if (idx < 9) {
		return { x: TX + (2 - (idx - 6)) * S, y: TY - W, w: S, h: W };
	}
	// 9..11 left (sol strip, alt→ust)
	return { x: TX - W, y: TY + (2 - (idx - 9)) * S, w: W, h: S };
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
	// Inset start/end so arrow doesn't touch sticker edges
	const inset = S * 0.18;
	const usableLen = length - 2 * inset;
	if (usableLen <= 0) return '';

	// Arrow shape (origin = base, +x = forward):
	//   shaft: rectangle 0.06 thick, length L*0.7
	//   head: triangle width 0.18, length L*0.3
	const shaftThick = 0.07;
	const headWidth = 0.16;
	const headLen = Math.min(0.22, usableLen * 0.4);
	const shaftLen = usableLen - headLen;

	// Local coords (before rotation)
	const pts: Array<[number, number]> = [
		[0, -shaftThick / 2],
		[shaftLen, -shaftThick / 2],
		[shaftLen, -headWidth / 2],
		[shaftLen + headLen, 0],
		[shaftLen, headWidth / 2],
		[shaftLen, shaftThick / 2],
		[0, shaftThick / 2],
	];

	// Rotate + translate from (cx1, cy1) shifted by inset along angle
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	const ox = cx1 + cos * inset;
	const oy = cy1 + sin * inset;

	return pts
		.map((p, i) => {
			const px = ox + p[0] * cos - p[1] * sin;
			const py = oy + p[0] * sin + p[1] * cos;
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

	// Side strip stickers
	const sideRects = [];
	for (let i = 0; i < 12; i++) {
		const p = sideSticker(i);
		const ch = stickers[i] || 'X';
		sideRects.push(
			<rect
				key={`s${i}`}
				x={p.x + G / 2}
				y={p.y + G / 2}
				width={p.w - G}
				height={p.h - G}
				fill={FACE_COLOR[ch] || FACE_COLOR.X}
				stroke="#222"
				strokeWidth={STROKE}
				rx={0.04}
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
				<path key={`a${i}`} d={d} fill={ARROW_COLOR} stroke="#fff" strokeWidth={0.025} />
			))}
		</svg>
	);
}
