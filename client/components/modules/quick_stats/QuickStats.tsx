import React, { useMemo } from 'react';
import { FilterSolvesOptions } from '../../../db/solves/query';
import { RootStateOrAny, useSelector } from 'react-redux';
import { useSolveDb } from '../../../util/hooks/useSolveDb';
import QuickStatsBlock from './QuickStatsBlock';
import { getQuickStatsGridSizes } from './util';
import { StatsModuleBlock } from '../../../../server/schemas/StatsModule.schema';
import { useGeneral } from '../../../util/hooks/useGeneral';

interface Props {
	filterOptions: FilterSolvesOptions;
}

export default function QuickStats(props: Props) {
	const { filterOptions } = props;

	const stats = useSelector((state: RootStateOrAny) => state?.stats);
	const mobileMode = useGeneral('mobile_mode');
	let statsModuleBlocks = (stats.blocks as StatsModuleBlock[]) || [];

	// On mobile, show only 4 blocks: AO5 best, AO12 best, PB, Worst
	if (mobileMode && statsModuleBlocks.length > 4) {
		statsModuleBlocks = statsModuleBlocks.slice(0, 4);
	}

	const blockCount = statsModuleBlocks.length;
	const blockSizes = useMemo(() => getQuickStatsGridSizes(blockCount), [blockCount]);

	useSolveDb();

	const classes = ['grid', `grid-rows-4`, `grid-cols-4`, 'gap-1', 'w-full', 'h-full'];
	const className = classes.join(' ');

	const blocks = [];

	for (let i = 0; i < blockCount; i++) {
		const statsBlock = statsModuleBlocks[i];
		const colSpan = blockSizes[i][0];
		const rowSpan = blockSizes[i][1];

		blocks.push(
			<div
				key={`stats-block-${i}`}
				style={{
					gridColumn: `span ${colSpan}`,
					gridRow: `span ${rowSpan}`,
				}}
			>
				<QuickStatsBlock
					statOptions={statsBlock}
					filterOptions={filterOptions}
					colSpan={colSpan}
					rowSpan={rowSpan}
				/>
			</div>
		);
	}

	// "Customize stats" lives behind the gear in the module header now (see
	// timer/tiles/ModuleHeaderMenu.tsx). It used to be a button laid over this grid's top
	// right corner on hover, covering the block under it and swallowing its clicks.
	return (
		<div className="w-full h-full relative">
			<div className={className}>{blocks}</div>
		</div>
	);
}
