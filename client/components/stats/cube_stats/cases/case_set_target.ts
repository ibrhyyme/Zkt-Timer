/**
 * Maps a Vakalar row to its trainer library case, so the row can go into an algorithm set.
 *
 * Case stats are keyed by algorithms.ts (`333_oll_12`, name "J-Perm (b)"), the trainer library
 * and algorithm sets by `category::case_name` ("OLL::OLL 12", "PLL::Jb perm").
 */
import { pllNameFromCaseName } from './pll_arrow_data';

export interface CaseSetTarget {
	category: 'OLL' | 'PLL';
	name: string;
}

export function caseSetTarget(type: 'oll' | 'pll', caseKey: string, caseName: string): CaseSetTarget | null {
	if (type === 'oll') {
		const m = (caseKey || '').match(/_oll_(\d+)$/);
		return m ? { category: 'OLL', name: `OLL ${m[1]}` } : null;
	}
	const key = pllNameFromCaseName(caseName || '');
	return key ? { category: 'PLL', name: `${key} perm` } : null;
}
