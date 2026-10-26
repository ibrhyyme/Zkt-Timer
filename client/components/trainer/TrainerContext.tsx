import React, {createContext, useContext, useReducer, useEffect, useRef, useCallback, ReactNode} from 'react';
import {useLocation} from 'react-router-dom';
import type {
	TrainerSessionState,
	TrainerAction,
	TrainerContextType,
	TrainerOptions,
	TrainerMode,
	TrainerView,
} from './types';
import {parseTrainerPath, parseTrainerSearch, trainerViewForPath} from '../../util/trainer/url/trainer_url';
import {createTrainerState, trainerReducer} from './trainer_reducer';
import {filterForMode, checkedKey} from '../../util/trainer/set_queue';
import {parseStudyModeParam, resolveStudyMode, smartModeAllowed} from '../../util/trainer/study_mode';
import {isPro, isProEnabled} from '../../lib/pro';
import {getSmartCubeManager} from '../../util/smart_cube/connection_manager';
import {toastError} from '../../util/toast';
import i18n from '../../i18n/i18n';
import {getMe} from '../store';
import {getSetting} from '../../db/settings/query';
import {getSettingsDb} from '../../db/settings/init';
import {setSetting} from '../../db/settings/update';
import {setLocalSettingValue} from '../../db/settings/local';
import {gqlQueryTyped} from '../api';
import {TrainerOptionsSettingDocument} from '../../@types/generated/graphql';
import {
	DEFAULT_TRAINER_OPTIONS,
	LEGACY_TRAINER_OPTIONS_KEY,
	parseTrainerOptionsBlob,
	resolveTrainerOptions,
	sameTrainerOptions,
	serializeTrainerOptions,
	trainerOptionsDeviceKey,
} from '../../util/trainer/trainer_options_sync';

// Trainer settings persist in two places (see util/trainer/trainer_options_sync.ts): a device
// copy in localStorage and the GLOBAL `trainer_options` setting on the server, shared by every
// device. The newer copy wins.

function readDeviceCopy(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		return (
			localStorage.getItem(trainerOptionsDeviceKey(getMe()?.id)) ??
			// Before server sync the trainer kept one unversioned copy here. Read it so an
			// existing user's settings carry over (and get uploaded) instead of resetting.
			localStorage.getItem(LEGACY_TRAINER_OPTIONS_KEY)
		);
	} catch {
		return null;
	}
}

function writeDeviceCopy(blob: string) {
	try {
		localStorage.setItem(trainerOptionsDeviceKey(getMe()?.id), blob);
	} catch {
		// Storage full or blocked: the server copy still carries the change.
	}
}

function readServerCopy(): string | null {
	try {
		return getSetting('trainer_options');
	} catch {
		return null;
	}
}

// Stores a blob that came FROM the server in the local settings store without writing it back.
function storeServerCopyLocally(blob: string) {
	try {
		const row = getSettingsDb()?.findOne({id: 'trainer_options'});
		if (row) {
			row.value = blob;
			getSettingsDb().update(row);
		}
		setLocalSettingValue('trainer_options', blob);
	} catch {
		// The device copy written alongside is enough to keep the value.
	}
}

async function fetchServerCopy(): Promise<string | null | undefined> {
	try {
		const res = await gqlQueryTyped(TrainerOptionsSettingDocument, {}, {fetchPolicy: 'no-cache'});
		return res.data?.settings?.trainer_options ?? null;
	} catch {
		// Offline: keep what this device has. undefined means "unknown", not "empty".
		return undefined;
	}
}

function loadOptions(): TrainerOptions {
	// SSR guard: /trainer landing is public and server-rendered; localStorage is
	// undefined there. loadMode() already guards — keep this consistent.
	if (typeof window === 'undefined') return {...DEFAULT_TRAINER_OPTIONS};
	return resolveTrainerOptions(readDeviceCopy(), readServerCopy()).options;
}

// Slider drags fire a change per step; the server gets the value once the hand stops.
const SERVER_PUSH_DELAY_MS = 800;

function loadMode(): TrainerMode | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = localStorage.getItem('trainer_mode');
		if (raw === 'standard' || raw === 'smart' || raw === 'recognition' || raw === 'efficiency') return raw;
	} catch {
		// ignore
	}
	return null;
}

const savedMode = loadMode();

// Context default only (a consumer outside the provider); the provider builds its own from the URL.
const initialState: TrainerSessionState = createTrainerState(loadOptions(), {
	mode: savedMode,
	view: savedMode ? 'selection' : 'landing',
});

function smartAllowedForMe(): boolean {
	return smartModeAllowed(isProEnabled(), isPro(getMe() || undefined));
}

