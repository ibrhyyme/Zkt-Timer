/**
 * Efficiency Trainer state'i — useReducer (session + settings) + sub-view.
 * Persistence: debounce'lu localStorage. Load normalize: transient alanlar sifirlanir.
 */
import React, {createContext, useContext, useReducer, useEffect, useRef, useCallback} from 'react';
import type {ReactNode} from 'react';
import {useLocation} from 'react-router-dom';
import {parseTrainerPath, efficiencySubToView} from '../../../util/trainer/url/trainer_url';
import type {EfficiencyState, EfficiencyAction, EfficiencyView, SessionSlice, SettingsSlice} from './types';
import {LS_SESSION, LS_SETTINGS, LS_VIEW, EFFICIENCY_TYPES, EO_AXES, ROTATION_OPTIONS, HISTORY_CAP, LENGTH_RANGES} from '../../../util/trainer/efficiency/constants';

// ──────────────────── Defaults ────────────────────

const defaultSession: SessionSlice = {
	type: 'cross',
	eoAxis: 'LR',
	rotation: '',
	scramble: '',
	results: [],
	revealed: false,
	loading: false,
	targetLength: undefined,
	xcrossSlot: undefined,
	history: [],
	historyPos: -1,
};

const defaultSettings: SettingsSlice = {
	showAllSolutions: false,
};

const defaultView: EfficiencyView = 'trainer';

// ──────────────────── SSR-safe load ────────────────────

function loadFromStorage<T>(key: string, fallback: T): T {
	if (typeof window === 'undefined') return fallback;
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return fallback;
		return {...fallback, ...JSON.parse(raw)};
	} catch {
		return fallback;
	}
}

function loadView(): EfficiencyView {
	if (typeof window === 'undefined') return defaultView;
	try {
		const raw = localStorage.getItem(LS_VIEW);
		if (raw === 'trainer' || raw === 'settings') return raw;
	} catch {
		// ignore
	}
	return defaultView;
}

type FullState = EfficiencyState & {view: EfficiencyView};

function buildInitialState(initialView?: EfficiencyView): FullState {
	const session = loadFromStorage<SessionSlice>(LS_SESSION, defaultSession);
	if (!EFFICIENCY_TYPES.includes(session.type)) session.type = 'cross';
	if (!EO_AXES.includes(session.eoAxis)) session.eoAxis = 'LR';
	// targetLength: type'a OZGU aralikta degilse temizle (xcross'ta 10 secip cross'a
	// gecince cross max 8 → gecersiz; yoksa generateEasyScramble null + yavas fallback)
	if (session.targetLength !== undefined && !LENGTH_RANGES[session.type].includes(session.targetLength)) {
		session.targetLength = undefined;
	}
	if (session.xcrossSlot !== undefined && (session.xcrossSlot < 0 || session.xcrossSlot > 3)) {
		session.xcrossSlot = undefined;
	}
	if (typeof session.rotation !== 'string' || !ROTATION_OPTIONS.includes(session.rotation)) {
		session.rotation = '';
	}
	// Transient alanlari sifirla
	session.scramble = '';
	session.results = [];
	session.revealed = false;
	session.loading = false;
	session.history = [];
	session.historyPos = -1;
	return {
		session,
		settings: loadFromStorage<SettingsSlice>(LS_SETTINGS, defaultSettings),
		view: initialView ?? loadView(),
	};
}

// ──────────────────── Reducer ────────────────────

function reducer(state: FullState, action: EfficiencyAction): FullState {
	switch (action.type) {
		case 'SET_TYPE': {
			// Yeni type'in uzunluk araliginda olmayan targetLength'i temizle
			// (orn xcross'ta 10 secip cross'a gecince → cross max 8, gecersiz kalmasin)
			const tl = state.session.targetLength;
			const validTl = tl !== undefined && LENGTH_RANGES[action.payload].includes(tl) ? tl : undefined;
			// results da sifirla: tip degisince onceki turun cozumleri bir an gorunmesin
			return {...state, session: {...state.session, type: action.payload, targetLength: validTl, revealed: false, results: []}};
		}

		case 'SET_EO_AXIS':
			return {...state, session: {...state.session, eoAxis: action.payload, revealed: false}};

		case 'SET_TARGET_LENGTH':
			return {...state, session: {...state.session, targetLength: action.payload, revealed: false}};

		case 'SET_XCROSS_SLOT':
			return {...state, session: {...state.session, xcrossSlot: action.payload, revealed: false}};

		case 'SET_ROTATION':
			return {...state, session: {...state.session, rotation: action.payload, revealed: false}};

		case 'SCRAMBLE_LOADING':
			return {...state, session: {...state.session, loading: true, revealed: false, results: []}};

		case 'SCRAMBLE_READY': {
			const entry = {scramble: action.payload.scramble, results: action.payload.results};
			const base = state.session.history.slice(0, state.session.historyPos + 1);
			let newHistory = [...base, entry];
			if (newHistory.length > HISTORY_CAP) newHistory = newHistory.slice(newHistory.length - HISTORY_CAP);
			return {
				...state,
				session: {
					...state.session,
					loading: false,
					scramble: action.payload.scramble,
					results: action.payload.results,
					revealed: false,
					history: newHistory,
					historyPos: newHistory.length - 1,
				},
			};
		}

		case 'REVEAL':
			return {...state, session: {...state.session, revealed: true}};

		case 'HISTORY_BACK': {
			if (state.session.historyPos <= 0) return state;
			const pos = state.session.historyPos - 1;
			const entry = state.session.history[pos];
			if (!entry) return state; // bozuk/eksik history → guard (undefined access crash önle)
			return {
				...state,
				session: {
					...state.session,
					historyPos: pos,
					scramble: entry.scramble,
					results: entry.results,
					revealed: false,
					loading: false,
				},
			};
		}

		case 'SETTINGS_UPDATE':
			return {...state, settings: {...state.settings, ...action.payload}};

		case 'SET_EFFICIENCY_VIEW':
			return {...state, view: action.payload};

		default:
			return state;
	}
}

