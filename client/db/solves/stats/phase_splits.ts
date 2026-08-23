import {fetchSolves, FilterSolvesOptions} from '../query';
import {Solve} from '../../../../server/schemas/Solve.schema';
import {getMethod} from '../../../../shared/util/solve/methods';
import {SolveMethod} from '../../../../shared/util/solve/types';

export type PhaseKey = string;

export interface PhaseAverage {
	key: PhaseKey;
	avg: number;
	sampleCount: number;
}

export interface PhaseSplitsResult {
	phases: PhaseAverage[];
	bottleneck: PhaseKey | null;
	/** Solves that were actually performed with this method. */
	totalSampleCount: number;
	/** Method whose ladder the phases belong to. */
	method: SolveMethod;
}

/**
 * CFOP is reported at slot granularity (four F2L rows) rather than the
 * aggregated `f2l` parent row, which is what the stats page has always shown.
 */
const CFOP_DISPLAY_STEPS = ['cross', 'f2l_1', 'f2l_2', 'f2l_3', 'f2l_4', 'oll', 'pll'];

function displaySteps(method: SolveMethod): string[] {
	if (method === 'cfop') return CFOP_DISPLAY_STEPS;
	return getMethod(method).steps;
}

function singleStepTime(steps: any[], stepName: string): number | null {
	const s = steps.find((x) => x.step_name === stepName);
	if (s?.total_time != null && s.total_time >= 0) return s.total_time;
	return null;
}

export function getAveragePhaseSplits(
	filter: FilterSolvesOptions,
	lastN?: number | null,
	method: SolveMethod = 'cfop'
): PhaseSplitsResult {
	const solves = fetchSolves({
		...filter,
		dnf: false,
		is_smart_cube: true,
		time: {$gt: 0},
	}, lastN ? { limit: lastN } : undefined) as Solve[];

	const order = displaySteps(method);
	const buckets: Record<PhaseKey, number[]> = {};
	for (const key of order) buckets[key] = [];

	let matchedCount = 0;
	for (const solve of solves) {
		const steps = solve.solve_method_steps;
		if (!steps || !steps.length) continue;

		// A solve was performed with one method; that is a fact about the solve,
		// not a viewing preference. Re-reading a CFOP solve through the Roux ladder
		// would invent steps the solver never did, so only solves actually done
		// with this method contribute to its averages.
		const rowMethod = (steps[0] as any)?.method_name || 'cfop';
		if (rowMethod !== method) continue;
		matchedCount++;

		for (const phase of order) {
			const t = singleStepTime(steps, phase);
			if (t != null) buckets[phase].push(t);
		}
	}

	const phases: PhaseAverage[] = order.map((key) => {
		const arr = buckets[key];
		const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
		return {key, avg, sampleCount: arr.length};
	});

	const valid = phases.filter((p) => p.sampleCount > 0);
	const bottleneck = valid.length
		? valid.reduce((max, p) => (p.avg > max.avg ? p : max), valid[0]).key
		: null;

	return {
		phases,
		bottleneck,
		totalSampleCount: matchedCount,
		method,
	};
}
