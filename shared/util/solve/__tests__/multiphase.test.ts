import {
	getPhaseDurations,
	getPhaseStepKeys,
	getSlowestPhaseIndex,
	isMultiPhaseActive,
	MULTI_PHASE_LABEL_MAX_LENGTH,
	MULTI_PHASE_METHODS,
	parsePhaseSplits,
	sanitizePhaseLabel,
	sanitizePhaseLabels,
	serializePhaseSplits,
} from '../multiphase';

describe('isMultiPhaseActive', () => {
	it('treats a single phase as off', () => {
		expect(isMultiPhaseActive(1)).toBe(false);
		expect(isMultiPhaseActive(0)).toBe(false);
		expect(isMultiPhaseActive(null)).toBe(false);
		expect(isMultiPhaseActive(undefined)).toBe(false);
	});

	it('accepts 2 through 6', () => {
		expect(isMultiPhaseActive(2)).toBe(true);
		expect(isMultiPhaseActive(6)).toBe(true);
	});

	it('rejects counts above the maximum', () => {
		expect(isMultiPhaseActive(7)).toBe(false);
	});
});

describe('getPhaseStepKeys', () => {
	it('returns the named CFOP layout', () => {
		expect(getPhaseStepKeys(4, 'cfop')).toEqual(['cross', 'f2l', 'oll', 'pll']);
	});

	it('returns the named Roux layout', () => {
		expect(getPhaseStepKeys(4, 'roux')).toEqual(['fb', 'sb', 'cmll', 'lse']);
	});

	it('falls back to numbered phases for the generic method', () => {
		expect(getPhaseStepKeys(3, 'generic')).toEqual(['phase_1', 'phase_2', 'phase_3']);
	});

	it('falls back to numbered phases when a count has no named layout', () => {
		// Nothing is defined for a single phase, so numbering takes over.
		expect(getPhaseStepKeys(1, 'cfop')).toEqual(['phase_1']);
	});

	it('splits the last layer, not F2L, for two-look CFOP', () => {
		// The whole point of the two-look layout: six presses subdivide LL.
		expect(getPhaseStepKeys(6, 'cfop2look')).toEqual(['cross', 'f2l', 'eoll', 'ocll', 'cpll', 'epll']);
		// Plain CFOP at the same count subdivides F2L instead.
		expect(getPhaseStepKeys(6, 'cfop')).toEqual(['cross', 'f2l_1', 'f2l_2', 'f2l_3', 'f2l_4', 'll']);
	});

	it('returns the named Petrus layout', () => {
		expect(getPhaseStepKeys(6, 'petrus')).toEqual([
			'block_222', 'block_223', 'eo', 'f2l_finish', 'ocll', 'pll',
		]);
	});

	it('falls back to numbered phases for the custom method', () => {
		// Custom labels live on the solve, not in the layout table.
		expect(getPhaseStepKeys(3, 'custom')).toEqual(['phase_1', 'phase_2', 'phase_3']);
	});

	it('always returns exactly `count` keys for every method', () => {
		for (const method of MULTI_PHASE_METHODS) {
			for (let count = 2; count <= 6; count++) {
				expect(getPhaseStepKeys(count, method)).toHaveLength(count);
			}
		}
	});
});

describe('sanitizePhaseLabel', () => {
	it('strips the characters used as storage delimiters', () => {
		expect(sanitizePhaseLabel('a;b]c[d:e,f')).toBe('a b c d e f');
	});

	it('trims to the maximum length', () => {
		const long = 'x'.repeat(MULTI_PHASE_LABEL_MAX_LENGTH + 10);
		expect(sanitizePhaseLabel(long)).toHaveLength(MULTI_PHASE_LABEL_MAX_LENGTH);
	});

	it('handles empty input', () => {
		expect(sanitizePhaseLabel(null)).toBe('');
		expect(sanitizePhaseLabel('   ')).toBe('');
	});

	it('pads a label list to the requested length', () => {
		expect(sanitizePhaseLabels(['Cross'], 3)).toEqual(['Cross', '', '']);
	});
});

