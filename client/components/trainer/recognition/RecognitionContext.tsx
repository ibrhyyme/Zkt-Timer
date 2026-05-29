/**
 * Recognition Context — 4 Pinia store'unun useReducer karsiligi.
 * Referans `SessionStore.js`, `SettingsStore.js`, `NotesStore.js`, `CustomPresetsStore.js` portu.
 *
 * Persistence: her slice debounce'lu localStorage'a yazilir.
 * Sub-view (home/setup/trainer/...) yine bu context icinde tutulur.
 */
import React, {createContext, useContext, useReducer, useEffect, useRef, useState, useCallback} from 'react';
import type {ReactNode} from 'react';
import {GameState} from '../../../util/trainer/recognition/game_constants';
import {CubeViews, DefaultColorScheme, strokeWidthOptions} from '../../../util/trainer/recognition/cube_display';
import {DefaultAllowedCrossColors, randomCrossColor} from '../../../util/trainer/recognition/colors';
import {isMobile} from '../../../util/trainer/recognition/device';
import {SIZE_DEFAULT, SIZE_OPTIONS} from '../../../util/trainer/recognition/session_sizing';
import {generateEvaluationQueue, resultsToEvalResults, evalResultsToNewQueue} from '../../../util/trainer/recognition/evaluation';
import {shuffle} from '../../../util/trainer/recognition/helpers';
import {saveSession} from '../../../util/trainer/recognition/session_history';
import {isPllLetter, allPllCaseNames} from '../../../util/trainer/recognition/pll_constants';
import type {
	RecognitionState,
	RecognitionAction,
	RecognitionView,
	LastSubmission,
	SessionSlice,
	SettingsSlice,
	NotesSlice,
	CustomPresetsSlice,
	CustomPreset,
} from './types';
import type {PllCase} from '../../../util/trainer/recognition/scramble';
import type {ResultRecord} from '../../../util/trainer/recognition/evaluation';

// ──────────────────── localStorage keys ────────────────────

const LS_SESSION = 'trainer_recognition_session';
const LS_SETTINGS = 'trainer_recognition_settings';
const LS_NOTES = 'trainer_recognition_notes';
const LS_PRESETS = 'trainer_recognition_custom_presets';
const LS_VIEW = 'trainer_recognition_view';

// ──────────────────── Defaults ────────────────────

const defaultSession: SessionSlice = {
	state: GameState.Paused,
	pool: null,
	queue: [],
	results: [],
	mistake: '',
	currentRecognitionStarted: Date.now(),
	allowedCrossColors: DefaultAllowedCrossColors,
	showResultsModal: false,
	sizeOption: SIZE_DEFAULT,
	presetLabel: 'All Cases',
};

const defaultSettings: SettingsSlice = {
	puzzleRotations: CubeViews['Center'],
	strokeWidth: strokeWidthOptions['1'],
	colorScheme: DefaultColorScheme,
	allowedCrossColors: DefaultAllowedCrossColors,
	showOnScreenKeyboard: isMobile,
	fullNameMode: false,
	angleVariance: false,
	colorVariance: false,
	questMode: true,
	questStarted: false,
	activeQuestStepId: null,
};

const defaultNotes: NotesSlice = {notes: {}};
const defaultPresets: CustomPresetsSlice = {customPresets: []};
const defaultView: RecognitionView = 'home';

// ──────────────────── SSR-safe load ────────────────────

function loadFromStorage<T>(key: string, fallback: T): T {
	if (typeof window === 'undefined') return fallback;
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return fallback;
		const parsed = JSON.parse(raw);
		return {...fallback, ...parsed};
	} catch {
		return fallback;
	}
}

function loadView(): RecognitionView {
	if (typeof window === 'undefined') return defaultView;
	try {
		const raw = localStorage.getItem(LS_VIEW);
		const valid: RecognitionView[] = ['home', 'setup', 'trainer', 'results', 'settings', 'history', 'glossary'];
		if (raw && (valid as string[]).includes(raw)) return raw as RecognitionView;
	} catch {
		// ignore
	}
	return defaultView;
}

function buildInitialState(): RecognitionState & {view: RecognitionView} {
	const session = loadFromStorage<SessionSlice>(LS_SESSION, defaultSession);
	// Validate sizeOption (schema migration)
	if (!SIZE_OPTIONS.includes(session.sizeOption) && session.sizeOption !== -1) {
		session.sizeOption = SIZE_DEFAULT;
	}
	return {
		session,
		settings: loadFromStorage<SettingsSlice>(LS_SETTINGS, defaultSettings),
		notes: loadFromStorage<NotesSlice>(LS_NOTES, defaultNotes),
		presets: loadFromStorage<CustomPresetsSlice>(LS_PRESETS, defaultPresets),
		view: loadView(),
	};
}

