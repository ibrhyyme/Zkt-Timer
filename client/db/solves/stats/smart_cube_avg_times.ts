import {fetchSolves, FilterSolvesOptions} from '../query';
import {Solve} from '../../../../server/schemas/Solve.schema';

/**
 * Opening step of each method. Their recognition time is always 0 for the
 * structural reason explained at the usage site, so it must not dilute the
 * recognition average.
 */
const FIRST_STEP_NAMES = new Set(['cross', 'fb', 'eoline']);

export interface SmartCubeAvgTimes {
	avgInspection: number;
	avgRecognition: number;
	avgExecution: number;
	inspectionSampleCount: number;
	methodStepsSampleCount: number;
}

export function getSmartCubeAvgTimes(filter: FilterSolvesOptions, lastN?: number): SmartCubeAvgTimes {
	const solves = fetchSolves({
		...filter,
		dnf: false,
		is_smart_cube: true,
		time: {$gt: 0},
	}, lastN ? { limit: lastN } : undefined) as Solve[];

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
				// f2l parent step'in total_time'i = f2l_1..4 toplami (solve_method.ts:131).
				// Atomik step'lerle birlikte sayilirsa double-count olur. Skip.
				if (step.step_name === 'f2l') continue;
				const recogTime = step.recognition_time || 0;
				const totalTime = step.total_time || 0;
				// Ilk adimin taninma suresi YAPISAL olarak 0: sayac ilk hamlenin
				// zaman damgasindan basliyor, cunku akilli kup ilk hamleden once
				// veri gondermiyor. Scramble'a bakip plan yapma suresi
				// `inspection_time` alaninda ayri tutuluyor. Bu sifiri ortalamaya
				// katmak "ortalama taninma suresi"ni her cozumde asagi cekiyordu.
				const isFirstStep = FIRST_STEP_NAMES.has(step.step_name);
				if (isFirstStep && recogTime === 0) {
					exec += totalTime;
					continue;
				}
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
