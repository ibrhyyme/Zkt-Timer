import algorithms from '../../../../../util/algorithms/algorithms';
import { caseSetTarget } from '../case_set_target';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const library = require('../../../../../../public/trainer/default-algs.json') as Record<
	string,
	{ algorithms: { name: string; algorithm: string }[] }[]
>;

function libraryHas(category: string, name: string): boolean {
	return (library[category] || []).some((sub) => sub.algorithms.some((a) => a.name === name && !!a.algorithm));
}

// Same caseName the caseStats resolver returns (lookupCaseName).
function serverCaseName(entry: { name?: string; category?: string }, caseKey: string): string {
	const name = entry.name || caseKey;
	return entry.category ? `${entry.category} ${name}` : name;
}

describe('caseSetTarget', () => {
	it('maps OLL keys and PLL names to library case names', () => {
		expect(caseSetTarget('oll', '333_oll_12', 'Awkward Shape 12')).toEqual({ category: 'OLL', name: 'OLL 12' });
		expect(caseSetTarget('pll', '333_pll_19', 'J-Perm (b)')).toEqual({ category: 'PLL', name: 'Jb perm' });
		expect(caseSetTarget('pll', '333_pll_17', 'T-Perm')).toEqual({ category: 'PLL', name: 'T perm' });
	});

	it('returns null for keys it cannot read', () => {
		expect(caseSetTarget('oll', '', '')).toBeNull();
		expect(caseSetTarget('pll', '333_pll_x', 'Unknown')).toBeNull();
	});

	it.each(['oll', 'pll'] as const)('reaches a library case for every 3x3 %s case the stats can report', (type) => {
		const entries = (algorithms as any)[`3_${type}`] as Record<string, { name?: string; category?: string }>;
		const keys = Object.keys(entries);
		expect(keys.length).toBeGreaterThan(20);
		for (const caseKey of keys) {
			const target = caseSetTarget(type, caseKey, serverCaseName(entries[caseKey], caseKey));
			expect({ caseKey, found: !!target && libraryHas(target.category, target.name) }).toEqual({ caseKey, found: true });
		}
	});
});
