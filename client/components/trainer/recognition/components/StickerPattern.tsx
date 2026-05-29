/**
 * StickerPattern — 6 hücreli (veya çoklu katman) mini SVG sticker görünümü.
 * Guide kartlarinda + preset kartlarinda kullanilir.
 * Referans `src/components/guide/StickerPattern.vue` portu.
 */
import React, {useMemo} from 'react';
import block from '../../../../styles/bem';

const b = block('trainer-recognition');

export interface StickerLayer {
	row: number;
	col: number;
	cells: string[]; // her hücre: "g" | "o" | "b" | "r" | "x" (+ opsiyonel "!" suffix outlined için)
}

interface StickerPatternProps {
	layers: StickerLayer[];
	cellSize?: number;
	gap?: number;
	groupGap?: number;
	groupSize?: number;
	minColumns?: number;
	isDark?: boolean;
}

interface ParsedCell {
	colorKey: string;
	outlined: boolean;
}

function parseCell(token: string): ParsedCell {
	const outlined = token.endsWith('!');
	const colorKey = token.replace('!', '');
	return {colorKey, outlined};
}

function groupGapsFn(col: number, groupSize: number, groupGap: number): number {
	if (groupSize <= 0) return 0;
	const groups = Math.floor(col / groupSize);
	return groups * groupGap;
}

export default function StickerPattern({
	layers,
	cellSize = 22,
	gap = 0,
	groupGap = 6,
	groupSize = 3,
	minColumns = 6,
	isDark = true,
}: StickerPatternProps) {
	const colorMap = useMemo<Record<string, string>>(
		() => ({
			g: '#21b15b',
			o: '#e8a11a',
			b: '#2d8fe3',
			r: '#e53935',
			x: isDark ? '#555' : '#d0d0d0',
		}),
		[isDark]
	);

	const bounds = useMemo(() => {
		let maxRow = 0;
		let maxCol = minColumns;
		for (const layer of layers) {
			maxRow = Math.max(maxRow, layer.row);
			maxCol = Math.max(maxCol, layer.col + layer.cells.length);
		}
		return {rows: maxRow + 1, cols: maxCol};
	}, [layers, minColumns]);

	const svgWidth = bounds.cols * cellSize + (bounds.cols - 1) * gap + groupGapsFn(bounds.cols - 1, groupSize, groupGap);
	const svgHeight = bounds.rows * cellSize + (bounds.rows - 1) * gap;

	const rects = useMemo(() => {
		const result: {
			key: string;
			x: number;
			y: number;
			width: number;
			height: number;
			fill: string;
			outlined: boolean;
			sw: number;
		}[] = [];
		let n = 0;
		for (const layer of layers) {
			for (let i = 0; i < layer.cells.length; i++) {
				const {colorKey, outlined} = parseCell(layer.cells[i]);
				const col = layer.col + i;
				const sw = outlined ? 2.5 : 1;
				const logicalX = col * (cellSize + gap) + groupGapsFn(col, groupSize, groupGap);
				const logicalY = layer.row * (cellSize + gap);
				result.push({
					key: `${n++}-${layer.row}-${col}`,
					x: logicalX + sw / 2,
					y: logicalY + sw / 2,
					width: cellSize - sw,
					height: cellSize - sw,
					fill: colorMap[colorKey] || colorMap.x,
					outlined,
					sw,
				});
			}
		}
		return result;
	}, [layers, cellSize, gap, groupGap, groupSize, colorMap]);

	return (
		<div className={b('sticker-pattern')}>
			<svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
				{rects.map((r) => (
					<rect
						key={r.key}
						x={r.x}
						y={r.y}
						width={r.width}
						height={r.height}
						rx={1.5}
						fill={r.fill}
						stroke={r.outlined ? 'rgb(var(--text-color))' : 'rgba(var(--text-color), 0.18)'}
						strokeWidth={r.sw}
					/>
				))}
			</svg>
		</div>
	);
}
