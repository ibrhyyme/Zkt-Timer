import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {getTimeString} from '../../util/time';
import {computeRoomStats, ROOM_AVERAGE_COUNTS} from './room_stats';
import type {FriendlyRoomSolveData} from '../../../shared/friendly_room/types';

interface Props {
	solves: FriendlyRoomSolveData[];
	decimalPoints: number;
}

/**
 * The single and average table in a room's bottom panel.
 *
 * Six stat columns do not fit beside the scramble preview on a phone, and dropping some of
 * them would hide exactly the long averages people asked for. So on narrow screens the table
 * scrolls sideways with the row labels pinned, and a fade on the right edge says there is
 * more for as long as there is. Desktop has the width and never scrolls.
 */
export default function RoomStatsPanel({solves, decimalPoints}: Props) {
	const {t} = useTranslation();
	const scrollRef = useRef<HTMLDivElement>(null);
	const [moreToRight, setMoreToRight] = useState(false);

	const stats = useMemo(() => computeRoomStats(solves), [solves]);

	const updateFade = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		// Two pixels of slack: subpixel widths leave scrollLeft a fraction short of the end.
		setMoreToRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
	}, []);

	useEffect(() => {
		updateFade();
		window.addEventListener('resize', updateFade);
		return () => window.removeEventListener('resize', updateFade);
	}, [updateFade, stats]);

	const fmt = (value: number | null) => (value === null ? '-' : getTimeString(value, decimalPoints));

	const headerCell = 'text-blue-400 font-bold text-center text-[10px] uppercase tracking-wider whitespace-nowrap';
	const valueCell = 'text-text font-mono text-center whitespace-nowrap';
	// Pinned so the row names stay readable while the numbers scroll under them.
	const labelCell = 'sticky left-0 z-10 bg-module text-text font-medium text-left pr-2';

	return (
		<div className="relative min-w-0 flex-1 text-xs md:text-sm">
			<div
				ref={scrollRef}
				onScroll={updateFade}
				className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				<div className="grid w-max grid-cols-[50px_repeat(6,minmax(44px,auto))] gap-x-2 gap-y-1 items-center">
					<span className={`${labelCell} text-[10px]`} />
					<span className={headerCell}>{t('rooms.single')}</span>
					{ROOM_AVERAGE_COUNTS.map((count) => (
						<span key={count} className={headerCell}>{t(`rooms.ao${count}`)}</span>
					))}

					<span className={labelCell}>{t('rooms.current')}</span>
					<span className={valueCell}>{fmt(stats.lastSingle)}</span>
					{ROOM_AVERAGE_COUNTS.map((count) => (
						<span key={count} className={valueCell}>{fmt(stats.averages[count].current)}</span>
					))}

					<span className={labelCell}>{t('rooms.best')}</span>
					<span className={valueCell}>{fmt(stats.bestSingle)}</span>
					{ROOM_AVERAGE_COUNTS.map((count) => (
						<span key={count} className={valueCell}>{fmt(stats.averages[count].best)}</span>
					))}
				</div>
			</div>
			{moreToRight && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-module to-transparent"
				/>
			)}
		</div>
	);
}
