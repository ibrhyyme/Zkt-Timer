import {
	getPhaseStepKeys,
	MultiPhaseMethod,
	PhaseDuration,
	sanitizePhaseLabel,
} from '../../../shared/util/solve/multiphase';

type Translate = (key: string, options?: any) => string;

/**
 * Human label for a phase step key. Named steps (cross, oll, fb, ...) resolve through
 * `multi_phase.step.<key>`; anything else, including the numbered `phase_N` keys used by
 * the generic and custom methods, falls back to "Phase N".
 */
export function getPhaseLabel(t: Translate, stepKey: string, index: number): string {
	const numbered = /^phase_(\d+)$/.exec(stepKey || '');
	if (numbered) {
		return t('multi_phase.phase_n', { n: numbered[1] });
	}

	const fullKey = `multi_phase.step.${stepKey}`;
	const translated = t(fullKey);
	// i18next echoes the key back when there is no entry for it.
	if (translated && translated !== fullKey) {
		return translated;
	}

	return t('multi_phase.phase_n', { n: index + 1 });
}

/**
 * Label for a stored phase. A label the solver wrote themselves wins over the method
 * table, since it was saved with the solve and describes what they actually timed.
 */
export function getStoredPhaseLabel(t: Translate, phase: PhaseDuration): string {
	if (phase.customLabel) {
		return phase.customLabel;
	}
	return getPhaseLabel(t, phase.stepKey, phase.index);
}

/**
 * Labels for every phase of a count/method pairing, in solve order. Used for the live
 * strip and the settings preview, where nothing has been saved yet — so custom labels
 * come from the current setting rather than from a solve.
 */
export function getPhaseLabels(
	t: Translate,
	count: number,
	method: MultiPhaseMethod,
	customLabels?: (string | null | undefined)[] | null
): string[] {
	return getPhaseStepKeys(count, method).map((key, index) => {
		if (method === 'custom') {
			const written = sanitizePhaseLabel(customLabels?.[index]);
			if (written) return written;
		}
		return getPhaseLabel(t, key, index);
	});
}