// ──────────────────── Reducer ────────────────────

type FullState = RecognitionState & {view: RecognitionView};

function shiftMistakeIfAnyHelper(session: SessionSlice): SessionSlice {
	if (session.mistake !== '') {
		return {...session, mistake: '', queue: session.queue.slice(1)};
	}
	return session;
}

function reducer(state: FullState, action: RecognitionAction): FullState {
	switch (action.type) {
		case 'SESSION_SET_INITIAL': {
			let s = shiftMistakeIfAnyHelper(state.session);
			s = {...s, showResultsModal: false};
			if (s.queue.length === 0 && s.results.length === 0) {
				s = {...s, queue: generateEvaluationQueue(DefaultAllowedCrossColors, s.pool)};
			}
			s = {
				...s,
				state: s.queue.length === 0 ? GameState.EvaluationDone : GameState.Paused,
				queue: shuffle([...s.queue]),
			};
			return {...state, session: s};
		}

		case 'SESSION_PAUSE': {
			const s = state.session;
			if (s.state !== GameState.Playing) return state;
			if (s.mistake) {
				// nextCase mantigi: queue shift + state continue
				const newQueue = s.queue.slice(1);
				const newState = newQueue.length === 0 ? GameState.EvaluationDone : GameState.Paused;
				return {
					...state,
					session: {
						...s,
						mistake: '',
						queue: newQueue,
						state: newState,
						currentRecognitionStarted: Date.now(),
					},
				};
			}
			return {...state, session: {...s, queue: shuffle([...s.queue]), state: GameState.Paused}};
		}

		case 'SESSION_RESUME': {
			const s = state.session;
			if (s.state !== GameState.Paused) return state;
			return {
				...state,
				session: {...s, state: GameState.Playing, currentRecognitionStarted: Date.now()},
			};
		}

		case 'SESSION_SUBMIT_ANSWER': {
			const s = state.session;
			const {mistake, resultRecord, advance} = action.payload;
			let newSession: SessionSlice = s;

			if (!s.mistake && resultRecord) {
				newSession = {
					...newSession,
					results: [resultRecord, ...newSession.results],
					mistake,
				};
			}
			if (advance) {
				// nextCase
				const newQueue = newSession.queue.slice(1);
				const newState = newQueue.length === 0 ? GameState.EvaluationDone : newSession.state;
				newSession = {
					...newSession,
					mistake: '',
					queue: newQueue,
					state: newState,
					currentRecognitionStarted: Date.now(),
				};
			}
			return {...state, session: newSession};
		}

		case 'SESSION_GIVE_UP': {
			const s = state.session;
			if (s.mistake || s.queue.length === 0) return state;
			return {
				...state,
				session: {
					...s,
					results: [action.payload.resultRecord, ...s.results],
					mistake: '-',
				},
			};
		}

		case 'SESSION_NEXT_CASE': {
			const s = state.session;
			const newQueue = s.queue.slice(1);
			const newState = newQueue.length === 0 ? GameState.EvaluationDone : s.state;
			return {
				...state,
				session: {
					...s,
					mistake: '',
					queue: newQueue,
					state: newState,
					currentRecognitionStarted: Date.now(),
				},
			};
		}

		case 'SESSION_START': {
			const {pool, sizeOption, presetLabel, queue} = action.payload;
			return {
				...state,
				session: {
					...state.session,
					pool,
					sizeOption,
					presetLabel,
					queue,
					results: [],
					mistake: '',
					state: GameState.Paused,
				},
			};
		}

		case 'SESSION_START_PERSONALIZED': {
			const {queue, presetLabel} = action.payload;
			return {
				...state,
				session: {
					...state.session,
					queue,
					results: [],
					mistake: '',
					state: GameState.Paused,
					sizeOption: -1,
					presetLabel,
				},
			};
		}

		case 'SESSION_SET_ALLOWED_CROSS_COLORS': {
			const {crossColors, regeneratedQueue} = action.payload;
			const s = shiftMistakeIfAnyHelper(state.session);
			// Eger ayni renkler ise no-op
			if (s.allowedCrossColors.length === crossColors.length && s.allowedCrossColors.every((v, i) => v === crossColors[i])) {
				return {...state, session: s};
			}
			return {
				...state,
				session: {...s, allowedCrossColors: crossColors, queue: regeneratedQueue},
			};
		}

		case 'SESSION_SET_RESULTS_MODAL':
			return {...state, session: {...state.session, showResultsModal: action.payload}};

		// ──────────────────── Settings ────────────────────

		case 'SETTINGS_UPDATE':
			return {...state, settings: {...state.settings, ...action.payload}};

		case 'SETTINGS_RESET':
			return {...state, settings: defaultSettings};

		// ──────────────────── Notes ────────────────────

		case 'NOTES_SET': {
			const {key, value} = action.payload;
			return {...state, notes: {notes: {...state.notes.notes, [key]: value}}};
		}

		case 'NOTES_DELETE': {
			const {[action.payload.key]: _, ...rest} = state.notes.notes;
			return {...state, notes: {notes: rest}};
		}

		case 'NOTES_CLEAR_ALL':
			return {...state, notes: {notes: {}}};

		// ──────────────────── Presets ────────────────────

		case 'PRESETS_ADD':
			return {...state, presets: {customPresets: [...state.presets.customPresets, action.payload]}};

		case 'PRESETS_REMOVE':
			return {
				...state,
				presets: {customPresets: state.presets.customPresets.filter((p) => p.id !== action.payload)},
			};

		case 'PRESETS_CLEAR_ALL':
			return {...state, presets: {customPresets: []}};

		// ──────────────────── View ────────────────────

		case 'SET_RECOGNITION_VIEW':
			return {...state, view: action.payload};

		default:
			return state;
	}
}

