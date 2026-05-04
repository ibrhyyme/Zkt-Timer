/**
 * Smart cube reconstruction engine — shared types.
 *
 * Engine algorithm based on cstimer's reconstruction system (recons.js / cubeutil.js).
 * cstimer is licensed GPL v3 — direct port with credit.
 *
 * The engine analyzes a sequence of timestamped cube turns + a known starting state,
 * detecting CFOP phase transitions (cross, f2l_1..4, oll, pll) using progress-based
 * monotonic level detection across 6 cube orientations (cross face).
 */

export interface SolveTurn {
	turn: string;
	timestamp: number;
}

export type CFOPPhase =
	| 'cross'
	| 'f2l_1'
	| 'f2l_2'
	| 'f2l_3'
	| 'f2l_4'
	| 'oll'
	| 'pll';

export interface MoveCounts {
	htm: number;
	obtm: number;
	etm: number;
	stm: number;
}

export interface PhaseTransition {
	phase: CFOPPhase;
	turnIndex: number;
	timestamp: number;
	recognitionStart: number;
	firstMoveTimestamp: number;
	moveCount: MoveCounts;
	moves: string[];
	skipped: boolean;
}

export interface PhaseEngineResult {
	transitions: PhaseTransition[];
	totalMoves: MoveCounts;
	totalTimeMs: number;
	ollIdentified?: { case: string; key: string };
	pllIdentified?: { case: string; key: string };
	prettyRecon: string;
	method: 'cfop';
	finalProgress: number;
	crossFace: string | null;
}

export type SolveMethod = 'cfop';

export interface AnalyzeOptions {
	method?: SolveMethod;
	identifyOLL?: boolean;
	identifyPLL?: boolean;
}
