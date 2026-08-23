import algorithms from '../../../util/algorithms/algorithms';
import { SolveMethodStep } from '../../../../server/schemas/SolveStepMethod.schema';

/** case_set value -> algorithm library key in algorithms.ts */
const CASE_SET_TO_ALG_LIBRARY: Record<string, string> = {
	oll: '3_oll',
	pll: '3_pll',
	cmll: '3_cmll',
	coll: '3_cmll', // COLL and CMLL share the same 42 corner cases
};

export const STEP_NAME_MAP = {
	full: 'Full Solution',
	inspection: 'Inspection',
	cross: 'Cross',
	f2l: 'F2L',
	oll: 'OLL',
	pll: 'PLL',
	f2l_1: 'F2L Slot 1',
	f2l_2: 'F2L Slot 2',
	f2l_3: 'F2L Slot 3',
	f2l_4: 'F2L Slot 4',
	// CFOP two-look
	eo: 'EO',
	cp: 'CP',
	// Roux
	fb: 'First Block',
	sb: 'Second Block',
	cmll: 'CMLL',
	lse: 'Last Six Edges',
	// ZZ
	eoline: 'EOLine',
	block_1: 'Block 1',
	block_2: 'Block 2',
	ll: 'Last Layer',
};

// OLL/PLL step'lerinde case adini ekleyerek step adini hesaplar.
// Diger step'ler (cross, f2l, ...) STEP_NAME_MAP'ten dogrudan gelir.
// Hem ReplayPlayer phase indicator'i hem SolutionInfo tablosu kullanir.
export function getStepDisplayName(step: SolveMethodStep): string {
	const baseName = STEP_NAME_MAP[step.step_name] || step.step_name;
	if (step.step_name === 'oll' && step.oll_case_key) {
		const caseName = (algorithms as any)['3_oll']?.[step.oll_case_key]?.name;
		if (caseName) return `${baseName} ${caseName}`;
	}
	if (step.step_name === 'pll' && step.pll_case_key) {
		const caseName = (algorithms as any)['3_pll']?.[step.pll_case_key]?.name;
		if (caseName) return `${baseName} ${caseName}`;
	}
	// Method-agnostic path: newer rows carry case_set + case_key, which covers
	// CMLL and COLL as well as OLL/PLL. Falls back to the bare step name when the
	// case was not recognized (part of the CMLL set is still unmapped).
	const anyStep = step as any;
	if (anyStep.case_set && anyStep.case_key) {
		const lib = CASE_SET_TO_ALG_LIBRARY[anyStep.case_set];
		const caseName = lib ? (algorithms as any)[lib]?.[anyStep.case_key]?.name : null;
		if (caseName) return `${baseName} ${caseName}`;
		// Cases outside our algorithm library carry their standard name as the key
		// (H-1, Pi-3, ...), which is still what a solver wants to read.
		if (!anyStep.case_key.startsWith('333_')) return `${baseName} ${anyStep.case_key}`;
	}
	return baseName;
}
