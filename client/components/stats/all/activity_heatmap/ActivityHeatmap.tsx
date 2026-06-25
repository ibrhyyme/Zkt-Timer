import React, {useContext, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import dayjs from 'dayjs';
import './ActivityHeatmap.scss';
import block from '../../../../styles/bem';
import {getSolveCountByDateData} from '../../../../db/solves/stats/consistency';
import {getSolveStreak} from '../../../../db/solves/stats/streak';
import {useSolveDb} from '../../../../util/hooks/useSolveDb';
import {useEventListener} from '../../../../util/event_handler';
import {getDailyGoalStorage} from '../../../daily-goal/helpers/storage';
import {getRoomDailyCounts} from '../../../daily-goal/helpers/room-solves';
import {StatsContext} from '../../Stats';

const b = block('activity-heatmap');

const DAYS = 365;
const WEEKS = 53;

interface Cell {
	dateKey: string;
	count: number;
	level: 0 | 1 | 2 | 3 | 4;
	month: number;
}

export default function ActivityHeatmap() {
	const {t} = useTranslation();
	const {filterOptions} = useContext(StatsContext);
	const solveUpdate = useSolveDb();
	const [goalVersion, setGoalVersion] = useState(0);

	// Room-solve cache refreshes (fetch / toggle) emit dailyGoalUpdatedEvent.
	useEventListener('dailyGoalUpdatedEvent', () => setGoalVersion((v) => v + 1), []);

	// Friendly Room per-day counts to fold into the heatmap + streak, when opted in.
	// Room solves have no session, so skip them when a session filter is active.
	const roomExtra = useMemo(() => {
		if (!getDailyGoalStorage().count_room_solves) return undefined;
		if (filterOptions.session_id) return undefined;
		const cubeType = typeof filterOptions.cube_type === 'string' ? filterOptions.cube_type : undefined;
		const subset = typeof filterOptions.scramble_subset === 'string' ? filterOptions.scramble_subset : null;
		return getRoomDailyCounts(cubeType, subset);
	}, [filterOptions, solveUpdate, goalVersion]);

	const {grid, activeDays, monthMarkers, max} = useMemo(() => {
		const end = new Date();
		end.setHours(23, 59, 59, 999);
		const start = new Date(end);
		start.setDate(start.getDate() - (DAYS - 1));
		start.setHours(0, 0, 0, 0);

		const data = getSolveCountByDateData({
			...filterOptions,
			started_at: start.getTime(),
			ended_at: end.getTime(),
		}, roomExtra);

		const dataMap = new Map<string, number>();
		data.forEach((d) => dataMap.set(d.x, d.y));

		const counts = data.map((d) => d.y);
		const maxCount = Math.max(...counts, 1);

		// Pazartesi=0 mantığı için offset
		const startDay = start.getDay(); // 0=Sun
		const startOffset = startDay === 0 ? 6 : startDay - 1;

		// 53 col × 7 row grid: column-major order ile fill
		const cells: (Cell | null)[][] = [];
		for (let w = 0; w < WEEKS; w++) {
			cells.push(new Array(7).fill(null));
		}

		const markers: {col: number; monthIdx: number}[] = [];
		let currentMonth = -1;
		const cursor = new Date(start);
		cursor.setDate(cursor.getDate() - startOffset);

		for (let w = 0; w < WEEKS; w++) {
			for (let d = 0; d < 7; d++) {
				if ((w === 0 && d < startOffset) || cursor.getTime() > end.getTime()) {
					cursor.setDate(cursor.getDate() + 1);
					continue;
				}

				const key = dayjs(cursor).format('YYYY-M-D');
				const count = dataMap.get(key) || 0;
				const month = cursor.getMonth();

				let level: 0 | 1 | 2 | 3 | 4 = 0;
				if (count > 0) {
					const pct = count / maxCount;
					if (pct > 0.75) level = 4;
					else if (pct > 0.5) level = 3;
					else if (pct > 0.25) level = 2;
					else level = 1;
				}

				cells[w][d] = {
					dateKey: dayjs(cursor).format('DD MMM YYYY'),
					count,
					level,
					month,
				};

				if (d === 0 && month !== currentMonth) {
					markers.push({col: w, monthIdx: month});
					currentMonth = month;
				}

				cursor.setDate(cursor.getDate() + 1);
			}
		}

		const active = data.filter((d) => d.y > 0).length;

		return {grid: cells, activeDays: active, monthMarkers: markers, max: maxCount};
	}, [filterOptions, solveUpdate, roomExtra]);

	const streak = useMemo(() => getSolveStreak(filterOptions, roomExtra), [filterOptions, solveUpdate, roomExtra]);

	return (
		<div className={b()}>
			<div className={b('months')}>
				{monthMarkers.map((m, i) => (
					<span
						key={`${m.col}-${i}`}
						className={b('month')}
						style={{gridColumn: m.col + 1}}
					>
						{dayjs().month(m.monthIdx).format('MMM')}
					</span>
				))}
			</div>
			<div className={b('grid')}>
				{grid.map((week, w) => (
					<div key={w} className={b('week')}>
						{week.map((cell, d) => (
							<div
								key={d}
								className={b('cell')}
								data-l={cell?.level || 0}
								title={cell ? `${cell.dateKey} · ${cell.count}` : ''}
							/>
						))}
					</div>
				))}
			</div>
			<div className={b('footer')}>
				<div className={b('stat')}>
					<strong>{activeDays}</strong>
					<span>{t('stats.heatmap.active_days', {total: DAYS})}</span>
				</div>
				<div className={b('scale')}>
					<span>{t('stats.heatmap.less')}</span>
					<i data-l="0" />
					<i data-l="1" />
					<i data-l="2" />
					<i data-l="3" />
					<i data-l="4" />
					<span>{t('stats.heatmap.more')}</span>
				</div>
				<div className={b('stat', {right: true})}>
					<strong>{streak.currentStreak} {t('stats_page.days')}</strong>
					<span>{t('stats.heatmap.current_streak')}</span>
				</div>
			</div>
		</div>
	);
}
