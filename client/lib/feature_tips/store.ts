// Where the device remembers which feature tips it has shown. localStorage, wrapped: a
// private window or blocked storage only means a tip may show again.

import { FeatureTipState, parseFeatureTipState } from './feature_tips';

const STORAGE_KEY = 'zt_feature_tips';

// Per page load. App remounts on every route change, the module does not, so "one tip per
// app open" survives moving between pages.
let tipShown = false;
let announcementShown = false;

export function readFeatureTipState(): FeatureTipState {
	try {
		return parseFeatureTipState(localStorage.getItem(STORAGE_KEY));
	} catch {
		return parseFeatureTipState(null);
	}
}

function writeFeatureTipState(state: FeatureTipState) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// Storage refused: nothing to keep.
	}
}

/** Answered, or the user reached the feature on their own: never shown again. */
export function markFeatureTipSeen(id: string) {
	const state = readFeatureTipState();
	if (state.seen.includes(id)) return;
	state.seen.push(id);
	writeFeatureTipState(state);
}

export function countFeatureTipView(id: string) {
	const state = readFeatureTipState();
	state.views[id] = (state.views[id] || 0) + 1;
	writeFeatureTipState(state);
}

export function featureTipShownThisLoad(): boolean {
	return tipShown;
}

export function noteFeatureTipShown() {
	tipShown = true;
}

/** The announcement window (admin news) already took this app open: the tip waits. */
export function noteAnnouncementShown() {
	announcementShown = true;
}

export function announcementShownThisLoad(): boolean {
	return announcementShown;
}
