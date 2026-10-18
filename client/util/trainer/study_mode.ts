/**
 * Study mode of the Algorithm Trainer (trainer-sets design 2.3): Standard or Smart Cube.
 *
 * The mode belongs to the study session, not to a set: the same set runs in both. Smart Cube is a
 * Pro feature. The real lock sits at the point of consumption (TrainingArea only turns cube
 * tracking on for Pro), this rule only keeps a Basic user out of the Smart mode UI: a shared link
 * with `?mode=smart` or a `lastMode` synced from a lapsed subscription opens Standard, quietly.
 *
 * Pure and React free so the rules are testable in node.
 */
import type {StudyMode} from '../../components/trainer/types';

export const STUDY_MODES: readonly StudyMode[] = ['standard', 'smart'];

export function isStudyMode(value: unknown): value is StudyMode {
	return value === 'standard' || value === 'smart';
}

/** `?mode=smart` / `?mode=standard` from a search string; anything else is "not set". */
export function parseStudyModeParam(search: string | null | undefined): StudyMode | null {
	if (!search) return null;
	const raw = new URLSearchParams(search).get('mode');
	return isStudyMode(raw) ? raw : null;
}

/** Smart Cube mode is open when Pro gating is off for this build, or the user is Pro or Premium. */
export function smartModeAllowed(proEnabled: boolean, userIsPro: boolean): boolean {
	return !proEnabled || userIsPro;
}

/**
 * The mode to open with: the one asked for (URL), else the remembered one (`lastMode`), else
 * Standard. Smart falls back to Standard when it is locked.
 */
export function resolveStudyMode(
	requested: StudyMode | null | undefined,
	remembered: StudyMode | null | undefined,
	smartAllowed: boolean
): StudyMode {
	const wanted: StudyMode = requested ?? remembered ?? 'standard';
	return wanted === 'smart' && !smartAllowed ? 'standard' : wanted;
}
