export interface AlgorithmEntry {
	name: string;
	algorithm: string;
	alternatives?: string[];
}

export interface AlgorithmSubset {
	subset: string;
	algorithms: AlgorithmEntry[];
}

export interface AlgorithmCategory {
	[categoryName: string]: AlgorithmSubset[];
}

export interface CheckedAlgorithm {
	algorithm: string;
	name: string;
	bestTime: number | null;
	category: string;
	subset: string;
}

export type TimerState = 'IDLE' | 'READY' | 'RUNNING' | 'STOPPED';
export type LearnedStatus = 0 | 1 | 2; // 0=not learned, 1=learning, 2=learned

export type CubeFace = 'U' | 'D' | 'F' | 'B' | 'R' | 'L';

export interface TrainerOptions {
	randomOrder: boolean;
	prioritizeSlow: boolean;
	selectLearning: boolean;
	randomizeAUF: boolean;
	topFace: CubeFace;
	frontFace: CubeFace;
}

export type TrainerView = 'selection' | 'training';

export interface TrainerSessionState {
	// View
	view: TrainerView;

	// Algorithm Selection
	selectedCategory: string;
	selectedSubsets: string[];
	checkedAlgorithms: CheckedAlgorithm[];
	algorithmQueue: CheckedAlgorithm[];
	currentAlgorithm: CheckedAlgorithm | null;

	// Training State
	timerState: TimerState;
	currentTimerValue: number;
	userAlg: string[];
	originalUserAlg: string[];
	isMoveMasked: boolean;

	// Options
	options: TrainerOptions;
}

export interface TrainerContextType {
	state: TrainerSessionState;
	dispatch: React.Dispatch<TrainerAction>;
}

export type TrainerAction =
	| {type: 'SET_CATEGORY'; payload: string}
	| {type: 'SET_SUBSETS'; payload: string[]}
	| {type: 'SET_CHECKED_ALGORITHMS'; payload: CheckedAlgorithm[]}
	| {type: 'ADD_CHECKED_ALGORITHM'; payload: CheckedAlgorithm}
	| {type: 'REMOVE_CHECKED_ALGORITHM'; payload: string}
	| {type: 'SET_CURRENT_ALGORITHM'; payload: CheckedAlgorithm | null}
	| {type: 'SET_ALGORITHM_QUEUE'; payload: CheckedAlgorithm[]}
	| {type: 'SET_TIMER_STATE'; payload: TimerState}
	| {type: 'SET_TIMER_VALUE'; payload: number}
	| {type: 'SET_USER_ALG'; payload: string[]}
	| {type: 'SET_ORIGINAL_USER_ALG'; payload: string[]}
	| {type: 'SET_MOVE_MASKED'; payload: boolean}
	| {type: 'SET_OPTIONS'; payload: Partial<TrainerOptions>}
	| {type: 'RESET_TRAINING'}
	| {type: 'SET_VIEW'; payload: TrainerView}
	| {type: 'ADVANCE_ALGORITHM'};