// ──────────────────── Context ────────────────────

interface RecognitionContextValue {
	state: FullState;
	dispatch: React.Dispatch<RecognitionAction>;
	lastSubmission: LastSubmission | null;
	setLastSubmission: (s: LastSubmission | null) => void;

	// Action helpers (Pinia method karsiliklari)
	setInitial: () => void;
	pausePlay: () => void;
	resumePlay: () => void;
	submitAnswer: (answer: string, fullNameMode?: boolean) => void;
	giveUpOnCase: () => void;
	startSession: (pool?: string[] | null, sizeOption?: number, presetLabel?: string) => void;
	startPersonalized: () => void;
	setAllowedCrossColors: (crossColors: string[]) => void;
	setRecognitionView: (view: RecognitionView) => void;
	setNote: (key: string, value: string) => void;
	deleteNote: (key: string) => void;
	clearAllNotes: () => void;
	addPreset: (label: string, groupIds: string[]) => CustomPreset;
	removePreset: (id: string) => void;
	updateSettings: (patch: Partial<SettingsSlice>) => void;
	resetSettings: () => void;
}

const RecognitionContext = createContext<RecognitionContextValue | null>(null);

export function useRecognitionContext(): RecognitionContextValue {
	const ctx = useContext(RecognitionContext);
	if (!ctx) throw new Error('useRecognitionContext outside RecognitionProvider');
	return ctx;
}

// ──────────────────── Provider ────────────────────

interface ProviderProps {
	children: ReactNode;
}

