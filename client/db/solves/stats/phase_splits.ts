import {fetchSolves, FilterSolvesOptions} from '../query';
import {Solve} from '../../../../server/schemas/Solve.schema';

export type PhaseKey = 'cross' | 'f2l_1' | 'f2l_2' | 'f2l_3' | 'f2l_4' | 'oll' | 'pll';

export interface PhaseAverage {
	key: PhaseKey;
	avg: number;
	sampleCount: number;
}

export interface PhaseSplitsResult {
	phases: PhaseAverage[];
	bottleneck: PhaseKey | null;
	totalSampleCount: number;
}

const PHASE_ORDER: PhaseKey[] = ['cross', 'f2l_1', 'f2l_2', 'f2l_3', 'f2l_4', 'oll', 'pll'];

function singleStepTime(steps: any[], stepName: string): number | null {
	const s = steps.find((x) => x.step_name === stepName);
	if (s?.total_time != null && s.total_time >= 0) return s.total_time;
	return null;
}

export function getAveragePhaseSplits(filter: FilterSolvesOptions): PhaseSplitsResult {
	const solves = fetchSolves({
		...filter,
		dnf: false,
		is_smart_cube: true,
		time: {$gt: 0},
	}) as Solve[];

	const buckets: Record<PhaseKey, number[]> = {
		cross: [],
		f2l_1: [],
		f2l_2: [],
		f2l_3: [],
		f2l_4: [],
		oll: [],
		pll: [],
	};

	for (const solve of solves) {
		const steps = solve.solve_method_steps;
		if (!steps || !steps.length) continue;

		for (const phase of PHASE_ORDER) {
			const t = singleStepTime(steps, phase);
			if (t != null) buckets[phase].push(t);
		}
	}

	const phases: PhaseAverage[] = PHASE_ORDER.map((key) => {
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
		totalSampleCount: solves.length,
	};
}
