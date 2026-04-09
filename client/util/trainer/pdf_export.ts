/**
 * Trainer PDF Export
 * Generates a professional A4 PDF of selected algorithms with 2D patterns.
 * Uses jsPDF for client-side PDF generation.
 */
import type {CubeFace} from '../../components/trainer/types';
import {getLLPattern, loadLLPatterns} from './ll_patterns';
import {getIsometricPattern, loadIsometricPatterns} from './isometric_patterns';
import {getPuzzlePattern, loadPuzzlePatterns} from './puzzle_patterns';
import {
	isLLCategory,
	isIsometricCategory,
	is2DPatternCategory,
	getPuzzlePatternType,
	getStickering,
	getDefaultFrontFace,
	isSQ1MirrorCategory,
	getPuzzleType,
	getOrientationRotation,
	isCubeShapePuzzle,
} from './algorithm_engine';

// ===================== Color Constants =====================

const FACE_COLORS: Record<string, string> = {
	U: '#ffffff', D: '#fedd00', R: '#b71234', L: '#ff5800', F: '#009b48', B: '#0046ad', X: '#444444',
};

const OPPOSITE: Record<CubeFace, CubeFace> = {
	U: 'D', D: 'U', F: 'B', B: 'F', R: 'L', L: 'R',
};

// ===================== Geometry Helpers =====================

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
	return {U: top, D: OPPOSITE[top], F: front, B: OPPOSITE[front], R: right, L: OPPOSITE[right]};
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

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function rotatePoint(x: number, y: number, cx: number, cy: number, angle: number): [number, number] {
	const rad = (angle * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	return [cos * (x - cx) + sin * (y - cy) + cx, cos * (y - cy) - sin * (x - cx) + cy];
}

function rotatePoints(points: [number, number][], cx: number, cy: number, angle: number): [number, number][] {
	return points.map(([x, y]) => rotatePoint(x, y, cx, cy, angle));
}

function parsePoints(str: string): [number, number][] {
	return str.split(' ').map((p) => {
		const [x, y] = p.split(',').map(Number);
		return [x, y] as [number, number];
	});
}

// ===================== jsPDF Polygon Helper =====================

function fillPolygon(doc: any, pts: [number, number][], fillColor: string, strokeColor = '#333333', lineWidth = 0.15) {
	if (pts.length < 3) return;
	const rgb = hexToRgb(fillColor);
	const srgb = hexToRgb(strokeColor);
	doc.setFillColor(rgb[0], rgb[1], rgb[2]);
	doc.setDrawColor(srgb[0], srgb[1], srgb[2]);
	doc.setLineWidth(lineWidth);

	// jsPDF lines: array of [dx, dy] offsets from first point
	const offsets = [];
	for (let i = 1; i < pts.length; i++) {
		offsets.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
	}
	doc.lines(offsets, pts[0][0], pts[0][1], [1, 1], 'FD', true);
}

// ===================== LL Pattern Colors =====================

function computeLLColors(pattern: string, topFace: CubeFace, frontFace: CubeFace, stickering: string): string[] | null {
	if (!pattern || pattern.length < 21) return null;

	const mapping = computeMapping(topFace, frontFace);
	const getColor = (face: string): string =>
		FACE_COLORS[mapping[face as CubeFace]] || FACE_COLORS[face] || FACE_COLORS.X;

	const mode = getStickeringMode(stickering);
	const result: string[] = [];

	for (let i = 0; i < 9; i++) {
		const isCorner = i % 2 === 0 && i !== 4;
		const isEdge = i % 2 === 1;
		if (mode === 'OLL') {
			result.push(pattern[i] === 'U' ? getColor('U') : FACE_COLORS.X);
		} else if (mode === 'OLLCP') {
			result.push(isCorner ? (pattern[i] === 'U' ? getColor('U') : getColor(pattern[i])) : (pattern[i] === 'U' ? getColor('U') : FACE_COLORS.X));
		} else if (mode === 'CMLL') {
			result.push(isEdge ? FACE_COLORS.X : (pattern[i] === 'U' ? getColor('U') : getColor(pattern[i])));
		} else {
			result.push(pattern[i] === 'U' ? getColor('U') : getColor(pattern[i]));
		}
	}

	for (let i = 9; i < 21; i++) {
		const posInStrip = (i - 9) % 3;
		const isEdgeStrip = posInStrip === 1;
		if (mode === 'OLL') {
			result.push(pattern[i] === 'U' ? getColor('U') : FACE_COLORS.X);
		} else if (mode === 'COLL' || mode === 'CMLL') {
			result.push(isEdgeStrip ? FACE_COLORS.X : getColor(pattern[i]));
		} else if (mode === 'OLLCP') {
			result.push(isEdgeStrip ? (pattern[i] === 'U' ? getColor('U') : FACE_COLORS.X) : getColor(pattern[i]));
		} else {
			result.push(getColor(pattern[i]));
		}
	}

	return result;
}

// ===================== Pattern Draw Functions =====================

/** LL pattern — top face 3x3 + 4 side strips (from LLPatternView.tsx) */
function drawLLPattern(doc: any, colors: string[], x: number, y: number, size: number) {
	const S = size * 0.25;
	const G = size * 0.02;
	const W = size * 0.083;
	const off = W + G;

	const drawRect = (rx: number, ry: number, rw: number, rh: number, color: string) => {
		const rgb = hexToRgb(color);
		doc.setFillColor(rgb[0], rgb[1], rgb[2]);
		doc.setDrawColor(51, 51, 51);
		doc.setLineWidth(0.15);
		doc.roundedRect(rx, ry, rw, rh, 0.4, 0.4, 'FD');
	};

	// Top face 3x3
	for (let row = 0; row < 3; row++) {
		for (let col = 0; col < 3; col++) {
			drawRect(x + off + col * (S + G), y + off + row * (S + G), S, S, colors[row * 3 + col]);
		}
	}
	// Front strip (below)
	for (let i = 0; i < 3; i++) drawRect(x + off + i * (S + G), y + off + 3 * (S + G), S, W, colors[9 + i]);
	// Right strip
	for (let i = 0; i < 3; i++) drawRect(x + off + 3 * (S + G), y + off + i * (S + G), W, S, colors[12 + i]);
	// Back strip (above)
	for (let i = 0; i < 3; i++) drawRect(x + off + i * (S + G), y, S, W, colors[15 + i]);
	// Left strip
	for (let i = 0; i < 3; i++) drawRect(x, y + off + i * (S + G), W, S, colors[18 + i]);
}

/** Isometric 3-face view — U + F + R (from CubeIsometricView.tsx) */
function drawIsometricPattern(doc: any, pattern: string, topFace: CubeFace, frontFace: CubeFace, x: number, y: number, size: number) {
	if (!pattern || pattern.length < 27) return;

	const mapping = computeMapping(topFace, frontFace);
	const getColor = (face: string): string => face === 'X' ? FACE_COLORS.X : (FACE_COLORS[mapping[face as CubeFace]] || FACE_COLORS[face] || FACE_COLORS.X);

	const N = 3;
	const scale = size / 130; // viewBox ~122x131
	const cellDx = 20 * scale;
	const cellDy = 11.5 * scale;
	const cellH = 20 * scale;
	const shrink = 0.88;

	function shrinkPoly(pts: [number, number][]): [number, number][] {
		const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
		const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
		return pts.map(([px, py]) => [cx + (px - cx) * shrink, cy + (py - cy) * shrink] as [number, number]);
	}

	// U face
	for (let row = 0; row < N; row++) {
		for (let col = 0; col < N; col++) {
			const cmIdx = col * N + row;
			const tl: [number, number] = [x + (N + col - row) * cellDx, y + (col + row) * cellDy];
			const tr: [number, number] = [x + (N + col + 1 - row) * cellDx, y + (col + 1 + row) * cellDy];
			const br: [number, number] = [x + (N + col - row) * cellDx, y + (col + row + 2) * cellDy];
			const bl: [number, number] = [x + (N + col - 1 - row) * cellDx, y + (col + row + 1) * cellDy];
			fillPolygon(doc, shrinkPoly([tl, tr, br, bl]), getColor(pattern[cmIdx]));
		}
	}

	// F face
	for (let row = 0; row < N; row++) {
		for (let col = 0; col < N; col++) {
			const cmIdx = col * N + row;
			const ox = x + col * cellDx;
			const oy = y + N * cellDy + col * cellDy + row * cellH;
			const tl: [number, number] = [ox, oy];
			const tr: [number, number] = [ox + cellDx, oy + cellDy];
			const br: [number, number] = [ox + cellDx, oy + cellDy + cellH];
			const bl: [number, number] = [ox, oy + cellH];
			fillPolygon(doc, shrinkPoly([tl, tr, br, bl]), getColor(pattern[9 + cmIdx]));
		}
	}

	// R face
	for (let row = 0; row < N; row++) {
		for (let col = 0; col < N; col++) {
			const cmIdx = col * N + row;
			const ox = x + N * cellDx + col * cellDx;
			const oy = y + 2 * N * cellDy - col * cellDy + row * cellH;
			const tl: [number, number] = [ox, oy];
			const tr: [number, number] = [ox + cellDx, oy - cellDy];
			const br: [number, number] = [ox + cellDx, oy - cellDy + cellH];
			const bl: [number, number] = [ox, oy + cellH];
			fillPolygon(doc, shrinkPoly([tl, tr, br, bl]), getColor(pattern[18 + cmIdx]));
		}
	}
}

/** NxN top-face view — 2x2 or 4x4 (from CubeTopPatternView.tsx) */
function drawCubeTopPattern(doc: any, pattern: string, layers: 2 | 4, topFace: CubeFace, x: number, y: number, size: number) {
	const expectedLen = layers === 2 ? 12 : 32;
	if (!pattern || pattern.length < expectedLen) return;

	const mapping = computeMapping(topFace, 'F');
	const getColor = (face: string): string => FACE_COLORS[mapping[face as CubeFace]] || FACE_COLORS[face] || '#444444';
	const colors = pattern.split('').map((ch) => getColor(ch));

	const N = layers;
	const topCount = N * N;
	const S = layers === 2 ? size * 0.25 : size * 0.146;
	const G = size * 0.02;
	const W = layers === 2 ? size * 0.083 : size * 0.052;
	const off = W + G;

	const drawRect = (rx: number, ry: number, rw: number, rh: number, color: string) => {
		const rgb = hexToRgb(color);
		doc.setFillColor(rgb[0], rgb[1], rgb[2]);
		doc.setDrawColor(51, 51, 51);
		doc.setLineWidth(0.15);
		doc.roundedRect(rx, ry, rw, rh, 0.3, 0.3, 'FD');
	};

	// Top face NxN
	for (let row = 0; row < N; row++) {
		for (let col = 0; col < N; col++) {
			drawRect(x + off + col * (S + G), y + off + row * (S + G), S, S, colors[row * N + col]);
		}
	}
	// Front strip
	for (let i = 0; i < N; i++) drawRect(x + off + i * (S + G), y + off + N * (S + G), S, W, colors[topCount + i]);
	// Right strip
	for (let i = 0; i < N; i++) drawRect(x + off + N * (S + G), y + off + i * (S + G), W, S, colors[topCount + N + i]);
	// Back strip
	for (let i = 0; i < N; i++) drawRect(x + off + i * (S + G), y, S, W, colors[topCount + 2 * N + i]);
	// Left strip
	for (let i = 0; i < N; i++) drawRect(x, y + off + i * (S + G), W, S, colors[topCount + 3 * N + i]);
}

/** Pyraminx triangle (from PyraminxPatternView.tsx) */
function drawPyraminxPattern(doc: any, pattern: string, x: number, y: number, size: number) {
	if (!pattern || pattern.length < 27) return;

	const PYRAMINX_COLORS = ['#009b48', '#b71234', '#0046ad', '#fedd00'];
	const state = pattern.split('').map(Number);

	const BASE_POLYGONS = [
		'500,577 666,673 334,673', '500,770 334,673 166,770', '500,770 666,673 334,673',
		'500,770 666,673 834,770', '10,860 166,770 334,860', '500,770 334,860 166,770',
		'500,770 334,860 666,860', '500,770 666,860 834,770', '990,860 666,860 834,770',
	];

	const CX = 500, CY = 577;
	// viewBox is 0..1000 x ~10..870 — scale to fit into size x size box
	const scaleX = size / 1000;
	const scaleY = size / 870;

	function scaleAndOffset(pts: [number, number][]): [number, number][] {
		return pts.map(([px, py]) => [x + px * scaleX, y + (py - 10) * scaleY] as [number, number]);
	}

	BASE_POLYGONS.forEach((pointsStr, i) => {
		const basePts = parsePoints(pointsStr);
		// F face (original)
		fillPolygon(doc, scaleAndOffset(basePts), PYRAMINX_COLORS[state[i]], '#333333', 0.15);
		// L face (240° rotated)
		const lPts = rotatePoints(basePts, CX, CY, 240);
		fillPolygon(doc, scaleAndOffset(lPts), PYRAMINX_COLORS[state[i + 9]], '#333333', 0.15);
		// R face (120° rotated)
		const rPts = rotatePoints(basePts, CX, CY, 120);
		fillPolygon(doc, scaleAndOffset(rPts), PYRAMINX_COLORS[state[i + 18]], '#333333', 0.15);
	});
}

/** Skewb diamond (from SkewbPatternView.tsx) */
function drawSkewbPattern(doc: any, pattern: string, topFace: CubeFace, x: number, y: number, size: number) {
	if (!pattern || pattern.length < 17) return;

	const INDEX_TO_FACE: CubeFace[] = ['U', 'F', 'R', 'B', 'L', 'D'];
	const GRAY = '#444444';

	const DEFAULT_FRONT: Record<CubeFace, CubeFace> = {
		U: 'F', D: 'B', F: 'D', B: 'U', R: 'F', L: 'F',
	};
	const front = DEFAULT_FRONT[topFace];
	const right = getRightFace(topFace, front);
	const mapping: Record<CubeFace, CubeFace> = {
		U: topFace, D: OPPOSITE[topFace], F: front, B: OPPOSITE[front], R: right, L: OPPOSITE[right],
	};

	const SKEWB_POLYGONS = [
		'500,250 750,500 500,750 250,500', '250,250 500,250 250,500', '750,250 500,250 750,500',
		'750,500 500,750 750,750', '250,500 500,750 250,750', '250,750 500,750 250,995',
		'500,750 750,995 250,995', '750,750 500,750 750,995', '750,750 750,500 990,750',
		'990,750 990,250 750,500', '750,250 750,500 990,250', '250,250 500,250 250,10',
		'500,250 250,10 750,10', '750,250 500,250 750,10', '250,750 250,500 10,750',
		'10,750 10,250 250,500', '250,250 250,500 10,250',
	];

	const scale = size / 1000;

	SKEWB_POLYGONS.forEach((pointsStr, i) => {
		const faceIdx = Number(pattern[i]);
		let color = GRAY;
		if (faceIdx !== 6) {
			const originalFace = INDEX_TO_FACE[faceIdx];
			const mappedFace = mapping[originalFace];
			color = FACE_COLORS[mappedFace] || GRAY;
		}
		const pts = parsePoints(pointsStr).map(([px, py]) => [x + px * scale, y + py * scale] as [number, number]);
		fillPolygon(doc, pts, color, '#333333', 0.2);
	});
}

/** Square-1 dual-octagon (from SQ1PatternView.tsx) */
function drawSQ1Pattern(doc: any, top: number[], bottom: number[], mirror: boolean, x: number, y: number, size: number) {
	const WHITE = '#ffffff', DARK_GRAY = '#444444', BLUE = '#0046ad';
	const ORANGE = '#ff5800', RED = '#b71234', GREEN = '#009b48', YELLOW = '#fedd00';

	const PIECES: string[][] = [
		[DARK_GRAY, BLUE, RED], [DARK_GRAY, BLUE], [DARK_GRAY, ORANGE, BLUE], [DARK_GRAY, ORANGE],
		[DARK_GRAY, GREEN, ORANGE], [DARK_GRAY, GREEN], [DARK_GRAY, RED, GREEN], [DARK_GRAY, RED],
		[WHITE, RED, BLUE], [WHITE, BLUE], [WHITE, BLUE, ORANGE], [WHITE, ORANGE],
		[WHITE, ORANGE, GREEN], [WHITE, GREEN], [WHITE, GREEN, RED], [WHITE, RED],
	];

	const SZ = 100;
	const MID = SZ / 2;
	const PAD = 0.15 * SZ;
	const WIDTH = 0.1 * SZ;
	const INNER = (WIDTH + PAD - MID) / Math.tan((75 * Math.PI) / 180) + MID;
	const OUTER = (PAD - MID) / Math.tan((75 * Math.PI) / 180) + MID;

	const CORNER1 = `${MID},${MID} ${INNER},${SZ - WIDTH - PAD} ${WIDTH + PAD},${SZ - WIDTH - PAD} ${WIDTH + PAD},${SZ - INNER}`;
	const CORNER2 = `${PAD},${SZ - PAD} ${WIDTH + PAD},${SZ - WIDTH - PAD} ${WIDTH + PAD},${SZ - INNER} ${PAD},${SZ - OUTER}`;
	const CORNER3 = `${PAD},${SZ - PAD} ${WIDTH + PAD},${SZ - WIDTH - PAD} ${INNER},${SZ - WIDTH - PAD} ${OUTER},${SZ - PAD}`;
	const EDGE1 = `${MID},${MID} ${SZ - INNER},${SZ - WIDTH - PAD} ${INNER},${SZ - WIDTH - PAD}`;
	const EDGE2 = `${OUTER},${SZ - PAD} ${INNER},${SZ - WIDTH - PAD} ${SZ - INNER},${SZ - WIDTH - PAD} ${SZ - OUTER},${SZ - PAD}`;

	function rotatePtsStr(pointsStr: string, cx: number, cy: number, angle: number): [number, number][] {
		return rotatePoints(parsePoints(pointsStr), cx, cy, angle);
	}

	function buildFace(face: number[], isTop: boolean): {pts: [number, number][]; fill: string}[] {
		let c2 = CORNER2, c3 = CORNER3;
		if (!isTop) [c2, c3] = [c3, c2];

		const polygons: {pts: [number, number][]; fill: string}[] = [];
		let angle = 0;

		for (let i = 0; i < face.length; i++) {
			const piece = PIECES[face[i]];
			if (!piece) continue;
			if (piece.length === 3) {
				polygons.push({pts: rotatePtsStr(CORNER1, MID, MID, angle), fill: piece[0]});
				polygons.push({pts: rotatePtsStr(c2, MID, MID, angle), fill: piece[1]});
				polygons.push({pts: rotatePtsStr(c3, MID, MID, angle), fill: piece[2]});
				angle -= 60;
			} else {
				polygons.push({pts: rotatePtsStr(EDGE1, MID, MID, angle - 30), fill: piece[0]});
				polygons.push({pts: rotatePtsStr(EDGE2, MID, MID, angle - 30), fill: piece[1]});
				angle -= 30;
			}
		}
		return polygons;
	}

	const faceSize = size / 2.2;
	const scale = faceSize / SZ;
	const gap = 2;

	// Top face
	const topPolygons = buildFace(top, true);
	for (const p of topPolygons) {
		const pts = p.pts.map(([px, py]) => [x + px * scale, y + py * scale] as [number, number]);
		fillPolygon(doc, pts, p.fill, '#333333', 0.1);
	}

	// Bottom face
	const bottomPolygons = buildFace(bottom, false);
	const bx = x + faceSize + gap;
	for (const p of bottomPolygons) {
		const pts = p.pts.map(([px, py]) => {
			const fy = mirror ? (SZ - py) : py;
			return [bx + px * scale, y + fy * scale] as [number, number];
		});
		fillPolygon(doc, pts, p.fill, '#333333', 0.1);
	}
}

// ===================== 3D TwistyPlayer Screenshot =====================

/** Flatten transparent PNG onto background color, output as JPEG */
function makeOpaque(dataURL: string, w: number, h: number): Promise<string> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = w;
			canvas.height = h;
			const ctx = canvas.getContext('2d')!;
			ctx.fillStyle = '#f8f9fa';
			ctx.fillRect(0, 0, w, h);
			ctx.drawImage(img, 0, 0, w, h);
			resolve(canvas.toDataURL('image/jpeg', 0.95));
		};
		img.onerror = () => resolve(dataURL);
		img.src = dataURL;
	});
}

