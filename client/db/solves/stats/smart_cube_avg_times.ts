import {fetchSolves, FilterSolvesOptions} from '../query';
import {Solve} from '../../../../server/schemas/Solve.schema';

export interface SmartCubeAvgTimes {
	avgInspection: number;
	avgRecognition: number;
	avgExecution: number;
	inspectionSampleCount: number;
	methodStepsSampleCount: number;
}

export function getSmartCubeAvgTimes(filter: FilterSolvesOptions): SmartCubeAvgTimes {
	const solves = fetchSolves({
		...filter,
		dnf: false,
		is_smart_cube: true,
		time: {$gt: 0},
	}) as Solve[];

	let inspectionSum = 0;
	let inspectionCount = 0;
	let recogSum = 0;
	let execSum = 0;
	let methodCount = 0;

	for (const solve of solves) {
		if (solve.inspection_time != null && solve.inspection_time > 0) {
			inspectionSum += solve.inspection_time;
			inspectionCount++;
		}

		const steps = solve.solve_method_steps;
		if (steps && steps.length) {
			let recog = 0;
			let exec = 0;
			for (const step of steps) {
				const recogTime = step.recognition_time || 0;
				const totalTime = step.total_time || 0;
				recog += recogTime;
				exec += Math.max(0, totalTime - recogTime);
			}
			if (recog > 0 || exec > 0) {
				recogSum += recog;
				execSum += exec;
				methodCount++;
			}
		}
	}

	return {
		avgInspection: inspectionCount > 0 ? inspectionSum / inspectionCount : 0,
		avgRecognition: methodCount > 0 ? recogSum / methodCount : 0,
		avgExecution: methodCount > 0 ? execSum / methodCount : 0,
		inspectionSampleCount: inspectionCount,
		methodStepsSampleCount: methodCount,
	};
}
