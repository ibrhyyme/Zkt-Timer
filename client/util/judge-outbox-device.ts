// The judge outbox on this device: where it is kept, how it is sent and when.
// The rules live in judge-outbox.ts; this file is the wiring.
//
// Kept twice, so one lost store does not lose a time: IndexedDB, and a mirror in
// @capacitor/preferences (native) or localStorage (web). On load the two are
// merged by submissionId. An entry that was already delivered but survives in
// one copy is simply sent again: the site answers a repeated id with the first
// result, and the entry is removed for good.
//
// Not in competition-cache: that one is wiped on logout, and an unsent time
// must outlive a logout (it waits for its own account to come back).

import {Capacitor} from '@capacitor/core';
import {isNative} from './platform';
import {getStore} from '../components/store';
import {getCachedMe} from './auth/cached-me';
import {sendJudgeEntries} from './judge-api';
import {createJudgeOutbox, JudgeOutbox, OutboxItem, OutboxStorage} from './judge-outbox';
import {JudgeEntryResult} from '../../shared/zkt_judge';

const IDB_NAME = 'zkt-judge-outbox';
const IDB_STORE = 'entries';
const MIRROR_KEY = 'zkt_judge_outbox_v1';
const FOREGROUND_TICK_MS = 15000;

function openDb(): Promise<IDBDatabase | null> {
	return new Promise((resolve) => {
		try {
			if (typeof indexedDB === 'undefined') {
				resolve(null);
				return;
			}
			const request = indexedDB.open(IDB_NAME, 1);
			request.onupgradeneeded = () => {
				if (!request.result.objectStoreNames.contains(IDB_STORE)) {
					request.result.createObjectStore(IDB_STORE, {keyPath: 'submissionId'});
				}
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => resolve(null);
			request.onblocked = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
const db = () => dbPromise || (dbPromise = openDb());

function txDone(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}

async function idbLoad(): Promise<OutboxItem[]> {
	try {
		const database = await db();
		if (!database) return [];
		const request = database.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).getAll();
		return await new Promise<OutboxItem[]>((resolve) => {
			request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
			request.onerror = () => resolve([]);
		});
	} catch {
		return [];
	}
}

async function idbSave(items: OutboxItem[]): Promise<void> {
	const database = await db();
	if (!database) return;
	const tx = database.transaction(IDB_STORE, 'readwrite');
	const store = tx.objectStore(IDB_STORE);
	store.clear();
	for (const item of items) store.put(item);
	await txDone(tx);
}

function preferencesAvailable(): boolean {
	return isNative() && Capacitor.isPluginAvailable('Preferences');
}

async function mirrorLoad(): Promise<OutboxItem[]> {
	let raw: string | null = null;
	try {
		raw = localStorage.getItem(MIRROR_KEY);
	} catch {
		// fall through to Preferences
	}
	if (!raw && preferencesAvailable()) {
		try {
			const {Preferences} = await import('@capacitor/preferences');
			raw = (await Preferences.get({key: MIRROR_KEY})).value;
		} catch {
			raw = null;
		}
	}
	try {
		const parsed = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

async function mirrorSave(items: OutboxItem[]): Promise<void> {
	const raw = JSON.stringify(items);
	// localStorage first: it is synchronous, so the entry is on the device before
	// anything else can go wrong.
	try {
		localStorage.setItem(MIRROR_KEY, raw);
	} catch {
		// Storage full or blocked: IndexedDB and Preferences still hold it.
	}
	if (preferencesAvailable()) {
		try {
			const {Preferences} = await import('@capacitor/preferences');
			await Preferences.set({key: MIRROR_KEY, value: raw});
		} catch {
			// see above
		}
	}
}

const deviceStorage: OutboxStorage = {
	async load() {
		const [fromIdb, fromMirror] = await Promise.all([idbLoad(), mirrorLoad()]);
		const byId = new Map<string, OutboxItem>();
		for (const item of [...fromMirror, ...fromIdb]) {
			if (item && typeof item.submissionId === 'string') byId.set(item.submissionId, item);
		}
		return [...byId.values()].sort((a, b) => a.deviceSeq - b.deviceSeq);
	},
	async save(items) {
		await Promise.all([mirrorSave(items), idbSave(items).catch(() => {})]);
	},
};

function currentUserId(): string | null {
	try {
		return getStore()?.getState()?.account?.me?.id || getCachedMe()?.id || null;
	} catch {
		return null;
	}
}

type ResultListener = (settled: {item: OutboxItem; result: JudgeEntryResult}[]) => void;
const resultListeners = new Set<ResultListener>();

/** Hear about entries the site answered (the card on screen updates from it). */
export function onJudgeResults(listener: ResultListener): () => void {
	resultListeners.add(listener);
	return () => {
		resultListeners.delete(listener);
	};
}

let outbox: JudgeOutbox | null = null;
let started = false;

export function getJudgeOutbox(): JudgeOutbox {
	if (!outbox) {
		outbox = createJudgeOutbox({
			storage: deviceStorage,
			send: sendJudgeEntries,
			getUserId: currentUserId,
			onResults: (settled) => resultListeners.forEach((listener) => listener(settled)),
		});
	}
	return outbox;
}

/**
 * Start sending: now, whenever the app comes to the front or the network
 * returns, and every 15 seconds while it is in front. Called once the member is
 * known, on every app start, so times typed before a crash go out without the
 * judge opening the card again. `navigator.onLine` is not consulted: a hall
 * Wi-Fi with a login page reports "online".
 */
export function startJudgeOutbox(): void {
	if (started || typeof window === 'undefined') return;
	started = true;
	const box = getJudgeOutbox();
	void box.flush(true);

	const wake = () => {
		if (typeof document !== 'undefined' && document.hidden) return;
		void box.flush(true);
	};
	document.addEventListener('visibilitychange', wake);
	window.addEventListener('online', wake);
	if (isNative()) {
		import('@capacitor/app')
			.then(({App}) => App.addListener('appStateChange', ({isActive}) => isActive && wake()))
			.catch(() => {});
	}
	setInterval(() => {
		if (typeof document !== 'undefined' && document.hidden) return;
		// Not forced: this tick respects the backoff after a failure.
		void box.flush(false);
	}, FOREGROUND_TICK_MS);
}
