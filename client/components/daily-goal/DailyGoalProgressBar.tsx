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

	return (
		<div className={`cd-daily-goal-progress w-full ${compact ? 'px-3 py-1' : 'px-4 py-2'}`}>
			<div className={`relative w-full ${compact ? 'h-5' : 'h-6'} bg-button rounded-full overflow-hidden border border-text/[0.06]`}>
				{/* Fill bar */}
				<div
					className={`h-full rounded-full transition-all duration-500 ease-out ${
						progress.completed ? 'bg-green-500' : 'bg-primary'
					}`}
					style={{width: `${progress.percentage}%`}}
				/>
				{/* Text overlay */}
				<div className="absolute inset-0 flex items-center justify-between px-3">
					<span className={`font-medium text-text/90 ${compact ? 'text-[10px]' : 'text-xs'}`}>
						{cubeName} &middot; {t('quick_controls.solves_progress', {current: progress.current, target: progress.target})}
					</span>
					<span className={`font-semibold text-text/70 ${compact ? 'text-[10px]' : 'text-xs'}`}>
						{progress.percentage}%
					</span>
				</div>
			</div>
		</div>
	);
}
