/**
 * All types for Recognition mode.
 * TypeScript counterpart of reference Pinia stores.
 */
import type {PllCase} from '../../../util/trainer/recognition/scramble';
import type {ResultRecord} from '../../../util/trainer/recognition/evaluation';
import type {ColorScheme, Rotation} from '../../../util/trainer/recognition/cube_display';
import type {GameStateValue} from '../../../util/trainer/recognition/game_constants';

// ──────────────────── Slices ────────────────────

export interface SessionSlice {
	state: GameStateValue; // Paused=0 / Playing=1 / EvaluationDone=2
	pool: string[] | null; // null = all 73 keys
	queue: PllCase[];
	results: ResultRecord[];
	mistake: string; // "" = correct, "-" = give up, else literal wrong answer
	currentRecognitionStarted: number; // Date.now()
	allowedCrossColors: string[];
	showResultsModal: boolean;
	sizeOption: number; // SIZE_UNIQUE/MEDIUM/LARGE or -1 (personalized)
	presetLabel: string;
}

export interface SettingsSlice {
	puzzleRotations: Rotation[];
	strokeWidth: number;
	colorScheme: ColorScheme;
	allowedCrossColors: string[];
	showOnScreenKeyboard: boolean;
	fullNameMode: boolean;
	angleVariance: boolean;
	colorVariance: boolean;
	questMode: boolean;
	questStarted: boolean;
	activeQuestStepId: number | null;
}

export interface NotesSlice {
	notes: Record<string, string>; // "Aa/y2" -> "headlights pattern"
}

export interface CustomPreset {
	id: string; // "custom_<timestamp>"
	label: string;
	groups: string[];
}

export interface CustomPresetsSlice {
	customPresets: CustomPreset[];
}

export interface RecognitionState {
	session: SessionSlice;
	settings: SettingsSlice;
	notes: NotesSlice;
	presets: CustomPresetsSlice;
}

// ──────────────────── Recognition Sub-View ────────────────────

export type RecognitionView = 'home' | 'setup' | 'trainer' | 'results' | 'settings' | 'history' | 'glossary';

// ──────────────────── Non-persisted UI Feedback ────────────────────

export interface LastSubmission {
	key: string; // 'A', 'Gb', etc.
	type: 'correct' | 'wrong';
}

// ──────────────────── Actions ────────────────────

export type RecognitionAction =
	// Session
	| {type: 'SESSION_SET_INITIAL'}
	| {type: 'SESSION_PAUSE'}
	| {type: 'SESSION_RESUME'}
	| {type: 'SESSION_SUBMIT_ANSWER'; payload: {answer: string; isCorrect: boolean; mistake: string; resultRecord: ResultRecord | null; advance: boolean}}
	| {type: 'SESSION_GIVE_UP'; payload: {resultRecord: ResultRecord}}
	| {type: 'SESSION_NEXT_CASE'}
	| {type: 'SESSION_START'; payload: {pool: string[] | null; sizeOption: number; presetLabel: string; queue: PllCase[]}}
	| {type: 'SESSION_START_PERSONALIZED'; payload: {queue: PllCase[]; presetLabel: string}}
	| {type: 'SESSION_SET_ALLOWED_CROSS_COLORS'; payload: {crossColors: string[]; regeneratedQueue: PllCase[]}}
	| {type: 'SESSION_SET_RESULTS_MODAL'; payload: boolean}
	// Settings
	| {type: 'SETTINGS_UPDATE'; payload: Partial<SettingsSlice>}
	| {type: 'SETTINGS_RESET'}
	// Notes
	| {type: 'NOTES_SET'; payload: {key: string; value: string}}
	| {type: 'NOTES_DELETE'; payload: {key: string}}
	| {type: 'NOTES_CLEAR_ALL'}
	// Presets
	| {type: 'PRESETS_ADD'; payload: CustomPreset}
	| {type: 'PRESETS_REMOVE'; payload: string}
	| {type: 'PRESETS_CLEAR_ALL'}
	// View
	| {type: 'SET_RECOGNITION_VIEW'; payload: RecognitionView};
