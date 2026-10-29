import {SolveMethodStep} from '../../../@types/generated/graphql';
import {Solve} from '../../../../server/schemas/Solve.schema';

export interface SolveStepWithChildren {
	step: SolveMethodStep;
	children: SolveMethodStep[];
}

export function getSolveStepsWithChildren(solve: Solve): SolveStepWithChildren[] {
	const steps = [];
	const children = [];

	for (const step of (solve.solve_method_steps || [])) {
		if (step.parent_name) {
			children.push(step);
		} else {
			steps.push({
				step,
				children: [],
			});
		}
	}

	for (const child of children) {
		for (const [index, step] of steps.entries()) {
			if (step.step.step_name === child.parent_name) {
				steps[index].children.push(child);
				break;
			}
		}
	}

	return steps;
}

export function getSolveStepsWithoutParents(solve: Solve) {
	const output = [];
	const steps = getSolveStepsWithChildren(solve);

	for (const step of steps) {
		if (step.children && step.children.length) {
			for (const child of step.children) {
				output.push(child);
			}
		} else {
			output.push(step.step);
		}
	}

	return output;
}

/**
 * A smart solve's recognition and execution, summed over its steps: the Statistics tab's
 * Total row and the card's summary use this one sum. Execution is a step's time past its
 * recognition. Null when the steps hold no time.
 */
export function getRecognitionExecution(solve: Solve): {recognition: number; execution: number} | null {
	let recognition = 0;
	let execution = 0;
	for (const step of getSolveStepsWithoutParents(solve)) {
		const total = step.total_time || 0;
		const rec = step.recognition_time || 0;
		recognition += rec;
		execution += Math.max(0, total - rec);
	}
	return recognition + execution > 0 ? {recognition, execution} : null;
}

/**
 * Turns per second for a smart cube solve, as the solve card shows it.
 *
 * One formula for every place that prints it: the card, and both clipboard copies. Before,
 * the card computed it inline and a copy would have had to repeat it, which is how two
 * numbers labelled "TPS" drift apart. Null when either input is missing, where the inline
 * version printed "Infinity" or "NaN".
 */
export function getSmartSolveTps(solve: Pick<Solve, 'smart_turn_count' | 'raw_time'>): number | null {
	const turns = solve.smart_turn_count;
	const seconds = solve.raw_time;
	if (!turns || !seconds || seconds <= 0) return null;
	return turns / seconds;
}
