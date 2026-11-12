import React, {useEffect} from 'react';
import {Solve} from '../../../../server/schemas/Solve.schema';
import {getSetting} from '../../../db/settings/query';
import {fetchSolves} from '../../../db/solves/query';
import {getMe} from '../../store';
import {isPro, isProEnabled} from '../../../lib/pro';
import {getTimerStore} from '../../../util/store/getTimer';
import {isCrossSolverAvailable, solveCrossAsync} from '../../../util/cross-solver/worker-manager';
import {
	allPunchIds,
	colorNeutralMode,
	isShortcutBucket,
	pickPunch,
	pickShortcut,
	pickTone,
	punchAudioPath,
	punchIosFileName,
	voiceLang,
	VoiceLang,
} from '../../../lib/shortcut_hint/pick';
import {playClip, preloadClips} from '../../../util/native-audio';
import i18n from '../../../i18n/i18n';
import ShortcutHintBadge from '../shortcut_hint/ShortcutHintBadge';
import {displayTimerContent} from './notification';
import {useEventListener} from '../../../util/event_handler';
import type {ITimerContext} from '../Timer';

/** Long enough to read a line and five or six moves; the PB badge gets 3 s for one line. */
const HOLD_MS = 6000;

/** Earlier solves the tone compares against (a rolling ao12's worth). */
const HISTORY = 12;

// Basic sees the line once a day with the moves locked, so the hint sells Pro without
// turning into an ad after every lucky scramble. Device-local on purpose: it is a nag
// limit, not state anything else reads.
const TEASER_DAY_KEY = 'zt-shortcut-hint-teaser-day';

function today(): string {
	const d = new Date();
	return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function teaserShownToday(): boolean {
	try {
		return window.localStorage.getItem(TEASER_DAY_KEY) === today();
	} catch {
		return false;
	}
}

function markTeaserShown() {
	try {
		window.localStorage.setItem(TEASER_DAY_KEY, today());
	} catch {
		// Storage blocked: the teaser may show again today. Harmless.
	}
}

function previousTimes(solve: Solve): number[] {
	const solves = fetchSolves(
		{
			session_id: solve.session_id,
			cube_type: solve.cube_type,
			scramble_subset: solve.scramble_subset ?? null,
		},
		{limit: HISTORY + 1}
	);
	return solves
		.filter((s) => s.id !== solve.id && !s.dnf)
		.slice(0, HISTORY)
		.map((s) => Number(s.time));
}

function clipFor(lang: VoiceLang, punch: string) {
	return {
		assetId: `shortcut_${lang}_${punch}`,
		webPath: punchAudioPath(lang, punch),
		iosFileName: punchIosFileName(lang, punch),
	};
}

/**
 * The punch, spoken in the UI language (one ElevenLabs voice per language). Goes through
 * util/native-audio like the inspection calls: on iOS the native player that keeps the
 * user's music playing, elsewhere a pre-decoded buffer. A clip that cannot play (an iOS
 * build from before the clips were bundled) leaves the card silent.
 */
function speakPunch(punch: string) {
	const lang = voiceLang(i18n.language);
	if (!lang) return;
	const c = clipFor(lang, punch);
	void playClip(c.assetId, c.webPath, c.iosFileName);
}

/** Decodes the current language's punches ahead of time, so the first one has no wait. */
function preloadVoice() {
	const lang = voiceLang(i18n.language);
	if (!lang) return;
	preloadClips(allPunchIds().map((p) => clipFor(lang, p)));
}

/** A new attempt has begun (or is about to): the hint would only get in the way. */
function attemptUnderway(): boolean {
	return !!(
		getTimerStore('timeStartedAt') ||
		getTimerStore('inInspection') ||
		getTimerStore('solving') ||
		getTimerStore('spaceTimerStarted')
	);
}

/**
 * After a saved timer solve: if the scramble had an unusually short cross or XCross, say so
 * in the notification slot. Runs the solver worker, so it never blocks the save. Never
 * throws; a hint is not worth an error.
 */
export async function checkShortcutAfterSolve(solve: Solve): Promise<void> {
	try {
		if (typeof window === 'undefined') return;
		if (!getSetting('shortcut_hint')) return;
		if (!solve?.scramble || !isShortcutBucket(solve.cube_type, solve.scramble_subset)) return;
		if (!isCrossSolverAvailable()) return;

		// Client-side only by nature: the solver runs in the browser on a public scramble,
		// and the free cross solver module can show the same moves on request. What Pro adds
		// is the timer noticing it for you, every time.
		const full = !isProEnabled() || isPro(getMe());
		if (!full && teaserShownToday()) return;

		const mode = colorNeutralMode(getSetting('scramble_color_neutral'));
		const [cross, xcross] = await Promise.all([
			solveCrossAsync(solve.scramble, 'cross'),
			solveCrossAsync(solve.scramble, 'xcross'),
		]);

		const finding = pickShortcut(cross, xcross, mode);
		if (!finding) return;

		// A PB badge (or any other notice) is already up: it wins. Same when the next
		// attempt has started while the solver worked.
		if (getTimerStore('notification') || attemptUnderway()) return;

		const tone = pickTone({time: Number(solve.time), dnf: solve.dnf}, previousTimes(solve));
		const punch = pickPunch(tone);
		displayTimerContent(<ShortcutHintBadge finding={finding} punch={punch} full={full} />, HOLD_MS);
		// The voice is Pro's own: the Basic teaser shows the card silently (owner, 2026-11-12).
		if (full && punch && getSetting('shortcut_hint_voice')) speakPunch(punch);

		if (!full) markTeaserShown();
	} catch {
		// Worker failed or the store is gone (page left): stay silent.
	}
}

/**
 * Hooks the hint to the timer page: every saved solve (solveSavedEvent, emitted by
 * saveSolve) is checked, except where the timer is not the user's own practice. Rooms and
 * battles hand solves to onSolve and have result screens of their own; a timer inside a
 * modal has no room for the card. Warm-up solves never emit the event.
 */
export function useShortcutHint(context: ITimerContext) {
	const skip = !!context.onSolve || !!context.matchMode || !!context.inModal || !!context.ignorePbEvents;

	// Only a 3x3 timer page with the hint and its voice on pays for decoding the clips.
	const want =
		!skip &&
		isShortcutBucket(context.cubeType, context.scrambleSubset) &&
		!!getSetting('shortcut_hint') &&
		!!getSetting('shortcut_hint_voice');
	useEffect(() => {
		if (want) preloadVoice();
	}, [want, i18n.language]);

	useEventListener(
		'solveSavedEvent',
		(solve) => {
			if (!skip) void checkShortcutAfterSolve(solve);
		},
		[skip]
	);
}
