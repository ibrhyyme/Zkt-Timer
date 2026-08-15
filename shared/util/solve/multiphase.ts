/**
 * Multi-phase (manual split) timing.
 *
 * On a keyboard or touch timer the solver presses space mid-solve to mark the end of a
 * phase; the timer keeps running and records the elapsed time at that press. A solve with
 * N phases carries N-1 splits, the final phase ending at the solve's own time.
 *
 * Stored on Solve.phase_splits as cumulative milliseconds measured from timer start:
 *
 *   cfop:1915,3477,5017                        preset method
 *   custom[Cross;F2L;EOLL]:1915,3477           user-written labels
 *
 * The method (or the labels themselves) travel with the data so that changing the setting
 * later never relabels solves that are already saved.
 *
 * Deliberately kept off SolveMethodStep: those rows are derived from smart cube move
 * data and are accurate to the millisecond, while a manual split also contains the
 * solver's own reaction time. Averaging both in one bucket would silently corrupt the
 * smart cube phase stats.
 */

export type MultiPhaseMethod =
	| 'cfop'
	| 'cfop2look'
	| 'roux'
	| 'zz'
	| 'petrus'
	| 'custom'
	| 'generic';

export const MULTI_PHASE_MIN_COUNT = 2;
export const MULTI_PHASE_MAX_COUNT = 6;

export const MULTI_PHASE_METHODS: MultiPhaseMethod[] = [
	'cfop',
	'cfop2look',
	'roux',
	'zz',
	'petrus',
	'custom',
	'generic',
];

/** Longest label a user may write for one phase. Keeps the live strip readable. */
export const MULTI_PHASE_LABEL_MAX_LENGTH = 12;

/**
 * Step keys per method and phase count. Each key resolves to a translation under
 * `multi_phase.step.<key>`; unknown keys fall back to a numbered phase label.
 *
 * Phase count alone does not determine the breakdown: a CFOP solver splitting six times
 * wants the four F2L pairs, while a two-look solver wants the last layer split into four.
 * That is why the method is picked separately rather than derived from the count.
 */
const PHASE_LAYOUTS: Record<MultiPhaseMethod, Record<number, string[]>> = {
	cfop: {
		2: ['f2l', 'll'],
		3: ['cross', 'f2l', 'll'],
		4: ['cross', 'f2l', 'oll', 'pll'],
		5: ['cross', 'f2l_12', 'f2l_34', 'oll', 'pll'],
		6: ['cross', 'f2l_1', 'f2l_2', 'f2l_3', 'f2l_4', 'll'],
	},
	// Two-look OLL and two-look PLL: the last layer is what gets subdivided, not F2L.
	cfop2look: {
		2: ['f2l', 'll'],
		3: ['cross', 'f2l', 'll'],
		4: ['cross', 'f2l', 'oll_2l', 'pll_2l'],
		5: ['cross', 'f2l', 'eoll', 'ocll', 'pll'],
		6: ['cross', 'f2l', 'eoll', 'ocll', 'cpll', 'epll'],
	},
	roux: {
		2: ['blocks', 'll'],
		3: ['fb', 'sb', 'll'],
		4: ['fb', 'sb', 'cmll', 'lse'],
		5: ['fb', 'sb', 'cmll', 'eolr', 'l4c'],
		6: ['fb', 'sb', 'cmll', 'eo', 'eolr', 'l4c'],
	},
	zz: {
		2: ['eoline_f2l', 'll'],
		3: ['eoline', 'f2l', 'll'],
		4: ['eoline', 'f2l', 'ocll', 'pll'],
		5: ['eoline', 'f2l_left', 'f2l_right', 'ocll', 'pll'],
		6: ['eoline', 'f2l_1', 'f2l_2', 'f2l_3', 'f2l_4', 'll'],
	},
	petrus: {
		2: ['blocks', 'll'],
		3: ['block_223', 'f2l_finish', 'll'],
		4: ['block_222', 'block_223', 'f2l_finish', 'll'],
		5: ['block_222', 'block_223', 'eo', 'f2l_finish', 'll'],
		6: ['block_222', 'block_223', 'eo', 'f2l_finish', 'ocll', 'pll'],
	},
	// Labels come from the solver, not from a table.
	custom: {},
	// Numbered phases only.
	generic: {},
};

export function isMultiPhaseMethod(value: any): value is MultiPhaseMethod {
	return MULTI_PHASE_METHODS.indexOf(value) !== -1;
}

/**
 * True when the multi-phase setting is switched on. A count of 1 (or anything below the
 * minimum) means a single phase, which is just a normal solve.
 */
export function isMultiPhaseActive(count: number | null | undefined): boolean {
	return !!count && count >= MULTI_PHASE_MIN_COUNT && count <= MULTI_PHASE_MAX_COUNT;
}

/**
 * Strips the characters the storage format uses as delimiters and trims to the maximum
 * length, so a user-written label can never corrupt the serialised payload.
 */
export function sanitizePhaseLabel(label: string | null | undefined): string {
	if (!label) return '';
	return String(label)
		.replace(/[[\];:,]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, MULTI_PHASE_LABEL_MAX_LENGTH);
}

/** Cleans a whole label list and pads/trims it to `count` entries. */
export function sanitizePhaseLabels(labels: (string | null | undefined)[] | null | undefined, count: number): string[] {
	const out: string[] = [];
	for (let i = 0; i < count; i++) {
		out.push(sanitizePhaseLabel(labels?.[i]));
	}
	return out;
}

/**
 * Step keys for a given phase count. Falls back to numbered phases whenever the method
 * has no named layout for that count.
 */
