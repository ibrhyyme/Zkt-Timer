/**
 * OllcpContext — minimal view router state for the OLLCP recognition mode.
 * Views: list (all OLLs) → detail (one OLL's 6 variants) → train (timed practice).
 * Kept separate from the main TrainerContext (like recognition/efficiency roots).
 */
import React, {createContext, useContext, useMemo, useReducer} from 'react';
import type {OllcpView} from './types';

interface OllcpState {
	view: OllcpView;
	/** Currently opened OLL number (string), or null on the list / during a multi-OLL session. */
	currentOll: string | null;
	/** OLLs being trained (single-OLL = 1 element, multi-select = many). Read by OllTrainView. */
	trainOlls: string[];
	/** Gallery-style multi-select mode on the list (long-press to enter). */
	selectMode: boolean;
	/** OLLs picked while in select mode (canonical order applied on train). */
	selected: string[];
}

type OllcpAction =
	| {type: 'GO_LIST'}
	| {type: 'OPEN_OLL'; payload: string}
	| {type: 'TRAIN_OLL'; payload: string}
	| {type: 'TRAIN_MULTI'; payload: string[]}
	| {type: 'START_TRAIN'}
	| {type: 'BACK_TO_DETAIL'}
	| {type: 'ENTER_SELECT'; payload?: string}
	| {type: 'TOGGLE_SELECT'; payload: string}
	| {type: 'EXIT_SELECT'};

// Single flows clear any selection so the gallery mode never bleeds into detail/train.
const CLEARED = {selectMode: false, selected: [] as string[]};

function reducer(state: OllcpState, action: OllcpAction): OllcpState {
	switch (action.type) {
		case 'GO_LIST':
			return {view: 'list', currentOll: null, trainOlls: [], ...CLEARED};
		case 'OPEN_OLL':
			return {view: 'detail', currentOll: action.payload, trainOlls: [], ...CLEARED};
		case 'TRAIN_OLL':
			return {view: 'train', currentOll: action.payload, trainOlls: [action.payload], ...CLEARED};
		case 'TRAIN_MULTI':
			// Mixed practice from the list: no single "current" OLL → back goes to the list.
			return action.payload.length
				? {view: 'train', currentOll: null, trainOlls: action.payload, ...CLEARED}
				: state;
		case 'START_TRAIN':
			return state.currentOll ? {...state, view: 'train', trainOlls: [state.currentOll], ...CLEARED} : state;
		case 'BACK_TO_DETAIL':
			return {...state, view: 'detail'};
		case 'ENTER_SELECT':
			return {...state, selectMode: true, selected: action.payload ? [action.payload] : []};
		case 'TOGGLE_SELECT': {
			const has = state.selected.includes(action.payload);
			return {
				...state,
				selectMode: true,
				selected: has ? state.selected.filter((n) => n !== action.payload) : [...state.selected, action.payload],
			};
		}
		case 'EXIT_SELECT':
			return {...state, ...CLEARED};
		default:
			return state;
	}
}

interface OllcpContextValue {
	state: OllcpState;
	goList: () => void;
	openOll: (ollNum: string) => void;
	trainOll: (ollNum: string) => void;
	trainMulti: (ollNums: string[]) => void;
	startTrain: () => void;
	backToDetail: () => void;
	enterSelect: (ollNum?: string) => void;
	toggleSelect: (ollNum: string) => void;
	exitSelect: () => void;
}

const OllcpContext = createContext<OllcpContextValue | null>(null);

export function OllcpProvider({children}: {children: React.ReactNode}) {
	const [state, dispatch] = useReducer(reducer, {
		view: 'list',
		currentOll: null,
		trainOlls: [],
		selectMode: false,
		selected: [],
	});
	const value = useMemo<OllcpContextValue>(
		() => ({
			state,
			goList: () => dispatch({type: 'GO_LIST'}),
			openOll: (ollNum: string) => dispatch({type: 'OPEN_OLL', payload: ollNum}),
			trainOll: (ollNum: string) => dispatch({type: 'TRAIN_OLL', payload: ollNum}),
			trainMulti: (ollNums: string[]) => dispatch({type: 'TRAIN_MULTI', payload: ollNums}),
			startTrain: () => dispatch({type: 'START_TRAIN'}),
			backToDetail: () => dispatch({type: 'BACK_TO_DETAIL'}),
			enterSelect: (ollNum?: string) => dispatch({type: 'ENTER_SELECT', payload: ollNum}),
			toggleSelect: (ollNum: string) => dispatch({type: 'TOGGLE_SELECT', payload: ollNum}),
			exitSelect: () => dispatch({type: 'EXIT_SELECT'}),
		}),
		[state],
	);
	return <OllcpContext.Provider value={value}>{children}</OllcpContext.Provider>;
}

export function useOllcp(): OllcpContextValue {
	const ctx = useContext(OllcpContext);
	if (!ctx) throw new Error('useOllcp must be used within OllcpProvider');
	return ctx;
}