/**
 * Derives initial mode/view from the URL so a deep-linked mount lands directly in the correct
 * view (CLIENT-only first-mount optimization: the trainer is gated behind app_loaded +
 * FeatureGuard and never server-renders, so this is not an SSR/hydration concern).
 *
 * - Algorithm Trainer and set paths (`/trainer/algorithms...`, `/trainer/sets...`, `/trainer/community`, legacy
 *   `/trainer/standard|smart`): the study mode comes from `?mode=`, else the remembered
 *   `lastMode`, and Smart falls back to Standard when locked (2.3).
 * - A cold `/trainer/algorithms/train?set=<code>` opens on the set loading state (6.1).
 * - Other entries (recognition, efficiency, ollcp) start from their own root view.
 * - `/trainer/modes`: the Trainers page. Bare/unknown path: the hub. The last-used mode is
 *   intentionally NOT restored there.
 */
function resolveInitialNav(
	pathname: string,
	search: string,
	options: TrainerOptions
): {mode: TrainerMode | null; view: TrainerView; pendingSetCode: string | null} {
	const parsed = parseTrainerPath(pathname);
	if (parsed.entry === 'algorithms' || parsed.entry === 'sets' || parsed.entry === 'community') {
		const requested = parseStudyModeParam(search) ?? (parsed.legacyMode || null);
		const mode = resolveStudyMode(requested, options.lastMode, smartAllowedForMe());
		const view = trainerViewForPath(parsed);
		if (view === 'training') {
			const code = parseTrainerSearch(search).set;
			if (code) return {mode, view: 'training', pendingSetCode: code};
			// No set and no selection survives a reload: start from the selector (the URL hook
			// then rewrites the address, as before).
			return {mode, view: 'selection', pendingSetCode: null};
		}
		return {mode, view: view || 'selection', pendingSetCode: null};
	}
	if (parsed.mode) return {mode: parsed.mode, view: 'selection', pendingSetCode: null};
	if (parsed.entry === 'modes') return {mode: null, view: 'modes', pendingSetCode: null};
	return {mode: null, view: 'landing', pendingSetCode: null};
}

function makeInitialState(location: {pathname: string; search: string}): TrainerSessionState {
	const options = loadOptions();
	return createTrainerState(options, resolveInitialNav(location.pathname, location.search, options));
}

const TrainerContext = createContext<TrainerContextType>({
	state: initialState,
	dispatch: () => {},
});

export function useTrainerContext() {
	return useContext(TrainerContext);
}

interface TrainerProviderProps {
	children: ReactNode;
}