describe('serializePhaseSplits / parsePhaseSplits', () => {
	it('round-trips splits with the method attached', () => {
		const serialized = serializePhaseSplits([3210, 8230, 10340], 'cfop');
		expect(serialized).toBe('cfop:3210,8230,10340');

		const parsed = parsePhaseSplits(serialized);
		expect(parsed).toEqual({ method: 'cfop', cumulativeMs: [3210, 8230, 10340] });
	});

	it('returns null for an empty split list', () => {
		expect(serializePhaseSplits([], 'cfop')).toBeNull();
	});

	it('returns null for missing or unusable input', () => {
		expect(parsePhaseSplits(null)).toBeNull();
		expect(parsePhaseSplits('')).toBeNull();
		expect(parsePhaseSplits('cfop:')).toBeNull();
	});

	it('reads a bare list without a method prefix as generic', () => {
		expect(parsePhaseSplits('1000,2000')).toEqual({ method: 'generic', cumulativeMs: [1000, 2000] });
	});

	it('falls back to generic for an unknown method', () => {
		// A method a future version might add, read back by today's build.
		expect(parsePhaseSplits('mehta:1000')).toEqual({ method: 'generic', cumulativeMs: [1000] });
	});

	it('sorts an out-of-order payload', () => {
		expect(parsePhaseSplits('cfop:5000,2000')?.cumulativeMs).toEqual([2000, 5000]);
	});

	it('round-trips custom labels', () => {
		const serialized = serializePhaseSplits([1000, 2000], 'custom', ['Blocks', 'EO', 'Finish']);
		expect(serialized).toBe('custom[Blocks;EO;Finish]:1000,2000');

		const parsed = parsePhaseSplits(serialized);
		expect(parsed?.method).toBe('custom');
		expect(parsed?.customLabels).toEqual(['Blocks', 'EO', 'Finish']);
		expect(parsed?.cumulativeMs).toEqual([1000, 2000]);
	});

	it('writes one custom label per phase, not per split', () => {
		// Two splits mean three phases.
		const serialized = serializePhaseSplits([1000, 2000], 'custom', ['A', 'B', 'C', 'D']);
		expect(serialized).toBe('custom[A;B;C]:1000,2000');
	});

	it('keeps a delimiter typed into a label from corrupting the payload', () => {
		const serialized = serializePhaseSplits([1000], 'custom', ['we;ird]', 'ok']);
		expect(serialized).toBe('custom[we ird;ok]:1000');
		expect(parsePhaseSplits(serialized)?.customLabels).toEqual(['we ird', 'ok']);
	});

	it('degrades to generic when no custom label was filled in', () => {
		expect(serializePhaseSplits([1000, 2000], 'custom', ['', ''])).toBe('generic:1000,2000');
		expect(serializePhaseSplits([1000], 'custom', null)).toBe('generic:1000');
	});
});

describe('getPhaseDurations', () => {
	it('expands cumulative splits into per-phase durations', () => {
		const durations = getPhaseDurations('cfop:3000,8000,10000', 12);

		expect(durations.map((d) => d.stepKey)).toEqual(['cross', 'f2l', 'oll', 'pll']);
		expect(durations.map((d) => d.durationSec)).toEqual([3, 5, 2, 2]);
		expect(durations.map((d) => d.cumulativeSec)).toEqual([3, 8, 10, 12]);
	});

	it('closes the last phase with the solve time', () => {
		const durations = getPhaseDurations('cfop:4000', 10);
		expect(durations).toHaveLength(2);
		expect(durations[1].durationSec).toBe(6);
	});

	it('computes each phase share of the solve', () => {
		const durations = getPhaseDurations('cfop:5000', 10);
		expect(durations[0].share).toBe(0.5);
		expect(durations[1].share).toBe(0.5);
	});

	it('drops splits that land beyond the solve time', () => {
		// An edited time can end up shorter than a recorded split; a negative phase must
		// never reach the display.
		const durations = getPhaseDurations('cfop:3000,20000', 10);
		expect(durations).toHaveLength(2);
		expect(durations.every((d) => d.durationSec >= 0)).toBe(true);
	});

	it('returns nothing without splits', () => {
		expect(getPhaseDurations(null, 10)).toEqual([]);
		expect(getPhaseDurations('', 10)).toEqual([]);
	});

	it('carries custom labels through to each phase', () => {
		const durations = getPhaseDurations('custom[Blocks;EO;Finish]:3000,6000', 9);
		expect(durations.map((d) => d.customLabel)).toEqual(['Blocks', 'EO', 'Finish']);
		expect(durations.map((d) => d.durationSec)).toEqual([3, 3, 3]);
	});

	it('leaves the label empty where the solver wrote nothing', () => {
		const durations = getPhaseDurations('custom[Blocks;;Finish]:3000,6000', 9);
		expect(durations[1].customLabel).toBeUndefined();
		expect(durations[1].stepKey).toBe('phase_2');
	});

	it('labels a two-look solve from its stored method, not the current setting', () => {
		const durations = getPhaseDurations('cfop2look:2000,4000,5000,6000,7000', 8);
		expect(durations.map((d) => d.stepKey)).toEqual(['cross', 'f2l', 'eoll', 'ocll', 'cpll', 'epll']);
	});
});

describe('getSlowestPhaseIndex', () => {
	it('finds the longest phase', () => {
		const durations = getPhaseDurations('cfop:3000,8000,10000', 12);
		expect(getSlowestPhaseIndex(durations)).toBe(1);
	});

	it('returns -1 when there is nothing to compare', () => {
		expect(getSlowestPhaseIndex([])).toBe(-1);
		expect(getSlowestPhaseIndex(getPhaseDurations('cfop:', 10))).toBe(-1);
	});
});
