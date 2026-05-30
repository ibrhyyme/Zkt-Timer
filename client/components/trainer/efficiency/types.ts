/**
 * Efficiency Trainer tipleri. Cross/XCross/EOCross verimlilik antrenoru.
 * Rotation (orientation) cross rengini/alt yuzu belirler — ayri renk yok.
 */
import type {SolverResult} from '../../../util/cross-solver/types';

export type EfficiencyType = 'cross' | 'xcross' | 'eocross';
export type EoAxis = 'LR' | 'FB';
export type EfficiencyView = 'trainer' | 'settings';

export interface SessionSlice {
	type: EfficiencyType;
	eoAxis: EoAxis;
	rotation: string; // CUBE_ORIENTATIONS orientation (kup tutus acisi), '' = None
	scramble: string;
	results: SolverResult[];
	revealed: boolean; // KRITIK pedagoji — baslangicta false
	loading: boolean;
	targetLength?: number; // hedef move count (undefined = filtresiz)
	xcrossSlot?: number; // XCross F2L slot 0-3 (undefined = optimal pair)
	history: Array<{scramble: string; results: SolverResult[]}>; // Back navigasyonu (cap'li)
	historyPos: number;
}

export interface SettingsSlice {
	showAllSolutions: boolean;
}

export interface EfficiencyState {
	session: SessionSlice;
	settings: SettingsSlice;
}

export type EfficiencyAction =
	| {type: 'SET_TYPE'; payload: EfficiencyType}
	| {type: 'SET_EO_AXIS'; payload: EoAxis}
	| {type: 'SET_TARGET_LENGTH'; payload: number | undefined}
	| {type: 'SET_XCROSS_SLOT'; payload: number | undefined}
	| {type: 'SET_ROTATION'; payload: string}
	| {type: 'SCRAMBLE_LOADING'}
	| {type: 'SCRAMBLE_READY'; payload: {scramble: string; results: SolverResult[]}}
	| {type: 'REVEAL'}
	| {type: 'HISTORY_BACK'}
	| {type: 'SETTINGS_UPDATE'; payload: Partial<SettingsSlice>}
	| {type: 'SET_EFFICIENCY_VIEW'; payload: EfficiencyView}
	| {
			type: 'HYDRATE_CONFIG';
			payload: {type?: string; rotation?: string; eoAxis?: string; targetLength?: number; xcrossSlot?: number};
	  };
