import {SolveMethodStep} from '../../../@types/generated/graphql';
import {Solve} from '../../../../server/schemas/Solve.schema';
import {getTimeString} from '../../../util/time';
import {STEP_NAME_MAP} from './consts';

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

/** One step of a smart solve, split for the Overview tab's stacked column. */
export interface StepTimeBar {
	key: string;
	name: string;
	/** The name under the column: wraps after "F2L", never between "Slot" and its number. */
	axisName: string;
	total: number;
	recognition: number;
	execution: number;
	recognitionLabel: string;
	executionLabel: string;
	turns: number;
	tps: number | null;
}

// Below this a time prints as 0.00, which says nothing inside a coloured block.
const MIN_PRINTED_SECONDS = 0.01;

/**
 * A time short enough to sit inside a narrow column: at most four characters for anything
 * under ten minutes, up to nine columns across a phone.
 */
export function formatBarTime(seconds: number): string {
	if (seconds < 10) return getTimeString(seconds, 2);
	if (seconds < 60) return getTimeString(seconds, 1);
	return getTimeString(seconds, 0);
}

export interface TimeAxis {
	/** The axis top, at or above the longest time. Columns are drawn against this. */
	max: number;
	ticks: {value: number; label: string}[];
}

/** A seconds axis on round steps (1, 2 or 5 times a power of ten), from zero past the longest time. */
export function getTimeAxis(longest: number): TimeAxis {
	const rough = longest / 6;
	const magnitude = 10 ** Math.floor(Math.log10(rough));
	const scaled = rough / magnitude;
	const EPSILON = 1e-9;
	let nice = 10;
	if (scaled <= 1 + EPSILON) nice = 1;
	else if (scaled <= 2 + EPSILON) nice = 2;
	else if (scaled <= 5 + EPSILON) nice = 5;

	const step = Math.max(nice * magnitude, 0.01);
	const intervals = Math.ceil(longest / step - EPSILON);
	let decimals = 2;
	if (step >= 1) decimals = 0;
	else if (step >= 0.1) decimals = 1;

	const ticks: TimeAxis['ticks'] = [];
	for (let i = 0; i <= intervals; i++) {
		const value = Math.round(i * step * 100) / 100;
		ticks.push({value, label: getTimeString(value, decimals)});
	}
	return {max: ticks[ticks.length - 1].value, ticks};
}

/** The steps that took any time, in solve order, as the Overview chart draws them. */
export function getStepTimeBars(solve: Solve): StepTimeBar[] {
	const bars: StepTimeBar[] = [];
	for (const step of getSolveStepsWithoutParents(solve)) {
		const stepTotal = step.total_time || 0;
		const rec = step.recognition_time || 0;
		const recognition = rec >= MIN_PRINTED_SECONDS ? rec : 0;
		const remainder = Math.max(0, stepTotal - rec);
		const execution = remainder >= MIN_PRINTED_SECONDS ? remainder : 0;
		const total = recognition + execution;
		if (total === 0) continue;

		const name = STEP_NAME_MAP[step.step_name] || step.step_name;
		bars.push({
			key: step.step_name,
			name,
			axisName: name.replace(/ (?=\S+$)/, ' '),
			total,
			recognition,
			execution,
			recognitionLabel: formatBarTime(recognition),
			executionLabel: formatBarTime(execution),
			turns: step.turn_count || 0,
			tps: step.tps ?? null,
		});
	}
	return bars;
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