/** Batch capture 3D screenshots for algorithms that lack 2D patterns */
async function batchCapture3DScreenshots(
	algorithms: {algorithm: string; index: number}[],
	category: string,
	topFace: CubeFace,
	frontFace: CubeFace,
): Promise<Map<number, string>> {
	if (algorithms.length === 0) return new Map();

	const results = new Map<number, string>();

	try {
		const [{TwistyPlayer}, stickeringMod] = await Promise.all([
			import('cubing/twisty'),
			import('./stickering_remap'),
		]);

		const puzzleType = getPuzzleType(category);
		const stickering = getStickering(category);
		const is3x3 = puzzleType === '3x3x3';
		const rotation = isCubeShapePuzzle(category) ? getOrientationRotation(topFace, frontFace) : '';
		const baseStickering = is3x3 ? stickering : 'full';

		// Pre-compute custom mask once
		let customMask: any = null;
		if (baseStickering !== 'full' && rotation) {
			customMask = await stickeringMod.getRemappedMask(baseStickering, rotation);
		}

		// Offscreen container (reusable)
		const container = document.createElement('div');
		container.style.cssText = 'position:fixed;left:-9999px;width:200px;height:200px;opacity:0;pointer-events:none';
		document.body.appendChild(container);

		// Process in batches of 5
		const BATCH_SIZE = 5;
		for (let i = 0; i < algorithms.length; i += BATCH_SIZE) {
			const batch = algorithms.slice(i, i + BATCH_SIZE);

			const promises = batch.map(async ({algorithm, index}) => {
				try {
					const player = new TwistyPlayer({
						puzzle: puzzleType as any,
						visualization: '3D',
						alg: algorithm,
						experimentalSetupAnchor: 'end',
						controlPanel: 'none',
						hintFacelets: 'none',
						experimentalDragInput: 'none',
						background: 'white',
						...(rotation ? {experimentalSetupAlg: rotation} : {}),
						...(baseStickering !== 'full' ? {experimentalStickering: baseStickering as any} : {}),
					});

					if (customMask) {
						(player as any).experimentalStickeringMaskOrbits = customMask;
					}

					container.appendChild(player);
					await new Promise((r) => setTimeout(r, 300));

					const rawDataURL: string = await (player as any).experimentalScreenshot({width: 300, height: 300});
					container.removeChild(player);

					if (rawDataURL) {
						// Remove alpha channel: draw onto opaque white canvas
						const opaqueURL = await makeOpaque(rawDataURL, 300, 300);
						results.set(index, opaqueURL);
					}
				} catch { /* skip failed screenshot */ }
			});

			await Promise.all(promises);
		}

		document.body.removeChild(container);
	} catch { /* cubing import failed */ }

	return results;
}

