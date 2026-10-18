/**
 * My Sets list state (trainer-sets 7.2, 9.3).
 *
 * Module level state with `subscribe`, not a Redux slice: nothing renders it on the server, so
 * there is no SSR initial state to keep in step (CLAUDE.md: a new slice needs router.tsx init).
 * The list is asked for once when My Sets opens (one `myAlgSets`, reference_graphql_request_cost)
 * and kept current by the screens' own edits (create, delete, save, unsave) without refetching.
 *
 * Offline: the device's last list shows with an "offline" flag. A saved set the server no longer
 * lists (the owner deleted it) is reported once in `removed`, then dropped.
 */
import {useEffect, useState} from 'react';
import {getMe} from '../../components/store';
import {fetchMyAlgSets} from './api';
import {clearAllAlgSetCaches, putCachedList, readAlgSetCache, removedSavedSets} from './cache';
import type {AlgSetSummaryData, MyAlgSetsData, SavedAlgSetData} from './types';

export type MySetsStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface MySetsState {
	userId: string | null;
	status: MySetsStatus;
	data: MyAlgSetsData | null;
	/** Showing the device copy because the server could not be reached. */
	offline: boolean;
	/** Saved sets whose owner deleted them since the last list ("Sahibi bu seti kaldırdı", once). */
	removed: SavedAlgSetData[];
}

const INITIAL: MySetsState = {userId: null, status: 'idle', data: null, offline: false, removed: []};

let state: MySetsState = INITIAL;
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

function emit(next: MySetsState) {
	state = next;
	listeners.forEach((listener) => listener());
}

export function getMySetsState(): MySetsState {
	return state;
}

export function subscribeMySets(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function currentUserId(): string | null {
	try {
		return getMe()?.id || null;
	} catch {
		return null;
	}
}

/** Asks the server for the list; on failure falls back to the device copy. */
export function refreshMySets(): Promise<void> {
	const userId = currentUserId();
	if (!userId) {
		emit(INITIAL);
		return Promise.resolve();
	}
	if (inflight && state.userId === userId) return inflight;

	const sameUser = state.userId === userId;
	const cached = readAlgSetCache(userId);
	const previous = (sameUser ? state.data : null) || cached.list;
	emit({
		userId,
		status: sameUser && state.data ? state.status : 'loading',
		data: previous,
		offline: false,
		removed: sameUser ? state.removed : [],
	});

	inflight = fetchMyAlgSets()
		.then((list) => {
			if (currentUserId() !== userId) return;
			const removed = removedSavedSets(cached.list, list);
			putCachedList(userId, list);
			emit({userId, status: 'ready', data: list, offline: false, removed: [...state.removed, ...removed]});
		})
		.catch(() => {
			if (currentUserId() !== userId) return;
			const fallback = state.data || cached.list;
			emit({userId, status: fallback ? 'ready' : 'error', data: fallback, offline: !!fallback, removed: state.removed});
		})
		.finally(() => {
			inflight = null;
		});
	return inflight;
}

/** Applies a local change to the list and mirrors it into the device copy. */
function update(mutator: (data: MyAlgSetsData) => MyAlgSetsData) {
	if (!state.data || !state.userId) return;
	const data = mutator(state.data);
	putCachedList(state.userId, data);
	emit({...state, data});
}

/** The list keeps summaries only: a full set passed in loses its rows here. */
function summaryOnly(set: AlgSetSummaryData): AlgSetSummaryData {
	const {items, is_owner, is_saved, ...summary} = set as AlgSetSummaryData & {
		items?: unknown;
		is_owner?: unknown;
		is_saved?: unknown;
	};
	return summary;
}

/** A set the user created or edited: first in "My sets" (most recently updated first). */
export function upsertOwnSet(set: AlgSetSummaryData) {
	const summary = summaryOnly(set);
	update((data) => ({...data, own: [summary, ...data.own.filter((s) => s.id !== summary.id)]}));
}

export function removeOwnSet(setId: string) {
	update((data) => ({...data, own: data.own.filter((s) => s.id !== setId)}));
}

/** A set the user just saved: first in "Saved". */
export function addSavedSet(set: AlgSetSummaryData) {
	const summary = summaryOnly(set);
	update((data) => ({
		...data,
		saved: [
			{set_id: summary.id, saved_at: new Date().toISOString(), unavailable: false, set: summary},
			...data.saved.filter((s) => s.set_id !== summary.id),
		],
	}));
}

export function removeSavedSet(setId: string) {
	update((data) => ({...data, saved: data.saved.filter((s) => s.set_id !== setId)}));
}

export function dismissRemovedSet(setId: string) {
	emit({...state, removed: state.removed.filter((s) => s.set_id !== setId)});
}

/** Logout / account deletion: forget the list and every set copy on this device. */
export function resetMySets() {
	inflight = null;
	emit(INITIAL);
	clearAllAlgSetCaches();
}

/** React binding: re-renders on every list change. Does not fetch by itself. */
export function useMySets(): MySetsState {
	const [, setTick] = useState(0);
	useEffect(() => subscribeMySets(() => setTick((n) => n + 1)), []);
	return state;
}
