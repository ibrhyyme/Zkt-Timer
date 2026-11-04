import React, {useMemo, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useSolveDb} from '../../util/hooks/useSolveDb';
import {useEventListener} from '../../util/event_handler';
import {getDailyGoalProgress} from './helpers/progress';
import {triggerGoalConfetti} from './helpers/confetti';
import {getCubeTypeBucketLabel, getCubeTypeInfoById} from '../../util/cubes/util';

interface Props {
	cubeType: string;
	scrambleSubset?: string | null;
	compact?: boolean;
}

export default function DailyGoalProgressBar({cubeType, scrambleSubset, compact}: Props) {
	const {t} = useTranslation();
	const solveUpdate = useSolveDb();
	const prevCountRef = useRef<number | null>(null);
	const [goalVersion, setGoalVersion] = useState(0);

	useEventListener('dailyGoalUpdatedEvent', () => {
		setGoalVersion((v) => v + 1);
	}, []);

	const progress = useMemo(() => {
		return getDailyGoalProgress(cubeType, scrambleSubset);
	}, [cubeType, scrambleSubset, solveUpdate, goalVersion]);

	// Hedefe ulasma tespiti
	useEffect(() => {
		if (!progress) return;

		const prevCount = prevCountRef.current;
		if (prevCount !== null && prevCount < progress.target && progress.current >= progress.target) {
			triggerGoalConfetti();
		}
		prevCountRef.current = progress.current;
	}, [progress?.current, progress?.target]);

	if (!progress) return null;

	const cubeName = getCubeTypeBucketLabel(cubeType, scrambleSubset) || getCubeTypeInfoById(cubeType)?.name || cubeType;
	const textSize = compact ? 'text-[10px]' : 'text-xs';

	// The label runs across the fill. In the text colour it vanished into the accent fill
	// (white on orange at 10px read as the fill covering "3x3"), so the part of the label
	// that sits on the fill is drawn a second time in the fill's own contrast colour,
	// clipped to the fill's width.
	const label = (onFill: boolean) => (
		<>
			<span className={`font-medium ${onFill ? '' : 'text-text/90'} ${textSize}`}>
				{cubeName} &middot; {t('quick_controls.solves_progress', {current: progress.current, target: progress.target})}
			</span>
			<span className={`font-semibold ${onFill ? '' : 'text-text/80'} ${textSize}`}>
				{progress.percentage}%
			</span>
		</>
	);

	return (
		// Compact is the phone timer: px-2 is the 0.5rem side margin of the action row and
		// the module cards under it, so the three line up edge to edge.
		<div className={`zt-daily-goal-progress w-full ${compact ? 'px-2 py-1' : 'px-4 py-2'}`}>
			<div className={`relative w-full ${compact ? 'h-5' : 'h-6'} bg-[color:var(--zt-surface)] rounded overflow-hidden border border-[color:var(--zt-surface-border)]`}>
				{/* Fill bar */}
				<div
					className={`h-full rounded transition-all duration-500 ease-out ${
						progress.completed ? 'bg-green-500' : 'bg-primary'
					}`}
					style={{width: `${progress.percentage}%`}}
				/>
				{/* Text overlay */}
				<div className="absolute inset-0 flex items-center justify-between px-3">{label(false)}</div>
				{/* The same text over the filled part, in the fill's contrast colour */}
				<div
					aria-hidden="true"
					className={`absolute inset-0 flex items-center justify-between px-3 transition-[clip-path] duration-500 ease-out ${
						progress.completed ? 'text-[rgb(18,20,26)]' : 'text-[rgb(var(--theme-primary-opposite))]'
					}`}
					style={{clipPath: `inset(0 ${100 - progress.percentage}% 0 0)`}}
				>
					{label(true)}
				</div>
			</div>
		</div>
	);
}