// ===================== Pattern Dispatcher =====================

function drawPattern(
	doc: any,
	category: string,
	algorithm: string,
	topFace: CubeFace,
	frontFace: CubeFace,
	stickering: string,
	x: number,
	y: number,
	size: number,
	screenshotMap?: Map<number, string>,
	algIndex?: number,
): boolean {
	const isIso = isIsometricCategory(category);
	const isLL = isLLCategory(category);
	const is2D = is2DPatternCategory(category);
	const puzzlePatternType = getPuzzlePatternType(category);

	// 1. Isometric (WVLS, VHLS)
	if (isIso) {
		const pattern = getIsometricPattern(algorithm);
		if (pattern) {
			drawIsometricPattern(doc, pattern, topFace, frontFace, x, y, size);
			return true;
		}
	}

	// 2. LL categories (OLL, PLL, COLL, ZBLL, etc.)
	if (isLL) {
		const pattern = getLLPattern(algorithm);
		if (pattern) {
			const colors = computeLLColors(pattern, topFace, frontFace, stickering);
			if (colors) {
				drawLLPattern(doc, colors, x, y, size);
				return true;
			}
		}
	}

	// 3. Puzzle patterns (2x2, 4x4, pyraminx, skewb, sq1)
	if (is2D && puzzlePatternType) {
		const puzzlePattern = getPuzzlePattern(puzzlePatternType, algorithm, category);
		if (puzzlePattern) {
			if ((puzzlePatternType === '2x2' || puzzlePatternType === '4x4') && typeof puzzlePattern === 'string') {
				drawCubeTopPattern(doc, puzzlePattern, puzzlePatternType === '2x2' ? 2 : 4, topFace, x, y, size);
				return true;
			}
			if (puzzlePatternType === 'pyraminx' && typeof puzzlePattern === 'string') {
				drawPyraminxPattern(doc, puzzlePattern, x, y, size);
				return true;
			}
			if (puzzlePatternType === 'skewb' && typeof puzzlePattern === 'string') {
				drawSkewbPattern(doc, puzzlePattern, topFace, x, y, size);
				return true;
			}
			if (puzzlePatternType === 'sq1' && typeof puzzlePattern === 'object') {
				drawSQ1Pattern(
					doc,
					(puzzlePattern as any).t,
					(puzzlePattern as any).b,
					isSQ1MirrorCategory(category),
					x, y, size,
				);
				return true;
			}
		}
	}

	// 4. Fallback: pre-captured 3D screenshot
	if (screenshotMap && algIndex !== undefined) {
		const dataURL = screenshotMap.get(algIndex);
		if (dataURL) {
			doc.addImage(dataURL, 'JPEG', x, y, size, size);
			return true;
		}
	}

	return false;
}

