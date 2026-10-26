import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RootStateOrAny, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import jsonStr from 'json-stable-stringify';
import { FilterSolvesOptions } from '../../../db/solves/query';
import { useSolveDb } from '../../../util/hooks/useSolveDb';
import { useActiveSessionId } from '../../../util/hooks/useActiveSessionId';
import { useGeneral } from '../../../util/hooks/useGeneral';
import QuickStatsBlock from './QuickStatsBlock';
import { formatStatsBlockValue, getStatsBlockValueFromFilter } from './util';
import { fitValueFontSize, pickStatsGrid } from './grid_layout';
import { StatsModuleBlock } from '../../../../server/schemas/StatsModule.schema';
import block from '../../../styles/bem';
import './QuickStats.scss';

const b = block('quick-stats');

// Before the first measurement (and in the server render): the old fixed size.
const UNMEASURED_FONT = 25;
// A box smaller than this has no height of its own yet (a parent that sizes to its
// content). Sizing from it would feed back: the font changes the content, the content the
// box, the box the font.
const MIN_MEASURED_PX = 40;

// useLayoutEffect warns in the server render; the caption width is only read in the browser.
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

interface Props {
	filterOptions: FilterSolvesOptions;
}

export default function QuickStats(props: Props) {
	const { filterOptions } = props;

	const { i18n } = useTranslation();
	const stats = useSelector((state: RootStateOrAny) => state?.stats);
	const mobileMode = useGeneral('mobile_mode');
	const sessionId = useActiveSessionId();
	const solveDb = useSolveDb();
	const rootRef = useRef<HTMLDivElement>(null);
	const [size, setSize] = useState({ width: 0, height: 0 });
	const [captionWidth, setCaptionWidth] = useState(0);

	let statsModuleBlocks = (stats.blocks as StatsModuleBlock[]) || [];
	// A phone's module slot is small: the first four blocks only
	if (mobileMode && statsModuleBlocks.length > 4) {
		statsModuleBlocks = statsModuleBlocks.slice(0, 4);
	}

	const filterKey = jsonStr(filterOptions);
	const results = useMemo(
		() => statsModuleBlocks.map((statsBlock) => getStatsBlockValueFromFilter(statsBlock, filterOptions, sessionId)),
		[statsModuleBlocks, filterKey, sessionId, solveDb]
	);

	// The module is resized from its edges (timer tiles) and by the window, neither of which
	// re-renders this component, so the size is observed rather than read once.
	useEffect(() => {
		const el = rootRef.current;
		if (!el) return;

		const measure = () => {
			const width = Math.round(el.clientWidth);
			const height = Math.round(el.clientHeight);
			setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
		};
		measure();

		if (typeof ResizeObserver === 'undefined') {
			window.addEventListener('resize', measure);
			return () => window.removeEventListener('resize', measure);
		}
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	// The longest caption's own text width, plus the cell's side padding. Measured on a
	// canvas in the caption's font, not from the element: a block caption reports the cell's
	// width when its text is shorter, which would tie the measurement to the layout it decides.
	const captionKey = `${i18n.language}|${jsonStr(statsModuleBlocks)}`;
	useBrowserLayoutEffect(() => {
		const ctx = document.createElement('canvas').getContext('2d');
		if (!ctx) return;
		let cancelled = false;

		const measure = () => {
			const el = rootRef.current;
			if (cancelled || !el) return;
			let widest = 0;
			el.querySelectorAll<HTMLElement>(`.${b('caption')}`).forEach((caption) => {
				const captionStyle = getComputedStyle(caption);
				ctx.font = `${captionStyle.fontWeight} ${captionStyle.fontSize} ${captionStyle.fontFamily}`;
				const cellStyle = getComputedStyle(caption.parentElement);
				const pad = parseFloat(cellStyle.paddingLeft) + parseFloat(cellStyle.paddingRight);
				widest = Math.max(widest, Math.ceil(ctx.measureText(caption.textContent || '').width + pad));
			});
			setCaptionWidth((prev) => (prev === widest ? prev : widest));
		};

		measure();
		// Measured again once the web font is in: the fallback face has other widths.
		document.fonts?.ready.then(measure);
		return () => {
			cancelled = true;
		};
	}, [captionKey]);

	const measured = size.width >= MIN_MEASURED_PX && size.height >= MIN_MEASURED_PX;
	const grid = pickStatsGrid(
		statsModuleBlocks.length,
		measured ? size.width : 0,
		measured ? size.height : 0,
		0,
		captionWidth
	);
	const values = results.map(formatStatsBlockValue);

	// One size for every value, fitted to the longest one in a full row's cell, so the same
	// kind of number never has two sizes side by side. A shorter last row only widens.
	let fontSize = UNMEASURED_FONT;
	if (measured && grid.columns) {
		const longest = Math.max(...values.map((v) => v.length));
		fontSize = fitValueFontSize(size.width / grid.columns, size.height / grid.rows.length, longest);
	}

	let next = 0;
	const rows = grid.rows.map((rowLength, rowIndex) => {
		const start = next;
		next += rowLength;
		return (
			<div key={`row-${rowIndex}`} className={b('row')}>
				{statsModuleBlocks.slice(start, next).map((statsBlock, i) => (
					<QuickStatsBlock
						key={`stats-block-${start + i}`}
						statOptions={statsBlock}
						result={results[start + i]}
						value={values[start + i]}
						filterOptions={filterOptions}
						fontSize={fontSize}
					/>
				))}
			</div>
		);
	});

	// "Customize stats" lives behind the gear in the module header now (see
	// timer/tiles/ModuleHeaderMenu.tsx). It used to be a button laid over this grid's top
	// right corner on hover, covering the block under it and swallowing its clicks.
	return (
		<div className={b()} ref={rootRef}>
			{rows}
		</div>
	);
}
