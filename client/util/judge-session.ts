// What this device remembers about the member's judging, so the entry card is
// back on screen after the app was closed or crashed:
//
// - the last `me` answer per competition (competition-cache, per account,
//   dropped on logout): the card can be drawn before the network answers, or
//   without it;
// - a marker "this account is judging at competition X". Android reopens the app
//   on /timer after the WebView dies, and the marker is how it finds the card.
//
// Authority stays on the site: the marker only says where to look. The grant
// row there decides whether the judge may still enter anything.

import {Capacitor} from '@capacitor/core';
import {isNative} from './platform';
import {fetchJudgeMe} from './judge-api';
import {peekCached, storeCached, userScoped} from '../components/community/competition-cache';
import {JudgeMe} from '../../shared/zkt_judge';

const MARKER_KEY = 'zkt_judge_active_v1';
// A grant lasts at most this long on the site.
const MARKER_MAX_AGE_MS = 12 * 60 * 60 * 1000;

interface JudgeMarker {
	competitionId: string;
	userId: string;
	at: number;
}

const meKey = (competitionId: string) => userScoped(`judge-me:${competitionId}`);

/** The last answer seen on this device, however old. */
export function peekJudgeMe(competitionId: string): JudgeMe | null {
	return peekCached<JudgeMe>(meKey(competitionId))?.data || null;
}

export function rememberJudgeMe(competitionId: string, userId: string | null, me: JudgeMe): void {
	storeCached(meKey(competitionId), me, 'local');
	if (!userId) return;
	if (me.enabled && (me.cards?.length || 0) > 0) writeMarker({competitionId, userId, at: Date.now()});
	else clearMarkerFor(competitionId);
}

export function judgePath(competitionId: string, cardId?: string | null): string {
	return `/competitions/${competitionId}/judge${cardId ? `?card=${encodeURIComponent(cardId)}` : ''}`;
}

function preferencesAvailable(): boolean {
	return isNative() && Capacitor.isPluginAvailable('Preferences');
}

function writeMarker(marker: JudgeMarker): void {
	const raw = JSON.stringify(marker);
	try {
		localStorage.setItem(MARKER_KEY, raw);
	} catch {
		// Preferences below still holds it on native.
	}
	if (preferencesAvailable()) {
		import('@capacitor/preferences').then(({Preferences}) => Preferences.set({key: MARKER_KEY, value: raw})).catch(() => {});
	}
}

function clearMarkerFor(competitionId: string): void {
	try {
		const current = parseMarker(localStorage.getItem(MARKER_KEY));
		if (current && current.competitionId !== competitionId) return;
		localStorage.removeItem(MARKER_KEY);
	} catch {
		// ignore
	}
	if (preferencesAvailable()) {
		import('@capacitor/preferences').then(({Preferences}) => Preferences.remove({key: MARKER_KEY})).catch(() => {});
	}
}

function parseMarker(raw: string | null | undefined): JudgeMarker | null {
	try {
		const marker = raw ? JSON.parse(raw) : null;
		return marker && typeof marker.competitionId === 'string' && typeof marker.userId === 'string' ? marker : null;
	} catch {
		return null;
	}
}

async function readMarker(): Promise<JudgeMarker | null> {
	let marker: JudgeMarker | null = null;
	try {
		marker = parseMarker(localStorage.getItem(MARKER_KEY));
	} catch {
		marker = null;
	}
	if (!marker && preferencesAvailable()) {
		try {
			const {Preferences} = await import('@capacitor/preferences');
			marker = parseMarker((await Preferences.get({key: MARKER_KEY})).value);
		} catch {
			marker = null;
		}
	}
	return marker;
}

/** Straight to the card when there is one; the list when there are several. */
function resumeTarget(competitionId: string, me: JudgeMe | null): string | null {
	const cards = me?.cards || [];
	if (cards.length === 0) return null;
	return judgePath(competitionId, cards.length === 1 ? cards[0].cardId : null);
}

let resumeChecked = false;

/**
 * Once per app start: where to take a member who was judging when the app
 * closed, or null. Only where the app always opens on its start page (the
 * native shell, an installed PWA); a browser tab reopens on its own address.
 */
export async function judgeResumePath(userId: string, currentPath: string): Promise<string | null> {
	if (resumeChecked || typeof window === 'undefined') return null;
	resumeChecked = true;
	const standalone = (window.navigator as any).standalone || window.matchMedia?.('(display-mode: standalone)').matches;
	if (!isNative() && !standalone) return null;
	if (/\/judge(\/|$|\?)/.test(currentPath)) return null;

	const marker = await readMarker();
	if (!marker || marker.userId !== userId || Date.now() - marker.at > MARKER_MAX_AGE_MS) return null;
	try {
		const me = await fetchJudgeMe(marker.competitionId);
		rememberJudgeMe(marker.competitionId, userId, me);
		return me.enabled ? resumeTarget(marker.competitionId, me) : null;
	} catch {
		// No network at start: the card and its unsent times are on the device.
		return resumeTarget(marker.competitionId, peekJudgeMe(marker.competitionId));
	}
}