// ===================== Asset Loaders =====================

async function loadAsBase64(url: string): Promise<string | null> {
	try {
		const response = await fetch(url);
		const blob = await response.blob();
		return new Promise((resolve) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.onerror = () => resolve(null);
			reader.readAsDataURL(blob);
		});
	} catch {
		return null;
	}
}

async function loadFontAsArrayBuffer(url: string): Promise<ArrayBuffer | null> {
	try {
		const response = await fetch(url);
		return await response.arrayBuffer();
	} catch {
		return null;
	}
}

// ===================== Main Export Function =====================

export interface PdfExportParams {
	category: string;
	categoryDescription?: string;
	algorithms: {name: string; algorithm: string; subset: string; alternatives?: string[]}[];
	topFace: CubeFace;
	frontFace: CubeFace;
}

export async function generateTrainerPdf({category, categoryDescription, algorithms, topFace, frontFace}: PdfExportParams): Promise<void> {
	// Load jsPDF, logo, fonts, and pattern JSON in parallel
	const [
		{jsPDF},
		logoBase64,
		robotoRegularBuf,
		robotoBoldBuf,
	] = await Promise.all([
		import('jspdf'),
		loadAsBase64('/public/images/zkt-logo-dark.png'),
		loadFontAsArrayBuffer('/public/fonts/Roboto-Regular.ttf'),
		loadFontAsArrayBuffer('/public/fonts/Roboto-Bold.ttf'),
		loadLLPatterns(),
		loadPuzzlePatterns(),
		loadIsometricPatterns(),
	]);

	const isLL = isLLCategory(category);
	const isIso = isIsometricCategory(category);
	const effectiveFrontFace = (isLL || isIso) ? getDefaultFrontFace(topFace) : frontFace;
	const stickering = getStickering(category);

	const doc = new jsPDF({orientation: 'portrait', unit: 'mm', format: 'a4'});
	const pageW = 210;
	const pageH = 297;
	const margin = 15;
	const contentW = pageW - margin * 2;
	const brandR = 59, brandG = 130, brandB = 246;

	// Register Roboto font (supports Turkish characters)
	const hasRoboto = robotoRegularBuf && robotoBoldBuf;
	if (hasRoboto) {
		const toBase64 = (buf: ArrayBuffer): string => {
			const bytes = new Uint8Array(buf);
			let binary = '';
			for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
			return btoa(binary);
		};
		doc.addFileToVFS('Roboto-Regular.ttf', toBase64(robotoRegularBuf));
		doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
		doc.addFileToVFS('Roboto-Bold.ttf', toBase64(robotoBoldBuf));
		doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
	}

	const fontFamily = hasRoboto ? 'Roboto' : 'helvetica';

	// ---- First page: cover section ----
	let curY = margin;

	// Logo (centered, on dark rounded rectangle background)
	if (logoBase64) {
		const logoSize = 26;
		const bgPad = 3;
		const bgSize = logoSize + bgPad * 2;
		const logoX = (pageW - bgSize) / 2;
		doc.setFillColor(23, 25, 34); // #171922 — logo background color
		doc.roundedRect(logoX, curY, bgSize, bgSize, 5, 5, 'F');
		doc.addImage(logoBase64, 'PNG', logoX + bgPad, curY + bgPad, logoSize, logoSize);
		curY += bgSize + 8;
	}

	// Category title (centered, large)
	doc.setFont(fontFamily, 'bold');
	doc.setFontSize(24);
	doc.setTextColor(30, 30, 30);
	doc.text(category, pageW / 2, curY, {align: 'center'});
	curY += 9;

	// Algorithm count subtitle
	doc.setFont(fontFamily, 'normal');
	doc.setFontSize(10);
	doc.setTextColor(120, 120, 120);
	doc.text(`${algorithms.length}`, pageW / 2, curY, {align: 'center'});
	curY += 8;

	// Category description (full, black text)
	if (categoryDescription) {
		doc.setFont(fontFamily, 'normal');
		doc.setFontSize(8);
		doc.setTextColor(40, 40, 40);
		const descLines: string[] = doc.splitTextToSize(categoryDescription, contentW);
		for (let i = 0; i < descLines.length; i++) {
			doc.text(descLines[i], margin, curY);
			curY += 3.2;
		}
		curY += 3;
	}

	// Separator line
	doc.setDrawColor(200, 200, 200);
	doc.setLineWidth(0.3);
	doc.line(margin, curY, pageW - margin, curY);
	curY += 5;

	const firstPageStartY = curY;

	// ---- Footer ----
	function drawFooter() {
		doc.setFontSize(7);
		doc.setTextColor(160, 160, 160);
		doc.setFont(fontFamily, 'normal');
		const date = new Date().toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'});
		doc.text(date, margin, pageH - 8);
		doc.text('zktimer.app', pageW - margin, pageH - 8, {align: 'right'});
	}

	// ---- Continuation page header ----
	function drawPageHeader(pageNum: number, totalPages: number) {
		doc.setFont(fontFamily, 'bold');
		doc.setFontSize(10);
		doc.setTextColor(80, 80, 80);
		doc.text(category, margin, 12);

		doc.setFont(fontFamily, 'normal');
		doc.setFontSize(8);
		doc.setTextColor(140, 140, 140);
		doc.text(`${pageNum} / ${totalPages}`, pageW - margin, 12, {align: 'right'});

		doc.setDrawColor(220, 220, 220);
		doc.setLineWidth(0.2);
		doc.line(margin, 15, pageW - margin, 15);
	}

	// ---- Card layout calculation ----
	const colW = (contentW - 6) / 2;
	const patternSize = 22;
	const cardPadding = 4;
	const cardGap = 4;
	const maxY = pageH - 16;
	const contStartY = 20;

	function getCardHeight(alg: {algorithm: string; alternatives?: string[]}): number {
		let h = cardPadding;
		h += 6; // name row

		// Text column height: main alg + alternatives
		doc.setFont(fontFamily, 'bold');
		doc.setFontSize(8);
		const algLines: string[] = doc.splitTextToSize(alg.algorithm, colW - cardPadding * 2 - patternSize - 3);
		let textH = 5 + algLines.length * 3.2; // offset + lines
		const alts = alg.alternatives || [];
		if (alts.length > 0) {
			textH += 1 + alts.length * 3.5;
		}

		h += Math.max(patternSize, textH);
		h += cardPadding;
		return h;
	}

	// Pre-compute placements
	interface CardPlacement {
		alg: typeof algorithms[0];
		algIndex: number;
		col: number;
		x: number;
		y: number;
		h: number;
		page: number;
	}

	const placements: CardPlacement[] = [];
	let curPage = 0;
	const colY = [firstPageStartY, firstPageStartY];

	for (let ai = 0; ai < algorithms.length; ai++) {
		const alg = algorithms[ai];
		const h = getCardHeight(alg);
		let col = colY[0] <= colY[1] ? 0 : 1;

		if (colY[col] + h > maxY) {
			const other = col === 0 ? 1 : 0;
			if (colY[other] + h <= maxY) {
				col = other;
			} else {
				curPage++;
				colY[0] = contStartY;
				colY[1] = contStartY;
				col = 0;
			}
		}

		const px = margin + col * (colW + 6);
		placements.push({alg, algIndex: ai, col, x: px, y: colY[col], h, page: curPage});
		colY[col] += h + cardGap;
	}

	const totalPages = curPage + 1;

	// ---- Pre-capture 3D screenshots for algorithms without 2D patterns ----
	const needs3D: {algorithm: string; index: number}[] = [];
	const isLL2 = isLLCategory(category);
	const isIso2 = isIsometricCategory(category);
	const is2D2 = is2DPatternCategory(category);
	const ppt = getPuzzlePatternType(category);

	for (let i = 0; i < algorithms.length; i++) {
		const alg = algorithms[i];
		let has2D = false;
		if (isIso2 && getIsometricPattern(alg.algorithm)) has2D = true;
		else if (isLL2 && getLLPattern(alg.algorithm)) has2D = true;
		else if (is2D2 && ppt && getPuzzlePattern(ppt, alg.algorithm, category)) has2D = true;
		if (!has2D) needs3D.push({algorithm: alg.algorithm, index: i});
	}

	const screenshotMap = await batchCapture3DScreenshots(needs3D, category, topFace, effectiveFrontFace);

	// ---- Render ----
	let lastPage = -1;

	for (const p of placements) {
		if (p.page !== lastPage) {
			if (lastPage >= 0) {
				drawFooter();
				doc.addPage();
			}
			if (p.page > 0) {
				drawPageHeader(p.page + 1, totalPages);
			}
			lastPage = p.page;
		}

		const {alg, x: cx, y: cy, h} = p;

		// Card background
		doc.setFillColor(248, 249, 250);
		doc.setDrawColor(230, 230, 230);
		doc.setLineWidth(0.2);
		doc.roundedRect(cx, cy, colW, h, 2, 2, 'FD');

		let iy = cy + cardPadding;

		// Name + subset badge
		doc.setFont(fontFamily, 'bold');
		doc.setFontSize(10);
		doc.setTextColor(30, 30, 30);
		doc.text(alg.name, cx + cardPadding, iy + 4);

		if (alg.subset) {
			const badgeX = cx + cardPadding + doc.getTextWidth(alg.name) + 3;
			doc.setFontSize(6.5);
			doc.setFont(fontFamily, 'normal');
			const badgeW = doc.getTextWidth(alg.subset) + 4;
			doc.setFillColor(brandR, brandG, brandB);
			doc.roundedRect(badgeX, iy + 0.5, badgeW, 4.5, 1, 1, 'F');
			doc.setTextColor(255, 255, 255);
			doc.text(alg.subset, badgeX + 2, iy + 3.8);
		}

		iy += 6;

		// Pattern + algorithm
		const hasPattern = drawPattern(doc, category, alg.algorithm, topFace, effectiveFrontFace, stickering, cx + cardPadding, iy, patternSize, screenshotMap, p.algIndex);
		const textX = hasPattern ? cx + cardPadding + patternSize + 3 : cx + cardPadding;
		const textMaxW = hasPattern ? colW - cardPadding * 2 - patternSize - 3 : colW - cardPadding * 2;

		doc.setFont(fontFamily, 'bold');
		doc.setFontSize(8);
		doc.setTextColor(30, 30, 30);
		const algLines: string[] = doc.splitTextToSize(alg.algorithm, textMaxW);
		doc.text(algLines, textX, iy + 5);

		// Alternatives right below main algorithm text, same X alignment
		const alts = alg.alternatives || [];
		const algTextEndY = iy + 5 + algLines.length * 3.2;

		if (alts.length > 0) {
			let altY = algTextEndY + 1;
			doc.setFont(fontFamily, 'normal');
			doc.setFontSize(7);
			doc.setTextColor(110, 110, 110);

			for (const alt of alts) {
				const altLines: string[] = doc.splitTextToSize(alt, textMaxW);
				doc.text(altLines[0], textX, altY);
				altY += 3.5;
			}
		}
	}

	// Footer on last page
	drawFooter();

	// Page number on first page
	if (totalPages > 1) {
		doc.setPage(1);
		doc.setFont(fontFamily, 'normal');
		doc.setFontSize(8);
		doc.setTextColor(140, 140, 140);
		doc.text(`1 / ${totalPages}`, pageW - margin, firstPageStartY - 6, {align: 'right'});
	}

	// Save
	const safeName = category.replace(/[^a-zA-Z0-9]/g, '_');
	doc.save(`Zkt_Timer_${safeName}.pdf`);
}
