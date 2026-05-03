import algorithms from '../../../util/algorithms/algorithms';
import { SolveMethodStep } from '../../../../server/schemas/SolveStepMethod.schema';

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
	return baseName;
}