export function getPhaseStepKeys(count: number, method: MultiPhaseMethod): string[] {
	const named = PHASE_LAYOUTS[method]?.[count];
	if (named && named.length === count) {
		return named.slice();
	}

	const keys: string[] = [];
	for (let i = 1; i <= count; i++) {
		keys.push(`phase_${i}`);
	}
	return keys;
}

/**
 * Serialises splits for storage.
 *
 * `customLabels` is only written for the custom method, and only for labels the user
 * actually filled in; empty ones fall back to numbered phases at display time.
 */
export function serializePhaseSplits(
	splitsMs: number[],
	method: MultiPhaseMethod,
	customLabels?: (string | null | undefined)[] | null
): string | null {
	if (!splitsMs || !splitsMs.length) {
		return null;
	}

	const values = splitsMs
		.filter((ms) => typeof ms === 'number' && isFinite(ms) && ms >= 0)
		.map((ms) => Math.round(ms));

	if (!values.length) {
		return null;
	}

	if (method === 'custom') {
		// One label per phase, and there is always one more phase than there are splits.
		const labels = sanitizePhaseLabels(customLabels, values.length + 1);
		if (labels.some((l) => l)) {
			return `custom[${labels.join(';')}]:${values.join(',')}`;
		}
		// Nothing was filled in — store it as plain numbered phases instead.
		return `generic:${values.join(',')}`;
	}

	return `${method}:${values.join(',')}`;
}

export interface ParsedPhaseSplits {
	method: MultiPhaseMethod;
	/** Cumulative milliseconds from timer start, ascending. */
	cumulativeMs: number[];
	/** Present only for the custom method; entries may be empty strings. */
	customLabels?: string[];
}

const CUSTOM_PREFIX = /^custom\[([^\]]*)\]:(.*)$/;

export function parsePhaseSplits(raw: string | null | undefined): ParsedPhaseSplits | null {
	if (!raw || typeof raw !== 'string') {
		return null;
	}

	let method: MultiPhaseMethod = 'generic';
	let valuePart = raw;
	let customLabels: string[] | undefined;

	const customMatch = CUSTOM_PREFIX.exec(raw);
	if (customMatch) {
		method = 'custom';
		customLabels = customMatch[1].split(';').map((l) => l.trim());
		valuePart = customMatch[2];
	} else {
		const sepIndex = raw.indexOf(':');
		// A bare list without a method prefix is still readable — treat it as generic.
		if (sepIndex !== -1) {
			const methodPart = raw.slice(0, sepIndex);
			if (isMultiPhaseMethod(methodPart)) {
				method = methodPart;
			}
			valuePart = raw.slice(sepIndex + 1);
		}
	}

	const cumulativeMs: number[] = [];
	for (const chunk of valuePart.split(',')) {
		const trimmed = chunk.trim();
		if (!trimmed) continue;
		const value = Number(trimmed);
		if (!isFinite(value) || value < 0) continue;
		cumulativeMs.push(Math.round(value));
	}

	if (!cumulativeMs.length) {
		return null;
	}

	// Guard against a malformed or out-of-order payload reaching the display layer.
	cumulativeMs.sort((a, b) => a - b);

	return customLabels ? { method, cumulativeMs, customLabels } : { method, cumulativeMs };
}

export interface PhaseDuration {
	/** Translation key suffix under `multi_phase.step.` */
	stepKey: string;
	/** Label written by the solver, when the solve was recorded with the custom method. */
	customLabel?: string;
	/** 0-based position in the solve. */
	index: number;
	/** Duration of this phase alone, in seconds. */
	durationSec: number;
	/** Time elapsed from timer start to the end of this phase, in seconds. */
	cumulativeSec: number;
	/** Share of the total solve, 0-1. */
	share: number;
}

/**
 * Expands stored splits into per-phase durations.
 *
 * `totalTimeSec` must be the solve's raw time (before +2), because the splits were
 * recorded against the running timer and a penalty is not part of any phase.
 */
export function getPhaseDurations(
	raw: string | null | undefined,
	totalTimeSec: number | null | undefined
): PhaseDuration[] {
	const parsed = parsePhaseSplits(raw);
	if (!parsed) {
		return [];
	}

	const totalMs = Math.round(Math.max(0, totalTimeSec || 0) * 1000);
	// The final phase ends with the solve itself, so the solve's own time closes the list.
	// A split beyond the total (clock skew, edited time) would produce a negative phase.
	const bounds = parsed.cumulativeMs.filter((ms) => ms < totalMs);
	bounds.push(totalMs);

	const stepKeys = getPhaseStepKeys(bounds.length, parsed.method);
	const durations: PhaseDuration[] = [];

	let previous = 0;
	for (let i = 0; i < bounds.length; i++) {
		const end = bounds[i];
		const durationMs = Math.max(0, end - previous);
		const customLabel = parsed.customLabels?.[i];
		durations.push({
			stepKey: stepKeys[i],
			...(customLabel ? { customLabel } : {}),
			index: i,
			durationSec: durationMs / 1000,
			cumulativeSec: end / 1000,
			share: totalMs > 0 ? durationMs / totalMs : 0,
		});
		previous = end;
	}

	return durations;
}

/** Index of the slowest phase, or -1 when there is nothing to compare. */
export function getSlowestPhaseIndex(durations: PhaseDuration[]): number {
	if (!durations || durations.length < 2) {
		return -1;
	}

	let slowest = 0;
	for (let i = 1; i < durations.length; i++) {
		if (durations[i].durationSec > durations[slowest].durationSec) {
			slowest = i;
		}
	}
	return slowest;
}
