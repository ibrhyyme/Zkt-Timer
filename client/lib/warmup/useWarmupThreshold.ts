import { setSetting } from '../../db/settings/update';
import { useSettings } from '../../util/hooks/useSettings';
import { getCubeTypeInfoById } from '../../util/cubes/util';
import { convertTimeStringToSeconds, getTimeString } from '../../util/time';
import { getWarmupThreshold, withWarmupThreshold } from './auto_save';

/**
 * Reads a typed threshold. Seconds as typed: "13" is 13 seconds, not the period-less 0.13 of
 * manual entry; "1:05.20" works too. Empty clears the threshold (null); anything unreadable,
 * a DNF, a +2 or zero is refused (undefined) and the stored value stays.
 */
export function parseWarmupThresholdInput(text: string): number | null | undefined {
	const trimmed = text.trim();
	if (!trimmed) return null;

	try {
		const parsed = convertTimeStringToSeconds(trimmed, true);
		if (parsed.dnf || parsed.plusTwo || !(parsed.timeSeconds > 0)) return undefined;
		return parsed.timeSeconds;
	} catch (e) {
		return undefined;
	}
}

/**
 * The warm-up auto-save threshold of the bucket the timer is on, for the settings page and the
 * quick settings panel alike. One number cannot fit every puzzle, so each bucket has its own.
 */
export function useWarmupThreshold() {
	const mode = useSettings('warmup_auto_save');
	const thresholds = useSettings('warmup_auto_save_thresholds');
	const cubeType = useSettings('cube_type');
	const scrambleSubset = useSettings('scramble_subset');

	const threshold = getWarmupThreshold(thresholds, cubeType, scrambleSubset);
	// Same name the PB notice uses: the WCA event, not the 'wca' umbrella.
	const cubeId = cubeType === 'wca' && scrambleSubset ? scrambleSubset : cubeType;
	const cubeName = getCubeTypeInfoById(cubeId)?.name || cubeId;

	function setFromText(text: string) {
		const seconds = parseWarmupThresholdInput(text);
		if (seconds === undefined) return;
		setSetting('warmup_auto_save_thresholds', withWarmupThreshold(thresholds, cubeType, scrambleSubset, seconds));
	}

	return {
		mode,
		cubeName,
		threshold,
		text: threshold !== null ? getTimeString(threshold, 2) : '',
		setFromText,
	};
}