// ──────────────────── Context ────────────────────

interface EfficiencyContextValue {
	state: FullState;
	dispatch: React.Dispatch<EfficiencyAction>;
	setType: (type: SessionSlice['type']) => void;
	setEoAxis: (axis: SessionSlice['eoAxis']) => void;
	setTargetLength: (len: number | undefined) => void;
	setXCrossSlot: (slot: number | undefined) => void;
	setRotation: (rot: string) => void;
	goBack: () => void;
	reveal: () => void;
	updateSettings: (patch: Partial<SettingsSlice>) => void;
	setEfficiencyView: (view: EfficiencyView) => void;
}

const EfficiencyContext = createContext<EfficiencyContextValue | null>(null);

export function useEfficiencyContext(): EfficiencyContextValue {
	const ctx = useContext(EfficiencyContext);
	if (!ctx) throw new Error('useEfficiencyContext outside EfficiencyProvider');
	return ctx;
}

// ──────────────────── Provider ────────────────────

export function EfficiencyProvider({children}: {children: ReactNode}) {
	// İlk view URL path'inden turetilir (deep-link → dogru alt-view, flicker yok).
	const location = useLocation();
	const [state, dispatch] = useReducer(reducer, location.pathname, (path: string) => {
		const {mode, sub} = parseTrainerPath(path);
		const v = mode === 'efficiency' ? efficiencySubToView(sub) : null;
		return buildInitialState(v ?? undefined);
	});

	// Persistence (debounce'lu)
	const writeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
	useEffect(() => {
		if (typeof window === 'undefined') return;
		const debounceWrite = (key: string, value: unknown) => {
			if (writeTimers.current[key]) clearTimeout(writeTimers.current[key]);
			writeTimers.current[key] = setTimeout(() => {
				try {
					localStorage.setItem(key, JSON.stringify(value));
				} catch {
					// ignore quota
				}
			}, 100);
		};
		debounceWrite(LS_SESSION, state.session);
		debounceWrite(LS_SETTINGS, state.settings);
		debounceWrite(LS_VIEW, state.view);
	}, [state.session, state.settings, state.view]);

	const setType = useCallback((type: SessionSlice['type']) => dispatch({type: 'SET_TYPE', payload: type}), []);
	const setEoAxis = useCallback((axis: SessionSlice['eoAxis']) => dispatch({type: 'SET_EO_AXIS', payload: axis}), []);
	const setTargetLength = useCallback((len: number | undefined) => dispatch({type: 'SET_TARGET_LENGTH', payload: len}), []);
	const setXCrossSlot = useCallback((slot: number | undefined) => dispatch({type: 'SET_XCROSS_SLOT', payload: slot}), []);
	const setRotation = useCallback((rot: string) => dispatch({type: 'SET_ROTATION', payload: rot}), []);
	const goBack = useCallback(() => dispatch({type: 'HISTORY_BACK'}), []);
	const reveal = useCallback(() => dispatch({type: 'REVEAL'}), []);
	const updateSettings = useCallback((patch: Partial<SettingsSlice>) => dispatch({type: 'SETTINGS_UPDATE', payload: patch}), []);
	const setEfficiencyView = useCallback((view: EfficiencyView) => dispatch({type: 'SET_EFFICIENCY_VIEW', payload: view}), []);

	const value: EfficiencyContextValue = {
		state,
		dispatch,
		setType,
		setEoAxis,
		setTargetLength,
		setXCrossSlot,
		setRotation,
		goBack,
		reveal,
		updateSettings,
		setEfficiencyView,
	};

	return <EfficiencyContext.Provider value={value}>{children}</EfficiencyContext.Provider>;
}
