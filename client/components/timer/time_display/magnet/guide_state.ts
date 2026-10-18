// What the Magnet Timer shows under the digits while it is idle or inspecting (design
// .feedback/designs/magnet-cubes.md 5.6 and 5.8). Pure, so the priority table is testable
// without React or the native stream: MagnetGuide and MagnetLiveBar only draw the result.
//
// Calibration is mandatory for every cube, 3x3 included (owner decision 2026-10-05): there is
// no "skip for now" on the calibration card.
import type { MagnetStage } from '../../../../util/magnet-start/controller';
import type { MagnetCubeProfile } from '../../../../util/magnet-start/cube_profile';

/**
 * A card asks the user to do something (a real button). Shown alone: nothing else of the
 * guide competes with it.
 *   no_cubes        #2 the account has no cube at all
 *   no_puzzle_cube  #3 no cube of this puzzle
 *   no_main         #4 cubes of this puzzle, none chosen
 *   no_calibration  #5 the main cube is not calibrated on this phone model
 *   relearn         #8 the far baseline is unknown, re-learn it
 */
export type MagnetGuideCard = 'no_cubes' | 'no_puzzle_cube' | 'no_main' | 'no_calibration' | 'relearn';

export interface MagnetGuideView {
	card: MagnetGuideCard | null;
	/** One instruction line (an i18n key) when there is no card. */
	line: string | null;
	/** #7 the phone seems to be in the hand: the line carries the small phone drawing. */
	moving: boolean;
	/** Hold to stop is taught once, on the idle screen after the first Magnet solve. */
	holdHint: boolean;
}

export interface MagnetGuideInput {
	profile: MagnetCubeProfile | null;
	/** The native stream is running. */
	active: boolean;
	stage: MagnetStage;
	moving: boolean;
	/** The first solve started by lifting the cube happened (routine lines go quiet after it). */
	introDone: boolean;
	holdHintSeen: boolean;
	/**
	 * False during inspection: the mobile touch overlay covers the page then, so no button
	 * drawn here could be reached, and re-learning needs the cube away from the phone.
	 */
	canAct: boolean;
}

const NONE: MagnetGuideView = { card: null, line: null, moving: false, holdHint: false };

// Stages that only ever speak until the first successful Magnet solve.
const INTRO_ONLY: Partial<Record<MagnetStage, string>> = {
	far: 'time_display.magnet_far',
	ready_inspection: 'time_display.magnet_ready_inspection',
	ready_solve: 'time_display.magnet_ready_solve',
};

// Stages that always speak. 'dwelling' and 'resting' have no text: the colour of the digits and
// of the live bar says it (zero friction, the memory note on routine instructions).
const ALWAYS: Partial<Record<MagnetStage, string>> = {
	unsupported: 'time_display.magnet_unsupported',
	closer: 'time_display.magnet_closer',
	not_armed: 'time_display.magnet_not_armed',
	inspection_waiting: 'time_display.magnet_inspection_waiting',
};

/**
 * The guide's priority table (5.6, #2 to #13). The upper row wins and hides the ones below.
 * #1 (not Pro) never reaches here: without Pro the selection runs as the touch timer and
 * the status store carries no profile.
 */
export function magnetGuideView(input: MagnetGuideInput): MagnetGuideView {
	const { profile, active, stage, moving, introDone, holdHintSeen, canAct } = input;
	if (!profile || profile.status === 'loading') return NONE;

	switch (profile.status) {
		case 'no_puzzle':
			return { ...NONE, line: 'magnet_guide.no_puzzle' };
		case 'no_cubes':
		case 'no_puzzle_cube':
		case 'no_main':
		case 'no_calibration':
			// A card needs its button; during inspection (no button reachable) nothing is shown.
			// The profile is frozen during inspection anyway, so this is a corner case.
			return canAct ? { ...NONE, card: profile.status } : NONE;
		default:
			break;
	}

	// ready: the detector runs. Nothing to say while the stream is starting.
	if (!active || stage === 'off' || stage === 'solving') return NONE;

	if (stage === 'unsupported') return { ...NONE, line: ALWAYS.unsupported as string };

	if (moving) return { ...NONE, line: 'magnet_guide.moving', moving: true };

	if (stage === 'unknown') {
		if (canAct) return { ...NONE, card: 'relearn' };
		return { ...NONE, line: 'time_display.magnet_unknown' };
	}

	let line: string | null = ALWAYS[stage] ?? null;
	if (!line && !introDone) line = INTRO_ONLY[stage] ?? null;

	const holdHint = introDone && !holdHintSeen && canAct;
	return { ...NONE, line, holdHint };
}

/**
 * Whether the live bar draws a value (5.8): the detector runs on a calibrated cube and the
 * reading means something. Hidden while the baseline is unknown (the relearn card stands in),
 * while the phone is in the hand (the field turns with the phone, not with the cube) and on a
 * sensor too slow to use.
 */
export function liveBarShowsValue(input: Pick<MagnetGuideInput, 'profile' | 'active' | 'stage' | 'moving'>): boolean {
	const { profile, active, stage, moving } = input;
	if (!profile || profile.status !== 'ready') return false;
	if (!active || moving) return false;
	return stage !== 'off' && stage !== 'unknown' && stage !== 'unsupported' && stage !== 'solving';
}

/** Fill of the bar, 0..1, from the detector's own |B - F| reading (the value detection uses). */
export function liveBarFraction(delta: number | null | undefined, scaleUt: number | null | undefined): number {
	if (typeof delta !== 'number' || !Number.isFinite(delta) || !scaleUt || scaleUt <= 0) return 0;
	return Math.min(Math.max(delta / scaleUt, 0), 1);
}

/** Where the "ready" line sits on the bar, 0..1: the detector's near threshold. */
export function liveBarTarget(nearMin: number | null | undefined, scaleUt: number | null | undefined): number | null {
	if (!nearMin || !scaleUt || scaleUt <= 0) return null;
	return Math.min(Math.max(nearMin / scaleUt, 0), 1);
}

/** Display smoothing per packet (5.8, alpha 0.4). Detection never sees it. */
export const LIVE_BAR_ALPHA = 0.4;

export function smoothLiveBar(previous: number | null, next: number, alpha: number = LIVE_BAR_ALPHA): number {
	if (previous === null || !Number.isFinite(previous)) return next;
	return previous + alpha * (next - previous);
}
