import {useMemo} from 'react';
import {useTrainerDb} from '../../../util/hooks/useTrainerDb';
import {algToId} from '../../../util/trainer/algorithm_engine';
import {getBestTime, getLastTimes, averageOfFive, averageOfTwelve} from './useAlgorithmData';

export interface AlgorithmStats {
	algId: string;
	bestTime: number | null;
	ao5: number | null;
	ao12: number | null;
	lastTimes: number[];
	totalSolves: number;
	tps: number | null;
}

export function formatTimeShort(ms: number | null): string {
	if (!ms) return '-';
	const seconds = Math.floor(ms / 1000);
	const millis = Math.floor(ms % 1000);
	return `${seconds}.${millis.toString().padStart(3, '0')}`;
}

export function useTrainerStats(algorithm: string | null, moveCount?: number) {
	const dbVersion = useTrainerDb();

	return useMemo(() => {
		if (!algorithm) {
			return {
				algId: '',
				bestTime: null,
				ao5: null,
				ao12: null,
				lastTimes: [],
				totalSolves: 0,
				tps: null,
			} as AlgorithmStats;
		}

		const algId = algToId(algorithm);
		const bestTime = getBestTime(algId);
		const ao5Val = averageOfFive(algId);
		const ao12Val = averageOfTwelve(algId);
		const lastTimes = getLastTimes(algId);

		let tps: number | null = null;
		if (bestTime && moveCount && moveCount > 0) {
			tps = moveCount / (bestTime / 1000);
		}

		return {
			algId,
			bestTime,
			ao5: ao5Val,
			ao12: ao12Val,
			lastTimes,
			totalSolves: lastTimes.length,
			tps,
		} as AlgorithmStats;
	}, [algorithm, moveCount, dbVersion]);
}
