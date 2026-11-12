import {SolverResult} from '../../util/cross-solver/types';

/**
 * "Kısa yol vardı": after a 3x3 solve, did the scramble hide an unusually short cross or
 * XCross? Pure decisions only, so they can be tested without the solver worker; the glue
 * that runs the worker and shows the badge is in run.tsx.
 */

export type ShortcutStep = 'cross' | 'xcross';
export type ShortcutTone = 'missed' | 'spotted' | 'dnf' | 'plain';
export type ColorNeutralMode = 'none' | 'dual' | 'six';

export interface ShortcutFinding {
	step: ShortcutStep;
	/** Solver face letter (cstimer: the face the cross is built on, scramble orientation). */
	face: string;
	/** Rotation plus moves, ready to show: "z2 R U' F D". */
	moves: string;
	moveCount: number;
}

/**
 * The faces the user may start from. WCA scrambles are applied white top, green front, so
 * the solver's U face is white. Without colour neutral training we assume a white cross;
 * 'dual' adds yellow, 'six' takes every face (the same pools as scramble_transform.ts).
 */
export const FACES_BY_MODE: Record<ColorNeutralMode, readonly string[]> = {
	none: ['U'],
	dual: ['U', 'D'],
	six: ['U', 'D', 'F', 'B', 'R', 'L'],
};

/**
 * The longest cross and XCross that still count as a shortcut, per face pool.
 *
 * Measured on 2000 random-state scrambles (2026-11-12), share of scrambles whose optimal
 * solution on the pool's best face is at most N moves:
 *
 *   cross    1 face: <=3 0.9%  <=4 5.2%   2 faces: <=3 1.8%  <=4 10.3%   6 faces: <=3 5.5%  <=4 29%
 *   xcross   1 face: <=5 1.6%  <=6 10.2%  2 faces: <=5 2.6%  <=6 19.3%   6 faces: <=4 1.3%  <=5 6.9%
 *
 * Each pair keeps the hint to roughly one solve in 15 to 25. Loosen it and the hint turns
 * into noise that comes up every few solves; a shortcut is only funny while it is rare.
 */
export const SHORTCUT_LIMITS: Record<ColorNeutralMode, {cross: number; xcross: number}> = {
	none: {cross: 4, xcross: 5},
	dual: {cross: 3, xcross: 5},
	six: {cross: 3, xcross: 4},
};

export function colorNeutralMode(value: unknown): ColorNeutralMode {
	return value === 'dual' || value === 'six' ? value : 'none';
}

/**
 * The 3x3 buckets whose scrambles are random-state full scrambles, where a cross is still to
 * be found. Last layer, F2L and generator subsets either start with the cross solved or
 * cannot reach a normal cross, and blindfolded, FMC and mirror are not solved with one.
 */
export function isShortcutBucket(cubeType: string | null | undefined, subset: string | null | undefined): boolean {
	if (cubeType === 'wca') return subset === '333';
	if (cubeType === '333') return !subset || subset === '333o' || subset === '333oh';
	return false;
}

function formatMoves(result: SolverResult): string {
	return [result.rotation, ...result.solution.map((m) => m.trim())].filter(Boolean).join(' ');
}

function bestWithin(results: SolverResult[], faces: readonly string[], limit: number): SolverResult | null {
	let best: SolverResult | null = null;
	// Faces in pool order, so on a tie the white cross wins over a less likely colour.
	for (const face of faces) {
		const r = results.find((x) => x.face === face);
		// A count of 0 is a solved cross (or a solver miss): never a shortcut worth a word.
		if (!r || r.moveCount <= 0 || r.moveCount > limit) continue;
		if (!best || r.moveCount < best.moveCount) best = r;
	}
	return best;
}

/**
 * The shortcut to tell the user about, or null. An XCross beats a cross: it is the rarer and
 * the more useful find (a cross plus a pair in one go).
 */
export function pickShortcut(
	cross: SolverResult[],
	xcross: SolverResult[],
	mode: ColorNeutralMode
): ShortcutFinding | null {
	const faces = FACES_BY_MODE[mode];
	const limits = SHORTCUT_LIMITS[mode];

	const x = bestWithin(xcross, faces, limits.xcross);
	if (x) return {step: 'xcross', face: x.face, moves: formatMoves(x), moveCount: x.moveCount};

	const c = bestWithin(cross, faces, limits.cross);
	if (c) return {step: 'cross', face: c.face, moves: formatMoves(c), moveCount: c.moveCount};

	return null;
}

/** Below this many earlier solves there is no "usual" to compare with. */
export const MIN_HISTORY = 5;

/**
 * How the line teases. Faster than the user's recent mean: they probably saw it. Slower:
 * they missed it. The mean is of earlier non-DNF times only, so one bad solve does not
 * move the bar.
 */
export function pickTone(solve: {time: number; dnf?: boolean}, previousTimes: number[]): ShortcutTone {
	if (solve.dnf || solve.time < 0) return 'dnf';
	const times = previousTimes.filter((t) => Number.isFinite(t) && t > 0);
	if (times.length < MIN_HISTORY) return 'plain';
	const mean = times.reduce((sum, t) => sum + t, 0) / times.length;
	return solve.time < mean ? 'spotted' : 'missed';
}

/**
 * The card reads "<fact> <punch>": the fact (shortcut_hint.fact) carries the move count and
 * the step, the punch (shortcut_hint.punch.<tone>_<n>) is the tease. Only the punch is
 * spoken, so one recording per punch covers every count and step. 'plain' (no history to
 * judge by) has no punch and stays silent.
 */
export const PUNCH_VARIANTS: Record<ShortcutTone, number> = {
	missed: 3,
	spotted: 2,
	dnf: 2,
	plain: 0,
};

/** "missed_2" and the like, or null for a tone without a punch. */
export function pickPunch(tone: ShortcutTone, random: () => number = Math.random): string | null {
	const count = PUNCH_VARIANTS[tone];
	if (count === 0) return null;
	const n = Math.min(count, Math.floor(random() * count) + 1);
	return `${tone}_${n}`;
}

/** Every punch id, in recording order (public/audio/shortcut/<lang>/<id>.mp3). */
export function allPunchIds(): string[] {
	const ids: string[] = [];
	for (const [tone, count] of Object.entries(PUNCH_VARIANTS)) {
		for (let n = 1; n <= count; n++) ids.push(`${tone}_${n}`);
	}
	return ids;
}

/** The languages the punches are recorded in; the UI languages, same list as i18n. */
export const VOICE_LANGS = ['tr', 'en', 'es', 'ru', 'zh'] as const;
export type VoiceLang = (typeof VOICE_LANGS)[number];

/** i18n language ("en-US", "zh-CN") to a recorded language, or null when there is none. */
export function voiceLang(language: string | null | undefined): VoiceLang | null {
	const base = (language || '').toLowerCase().split(/[-_]/)[0];
	return (VOICE_LANGS as readonly string[]).includes(base) ? (base as VoiceLang) : null;
}

export function punchAudioPath(lang: VoiceLang, punch: string): string {
	return `audio/shortcut/${lang}/${punch}.mp3`;
}

/**
 * The same clip in the iOS app bundle: flat, in ios/App/App/audio/ (the native plugin
 * looks a name up there, without subfolders). Kept byte-identical to the web copy.
 */
export function punchIosFileName(lang: VoiceLang, punch: string): string {
	return `shortcut_${lang}_${punch}`;
}