export function TrainerProvider({children}: TrainerProviderProps) {
	// Initial state derived from URL path so a deep-linked mount lands directly in the right view
	// (client-only first-mount optimization; trainer is gated behind app_loaded/FeatureGuard and
	// never server-renders — not an SSR/hydration concern).
	const location = useLocation();
	const [state, dispatch] = useReducer(trainerReducer, location, makeInitialState);

	// --- Trainer settings persistence ---
	// The options last written to (or read from) storage, with their change time. A state change
	// that matches it is a load, not an edit, and is not written back.
	const syncedRef = useRef<{options: TrainerOptions; ts: number} | null>(null);
	const pendingBlobRef = useRef<string | null>(null);
	const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const flushServerPush = useCallback(() => {
		if (pushTimerRef.current !== null) {
			clearTimeout(pushTimerRef.current);
			pushTimerRef.current = null;
		}
		const blob = pendingBlobRef.current;
		pendingBlobRef.current = null;
		// setSetting updates the local settings store and, for a logged-in user, the server.
		// Offline it fails quietly; the newer device copy re-uploads it on the next visit.
		if (blob) setSetting('trainer_options', blob);
	}, []);

	const scheduleServerPush = useCallback((blob: string) => {
		pendingBlobRef.current = blob;
		if (pushTimerRef.current !== null) clearTimeout(pushTimerRef.current);
		pushTimerRef.current = setTimeout(flushServerPush, SERVER_PUSH_DELAY_MS);
	}, [flushServerPush]);

	// Mount: remember what was loaded, upload a device copy the server has not seen, then read
	// the server fresh, since another device may have changed the settings after this app booted.
	useEffect(() => {
		const resolved = resolveTrainerOptions(readDeviceCopy(), readServerCopy());
		syncedRef.current = {options: state.options, ts: resolved.ts};
		const loggedIn = !!getMe();
		if (resolved.pushLocal) {
			const blob = serializeTrainerOptions(resolved.options, resolved.ts);
			writeDeviceCopy(blob);
			// Logged in: the upload waits for the fresh server read below. The settings store
			// may be days old (the app only reads settings at boot), so uploading now could
			// replace a newer value another device wrote meanwhile if that read is slower than
			// the push delay.
			if (!loggedIn) scheduleServerPush(blob);
		}

		if (!loggedIn) return;
		let cancelled = false;
		fetchServerCopy().then((remoteRaw) => {
			if (cancelled || remoteRaw === undefined) return;
			const synced = syncedRef.current;
			if (!synced) return;
			const remote = parseTrainerOptionsBlob(remoteRaw);
			if (remote && remote.ts > synced.ts) {
				// Nothing older than the server copy may be uploaded after this point.
				if (pushTimerRef.current !== null) clearTimeout(pushTimerRef.current);
				pushTimerRef.current = null;
				pendingBlobRef.current = null;
				syncedRef.current = {options: remote.options, ts: remote.ts};
				const blob = serializeTrainerOptions(remote.options, remote.ts);
				writeDeviceCopy(blob);
				storeServerCopyLocally(blob);
				dispatch({type: 'SET_OPTIONS', payload: remote.options});
			} else if (
				// ts 0 is a legacy device copy (pre sync); it is uploaded only when the server has none.
				(synced.ts > 0 || resolved.pushLocal) &&
				(!remote || (synced.ts > remote.ts && !sameTrainerOptions(synced.options, remote.options)))
			) {
				scheduleServerPush(serializeTrainerOptions(synced.options, synced.ts));
			}
		});
		return () => {
			cancelled = true;
		};
		// Mount only: state.options here is the value makeInitialState just loaded.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Every edit (settings modal, selection screen orientation, select all) lands here.
	useEffect(() => {
		const synced = syncedRef.current;
		if (!synced || sameTrainerOptions(state.options, synced.options)) return;
		const ts = Date.now();
		syncedRef.current = {options: state.options, ts};
		const blob = serializeTrainerOptions(state.options, ts);
		writeDeviceCopy(blob);
		scheduleServerPush(blob);
	}, [state.options, scheduleServerPush]);

	// Set study: the cards follow the study mode (trainer-sets 6.5). Smart Cube runs only the 3x3
	// rows; switching back to Standard brings the others back. The rule is filterForMode; the
	// mode switch itself (SET_STUDY_MODE) leaves the queue alone.
	useEffect(() => {
		const set = state.activeSet;
		if (!set) return;
		const cards = filterForMode(set.items, state.mode);
		const current = state.checkedAlgorithms;
		const same =
			cards.length === current.length && cards.every((card, i) => checkedKey(card) === checkedKey(current[i]));
		if (!same) dispatch({type: 'SET_STUDY_ROWS', payload: cards});
	}, [state.mode, state.activeSet, state.checkedAlgorithms]);

	// Leaving the trainer or backgrounding the app sends a waiting change right away.
	useEffect(() => {
		const onVisibility = () => {
			if (document.visibilityState === 'hidden') flushServerPush();
		};
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			document.removeEventListener('visibilitychange', onVisibility);
			flushServerPush();
		};
	}, [flushServerPush]);

	// The trainer no longer owns a Connect instance. Every surface shares the app-level
	// manager, so a cube paired on the timer is already live when the trainer opens, and
	// leaving the trainer no longer strands an open link nobody can reach (the old code
	// abandoned its instance on unmount instead of disconnecting).
	//
	// This mirrors the manager's connection state into the trainer's own reducer, which the
	// trainer UI reads. The manager's Redux slice is the source; this is a view of it.
	useEffect(() => {
		const manager = getSmartCubeManager();

		let wasConnected = manager.getSnapshot().connected;
		// Once per connected cube, not per snapshot: a 2x2 here is explained, then left alone.
		let warnedFor: string | null = null;

		const apply = (snapshot: ReturnType<typeof manager.getSnapshot>) => {
			if (snapshot.connected && snapshot.puzzle === '222' && warnedFor !== snapshot.deviceId) {
				warnedFor = snapshot.deviceId;
				toastError(i18n.t('smart_cube.puzzle_2x2_unsupported_here'));
			}
			if (wasConnected && !snapshot.connected) {
				// SMART_DISCONNECT resets the whole smart block (phase, match counters, camera
				// pad), so it fires only on the actual transition. Sending it for every
				// not-connected snapshot would wipe a live session the moment a scan started.
				wasConnected = false;
				dispatch({type: 'SMART_DISCONNECT'});
				return;
			}
			wasConnected = snapshot.connected;
			dispatch({
				type: 'SMART_CONNECTION',
				payload: {
					scanning: snapshot.scanning,
					connecting: snapshot.connecting,
					connected: snapshot.connected,
					puzzle: snapshot.puzzle,
					scanError: snapshot.scanError,
					// Seeds the readout for a cube connected before the trainer opened; later
					// readings arrive through subscribeBattery below.
					battery: snapshot.batteryLevel,
				},
			});
		};

		// Seed from the current state first: the cube may already be connected from another page.
		apply(manager.getSnapshot());
		const unsubConnection = manager.subscribeConnection(apply);
		const unsubBattery = manager.subscribeBattery((level) =>
			dispatch({type: 'SMART_CONNECTION', payload: {battery: level}})
		);

		return () => {
			unsubConnection();
			unsubBattery();
		};
	}, [dispatch]);

	return (
		<TrainerContext.Provider value={{state, dispatch}}>
			{children}
		</TrainerContext.Provider>
	);
}