export function RecognitionProvider({children}: ProviderProps) {
	const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);
	const [lastSubmission, setLastSubmission] = useState<LastSubmission | null>(null);

	// ── Persistence (debounce'lu) ────────────────────
	const writeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
	useEffect(() => {
		if (typeof window === 'undefined') return;
		const debounceWrite = (key: string, value: unknown) => {
			if (writeTimers.current[key]) clearTimeout(writeTimers.current[key]);
			writeTimers.current[key] = setTimeout(() => {
				try {
					localStorage.setItem(key, JSON.stringify(value));
				} catch {
					// ignore quota errors
				}
			}, 100);
		};
		debounceWrite(LS_SESSION, state.session);
		debounceWrite(LS_SETTINGS, state.settings);
		debounceWrite(LS_NOTES, state.notes);
		debounceWrite(LS_PRESETS, state.presets);
		debounceWrite(LS_VIEW, state.view);
	}, [state]);

	// ── Action helpers (Pinia method karsiliklari) ────────────────────

	const setInitial = useCallback(() => dispatch({type: 'SESSION_SET_INITIAL'}), []);
	const pausePlay = useCallback(() => dispatch({type: 'SESSION_PAUSE'}), []);
	const resumePlay = useCallback(() => dispatch({type: 'SESSION_RESUME'}), []);

	const submitAnswer = useCallback(
		(answer: string, fullNameMode: boolean = false) => {
			const s = state.session;
			if (s.state !== GameState.Playing || s.queue.length === 0) return;
			const currentCase = s.queue[0];
			// Validate input
			if (fullNameMode) {
				if (!allPllCaseNames.has(answer)) return;
			} else {
				if (!isPllLetter(answer.toUpperCase())) return;
				answer = answer.toUpperCase();
			}
			const isCorrect = fullNameMode ? currentCase.name === answer : currentCase.name[0] === answer;

			// Signal lastSubmission for OnScreenKeyboard feedback
			if (!s.mistake || isCorrect) {
				setLastSubmission({key: answer, type: isCorrect ? 'correct' : 'wrong'});
			}

			let resultRecord: ResultRecord | null = null;
			let mistake = s.mistake;
			if (!s.mistake) {
				mistake = isCorrect ? '' : answer;
				resultRecord = {
					pllCase: currentCase,
					started: new Date(s.currentRecognitionStarted),
					finished: new Date(),
					mistake,
				};
			}

			dispatch({
				type: 'SESSION_SUBMIT_ANSWER',
				payload: {answer, isCorrect, mistake, resultRecord, advance: isCorrect},
			});
		},
		[state.session]
	);

	const giveUpOnCase = useCallback(() => {
		const s = state.session;
		if (s.mistake || s.queue.length === 0) return;
		const currentCase = s.queue[0];
		const resultRecord: ResultRecord = {
			pllCase: currentCase,
			started: new Date(s.currentRecognitionStarted),
			finished: new Date(),
			mistake: '-',
		};
		dispatch({type: 'SESSION_GIVE_UP', payload: {resultRecord}});
	}, [state.session]);

	const startSession = useCallback(
		(pool: string[] | null = null, sizeOption: number = SIZE_DEFAULT, presetLabel: string = 'All Cases') => {
			const queue = generateEvaluationQueue(state.session.allowedCrossColors, pool);
			dispatch({type: 'SESSION_START', payload: {pool, sizeOption, presetLabel, queue}});
		},
		[state.session.allowedCrossColors]
	);

	const startPersonalized = useCallback(() => {
		const sorted = resultsToEvalResults(state.session.results);
		const queue = evalResultsToNewQueue(sorted, state.session.allowedCrossColors, state.session.pool);
		const label = state.session.presetLabel.replace(/ \(personalized\)$/, '') + ' (personalized)';
		dispatch({type: 'SESSION_START_PERSONALIZED', payload: {queue, presetLabel: label}});
	}, [state.session.results, state.session.allowedCrossColors, state.session.pool, state.session.presetLabel]);

	const setAllowedCrossColors = useCallback(
		(crossColors: string[]) => {
			const newQueue = state.session.queue.map((c) => ({...c, crossColor: randomCrossColor(crossColors)}));
			dispatch({type: 'SESSION_SET_ALLOWED_CROSS_COLORS', payload: {crossColors, regeneratedQueue: newQueue}});
		},
		[state.session.queue]
	);

	const setRecognitionView = useCallback((view: RecognitionView) => dispatch({type: 'SET_RECOGNITION_VIEW', payload: view}), []);

	const setNote = useCallback((key: string, value: string) => dispatch({type: 'NOTES_SET', payload: {key, value}}), []);
	const deleteNote = useCallback((key: string) => dispatch({type: 'NOTES_DELETE', payload: {key}}), []);
	const clearAllNotes = useCallback(() => dispatch({type: 'NOTES_CLEAR_ALL'}), []);

	const addPreset = useCallback((label: string, groupIds: string[]): CustomPreset => {
		const preset: CustomPreset = {id: `custom_${Date.now()}`, label, groups: groupIds};
		dispatch({type: 'PRESETS_ADD', payload: preset});
		return preset;
	}, []);

	const removePreset = useCallback((id: string) => dispatch({type: 'PRESETS_REMOVE', payload: id}), []);

	const updateSettings = useCallback((patch: Partial<SettingsSlice>) => dispatch({type: 'SETTINGS_UPDATE', payload: patch}), []);
	const resetSettings = useCallback(() => dispatch({type: 'SETTINGS_RESET'}), []);

	// Session auto-save: queue tukenince Dexie'ye yaz
	const lastSavedResultsRef = useRef<ResultRecord[] | null>(null);
	useEffect(() => {
		if (state.session.state === GameState.EvaluationDone && state.session.results !== lastSavedResultsRef.current) {
			lastSavedResultsRef.current = state.session.results;
			if (state.session.results.length > 0) {
				saveSession({
					pool: state.session.pool,
					sizeOption: state.session.sizeOption,
					presetLabel: state.session.presetLabel,
					results: state.session.results,
				}).catch(() => {
					// ignore Dexie errors (SSR or quota)
				});
			}
		}
	}, [state.session.state, state.session.results, state.session.pool, state.session.sizeOption, state.session.presetLabel]);

	const value: RecognitionContextValue = {
		state,
		dispatch,
		lastSubmission,
		setLastSubmission,
		setInitial,
		pausePlay,
		resumePlay,
		submitAnswer,
		giveUpOnCase,
		startSession,
		startPersonalized,
		setAllowedCrossColors,
		setRecognitionView,
		setNote,
		deleteNote,
		clearAllNotes,
		addPreset,
		removePreset,
		updateSettings,
		resetSettings,
	};

	return <RecognitionContext.Provider value={value}>{children}</RecognitionContext.Provider>;
}

// ──────────────────── Selectors ────────────────────

export function useCurrentCase(): PllCase | null {
	const {state} = useRecognitionContext();
	const s = state.session;
	return s.state === GameState.Playing && s.queue.length > 0 ? s.queue[0] : null;
}
