import React, {useMemo} from 'react';

// Zkt-Timer renk paleti ile eslesmis cubingapp SQ1 renkleri
const WHITE = '#ffffff';
const DARK_GRAY = '#444444';
const BLUE = '#0046ad';
const ORANGE = '#ff5800';
const RED = '#b71234';
const GREEN = '#009b48';
const YELLOW = '#fedd00';

// cubingapp main.js SQ1.getSvg()'den birebir piece renk tablosu
// 0-7: top layer (U/D face = DARK_GRAY/WHITE)
// 8-15: bottom layer
// Even indices = corner (3 renk, 60°), odd indices = edge (2 renk, 30°)
const PIECES: string[][] = [
	[DARK_GRAY, BLUE, RED],       // 0: top corner
	[DARK_GRAY, BLUE],            // 1: top edge
	[DARK_GRAY, ORANGE, BLUE],    // 2: top corner
	[DARK_GRAY, ORANGE],          // 3: top edge
	[DARK_GRAY, GREEN, ORANGE],   // 4: top corner
	[DARK_GRAY, GREEN],           // 5: top edge
	[DARK_GRAY, RED, GREEN],      // 6: top corner
	[DARK_GRAY, RED],             // 7: top edge
	[WHITE, RED, BLUE],           // 8: bottom corner
	[WHITE, BLUE],                // 9: bottom edge
	[WHITE, BLUE, ORANGE],        // 10: bottom corner
	[WHITE, ORANGE],              // 11: bottom edge
	[WHITE, ORANGE, GREEN],       // 12: bottom corner
	[WHITE, GREEN],               // 13: bottom edge
	[WHITE, GREEN, RED],          // 14: bottom corner
	[WHITE, RED],                 // 15: bottom edge
];

const SIZE = 100;
const MID = SIZE / 2;
const PAD = 0.15 * SIZE;
const WIDTH = 0.1 * SIZE;
const INNER = (WIDTH + PAD - MID) / Math.tan((75 * Math.PI) / 180) + MID;
const OUTER = (PAD - MID) / Math.tan((75 * Math.PI) / 180) + MID;

// cubingapp polygon sablonlari
const CORNER1 = `${MID},${MID} ${INNER},${SIZE - WIDTH - PAD} ${WIDTH + PAD},${SIZE - WIDTH - PAD} ${WIDTH + PAD},${SIZE - INNER}`;
const CORNER2 = `${PAD},${SIZE - PAD} ${WIDTH + PAD},${SIZE - WIDTH - PAD} ${WIDTH + PAD},${SIZE - INNER} ${PAD},${SIZE - OUTER}`;
const CORNER3 = `${PAD},${SIZE - PAD} ${WIDTH + PAD},${SIZE - WIDTH - PAD} ${INNER},${SIZE - WIDTH - PAD} ${OUTER},${SIZE - PAD}`;
const EDGE1 = `${MID},${MID} ${SIZE - INNER},${SIZE - WIDTH - PAD} ${INNER},${SIZE - WIDTH - PAD}`;
const EDGE2 = `${OUTER},${SIZE - PAD} ${INNER},${SIZE - WIDTH - PAD} ${SIZE - INNER},${SIZE - WIDTH - PAD} ${SIZE - OUTER},${SIZE - PAD}`;

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
			return `${nx.toFixed(2)},${ny.toFixed(2)}`;
		})
		.join(' ');
}

interface FacePolygon {
	points: string;
	fill: string;
}

function buildFacePolygons(face: number[], isTop: boolean): FacePolygon[] {
	// Bottom face: corner2 ve corner3 swap (cubingapp'ten birebir)
	let c2 = CORNER2;
	let c3 = CORNER3;
	if (!isTop) {
		[c2, c3] = [c3, c2];
	}

	const polygons: FacePolygon[] = [];
	let angle = 0;

	for (let i = 0; i < face.length; i++) {
		const piece = PIECES[face[i]];
		if (!piece) continue;

		if (piece.length === 3) {
			// Corner: 3 polygon, 60° arc
			polygons.push({points: rotatePoints(CORNER1, MID, MID, angle), fill: piece[0]});
			polygons.push({points: rotatePoints(c2, MID, MID, angle), fill: piece[1]});
			polygons.push({points: rotatePoints(c3, MID, MID, angle), fill: piece[2]});
			angle -= 60;
		} else if (piece.length === 2) {
			// Edge: 2 polygon, 30° arc
			polygons.push({points: rotatePoints(EDGE1, MID, MID, angle - 30), fill: piece[0]});
			polygons.push({points: rotatePoints(EDGE2, MID, MID, angle - 30), fill: piece[1]});
			angle -= 30;
		}
	}

	return polygons;
}

interface SQ1PatternViewProps {
	top: number[];
	bottom: number[];
	mirror?: boolean;
	size?: number;
}

/**
 * Square-1 dual-octagon SVG rendering.
 * cubingapp main.js SQ1.getSvg()'den birebir port.
 * top/bottom: 8 piece index array (even=corner 60°, odd=edge 30°)
 * mirror: bottom face'i dik cev (Cube Shape ve CSP icin)
 */
export default function SQ1PatternView({top, bottom, mirror = false, size}: SQ1PatternViewProps) {
	const topPolygons = useMemo(() => buildFacePolygons(top, true), [top]);
	const bottomPolygons = useMemo(() => buildFacePolygons(bottom, false), [bottom]);

	const faceSize = size ? Math.floor(size / 2.2) : undefined;

	return (
		<div style={{display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center'}}>
			<svg
				viewBox={`0 0 ${SIZE} ${SIZE}`}
				width={faceSize || '45%'}
				height={faceSize || '45%'}
				style={{display: 'block'}}
				strokeLinejoin="round"
				stroke="#333"
				strokeWidth={1}
			>
				{topPolygons.map((p, i) => (
					<polygon key={i} points={p.points} fill={p.fill} />
				))}
			</svg>
			<svg
				viewBox={`0 0 ${SIZE} ${SIZE}`}
				width={faceSize || '45%'}
				height={faceSize || '45%'}
				style={{display: 'block'}}
				strokeLinejoin="round"
				stroke="#333"
				strokeWidth={1}
			>
				{mirror ? (
					<g transform={`translate(0, ${SIZE}) scale(1, -1)`}>
						{bottomPolygons.map((p, i) => (
							<polygon key={i} points={p.points} fill={p.fill} />
						))}
					</g>
				) : (
					bottomPolygons.map((p, i) => (
						<polygon key={i} points={p.points} fill={p.fill} />
					))
				)}
			</svg>
		</div>
	);
}
