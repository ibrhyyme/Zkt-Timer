export interface AlgorithmEntry {
	name: string;
	algorithm: string;
	alternatives?: string[];
	setup?: string;
	/** Library cases: how many alternatives the served library has (the texts may need signing in). */
	alternativeCount?: number;
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

export type TrainerMode = 'standard' | 'smart' | 'recognition' | 'efficiency' | 'ollcp';
/** The two ways to study in the Algorithm Trainer. Same values as TrainerMode, so every `mode === 'smart'` check keeps working. */
export type StudyMode = Extract<TrainerMode, 'standard' | 'smart'>;
export type TimerState = 'IDLE' | 'READY' | 'RUNNING' | 'STOPPED';
export type LearnedStatus = 0 | 1 | 2; // 0=not learned, 1=learning, 2=learned

export interface TrainerSolveRecord {
	t: number;       // time in ms
	p2?: boolean;    // plus_two (only present if true)
	dnf?: boolean;   // (only present if true)
	ts?: number;     // timestamp (Date.now())
	mistakes?: number; // smart cube'da yapilan yanlis hamle sayisi (0 ise kaydedilmez)
}

// Smart Cube Types
export interface SmartTurn {
	turn: string;
	completedAt: number;
	cubeTimestamp: number | null;
	localTimestamp: number | null;
}

export type SmartPhase = 'idle' | 'ready' | 'solving' | 'completed';

export type CubeFace = 'U' | 'D' | 'F' | 'B' | 'R' | 'L';

export type TrainerBackView = 'none' | 'side-by-side' | 'top-right';

export interface TrainerOptions {
	randomOrder: boolean;
	prioritizeSlow: boolean;
	prioritizeFailed: boolean;
	selectLearning: boolean;
	randomizeAUF: boolean;
	autoLearnEnabled: boolean;
	autoLearnThreshold: number;
	cubeSize: number;
	wakeLockEnabled: boolean;
	flashingError: boolean;
	showCaseName: boolean;
	whiteOnBottom: boolean;
	showAllBleDevices: boolean;
	backView: TrainerBackView;
	topFace: CubeFace;
	frontFace: CubeFace;
	/** Last study mode picked on the mode switch; synced with the rest (Setting.trainer_options). */
	lastMode: StudyMode;
}

/**
 * - landing: trainer hub (two cards: Trainers, Algorithm Sets)
 * - modes: the Trainers page (Algorithm Trainer, PLL Recognition, Cross and XCross)
 * - selection: the Algorithm Trainer's category picker
 * - training: study screen (category selection or a set)
 * - sets: My Sets, community: Community Sets (the Algorithm Sets section)
 * - set: one set's page (/trainer/sets/:code), set-add: its algorithm picker (/trainer/sets/:code/add)
 */
export type TrainerView = 'landing' | 'modes' | 'selection' | 'training' | 'sets' | 'set' | 'set-add' | 'community';

/** The set being studied. `items` holds every row as a card; the queue holds the ones the current mode can run. */
export interface ActiveStudySet {
	id: string;
	code: string;
	name: string;
	owner_name: string;
	is_owner: boolean;
	items: CheckedAlgorithm[];
}

export interface StartSetStudyPayload {
	set: Omit<ActiveStudySet, 'items'>;
	/** Every row of the set, in set order, already converted with toCheckedAlgorithm. */
	items: CheckedAlgorithm[];
}

export interface TrainerSessionState {
	// View & Mode
	view: TrainerView;
	mode: TrainerMode | null;

	// Algorithm Selection
	selectedCategory: string;
	selectedSubsets: string[];
	checkedAlgorithms: CheckedAlgorithm[];
	algorithmQueue: CheckedAlgorithm[];
	currentAlgorithm: CheckedAlgorithm | null;

	// Set study (trainer-sets 6.1). activeSet is set by START_SET_STUDY and cleared when the
	// study ends (any view but training, a category change, another entry mode).
	activeSet: ActiveStudySet | null;
	/** Code of a set being loaded for a cold /trainer/algorithms/train?set=<code> open. */
	pendingSetCode: string | null;

	// Training State
	timerState: TimerState;
	currentTimerValue: number;
	userAlg: string[];
	originalUserAlg: string[];
	isMoveMasked: boolean;

	// Options
	options: TrainerOptions;

	// Smart Cube State
	smartConnected: boolean;
	/** Puzzle of the connected cube. The trainer drills with a 3x3 only; a 2x2 stays connected but unused. */
	smartPuzzle: '333' | '222';
	smartConnecting: boolean;
	smartScanning: boolean;
	smartScanError: string | null;
	smartBattery: number | null;
	smartPhase: SmartPhase;
	matchedMoveCount: number;
	totalExpectedMoves: number;
	badAlg: string[];
	showCameraPad: boolean;
}

export interface TrainerContextType {
	state: TrainerSessionState;
	dispatch: React.Dispatch<TrainerAction>;
	// No connectRef any more: the Bluetooth link belongs to the app-level manager
	// (client/util/smart_cube/connection_manager.ts), not to the trainer provider.
}

export type TrainerAction =
	| {type: 'SET_CATEGORY'; payload: string}
	| {type: 'SET_SUBSETS'; payload: string[]}
	| {type: 'SET_CHECKED_ALGORITHMS'; payload: CheckedAlgorithm[]}
	| {type: 'ADD_CHECKED_ALGORITHM'; payload: CheckedAlgorithm}
	/** payload: card key `category::name` (checkedKey), not the algorithm text */
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
	| {type: 'ADVANCE_ALGORITHM'}
	| {type: 'PREVIOUS_ALGORITHM'}
	// Smart Cube Actions
	| {type: 'SMART_CONNECTION'; payload: Partial<{scanning: boolean; connecting: boolean; connected: boolean; scanError: string | null; battery: number | null; puzzle: '333' | '222'}>}
	| {type: 'SMART_SET_PHASE'; payload: SmartPhase}
	| {type: 'SET_MATCHED_MOVE_COUNT'; payload: number}
	| {type: 'SET_TOTAL_EXPECTED_MOVES'; payload: number}
	| {type: 'SET_BAD_ALG'; payload: string[]}
	| {type: 'SWAP_ALGORITHM'; payload: {oldAlg: string; newAlg: string}}
	| {type: 'SMART_DISCONNECT'}
	| {type: 'SET_CAMERA_PAD'; payload: boolean}
	| {type: 'SET_MODE'; payload: TrainerMode}
	// Set study + mode switch (trainer-sets 2.3, 6.1, 6.5)
	/** Changes only the study mode (no view or queue change). remember=false skips writing lastMode. */
	| {type: 'SET_STUDY_MODE'; payload: StudyMode; remember?: boolean}
	| {type: 'START_SET_STUDY'; payload: StartSetStudyPayload}
	/** Replaces the cards of the running set study (mode filter), keeping the current card when it is still in. */
	| {type: 'SET_STUDY_ROWS'; payload: CheckedAlgorithm[]}
	| {type: 'SET_PENDING_SET'; payload: string | null};
