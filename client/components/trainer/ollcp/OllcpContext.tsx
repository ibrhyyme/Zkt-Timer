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
}

type OllcpAction =
	| {type: 'GO_LIST'}
	| {type: 'OPEN_OLL'; payload: string}
	| {type: 'TRAIN_OLL'; payload: string}
	| {type: 'TRAIN_MULTI'; payload: string[]}
	| {type: 'START_TRAIN'}
	| {type: 'BACK_TO_DETAIL'};

function reducer(state: OllcpState, action: OllcpAction): OllcpState {
	switch (action.type) {
		case 'GO_LIST':
			return {view: 'list', currentOll: null, trainOlls: []};
		case 'OPEN_OLL':
			return {view: 'detail', currentOll: action.payload, trainOlls: []};
		case 'TRAIN_OLL':
			return {view: 'train', currentOll: action.payload, trainOlls: [action.payload]};
		case 'TRAIN_MULTI':
			// Mixed practice from the list: no single "current" OLL → back goes to the list.
			return action.payload.length ? {view: 'train', currentOll: null, trainOlls: action.payload} : state;
		case 'START_TRAIN':
			return state.currentOll ? {...state, view: 'train', trainOlls: [state.currentOll]} : state;
		case 'BACK_TO_DETAIL':
			return {...state, view: 'detail'};
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
}

const OllcpContext = createContext<OllcpContextValue | null>(null);

export function OllcpProvider({children}: {children: React.ReactNode}) {
	const [state, dispatch] = useReducer(reducer, {view: 'list', currentOll: null, trainOlls: []});
	const value = useMemo<OllcpContextValue>(
		() => ({
			state,
			goList: () => dispatch({type: 'GO_LIST'}),
			openOll: (ollNum: string) => dispatch({type: 'OPEN_OLL', payload: ollNum}),
			trainOll: (ollNum: string) => dispatch({type: 'TRAIN_OLL', payload: ollNum}),
			trainMulti: (ollNums: string[]) => dispatch({type: 'TRAIN_MULTI', payload: ollNums}),
			startTrain: () => dispatch({type: 'START_TRAIN'}),
			backToDetail: () => dispatch({type: 'BACK_TO_DETAIL'}),
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
