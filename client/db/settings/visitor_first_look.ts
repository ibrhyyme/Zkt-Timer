import type {AllSettings} from './query';

/**
 * What a visitor without an account sees on their first look at the timer (owner,
 * 2026-11-04): the Kuzey Işığı background, moving in the theme's colours, so the first visit
 * shows what the timer can look like instead of a plain page.
 *
 * Applied once per browser. The visitor's stored settings cannot tell "never picked a
 * background" from "picked none" (a first visit writes every default), so a marker records
 * that it ran: a visitor who switches it off afterwards keeps it off, and one who already
 * chose a background keeps theirs.
 */
export const VISITOR_FIRST_LOOK_MARKER = 'visitor_first_look_v1';

export const VISITOR_FIRST_LOOK_BACKGROUND = 'aurora';

/** The settings to write for this visitor's first look; empty when there is nothing to change. */
export function visitorFirstLookPatch(stored: Partial<AllSettings> | null | undefined): Partial<AllSettings> {
	const current = stored?.timer_bg_preset;
	if (typeof current === 'string' && current) return {};
	return {timer_bg_preset: VISITOR_FIRST_LOOK_BACKGROUND};
}
