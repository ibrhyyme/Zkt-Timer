/**
 * Smart cube reconstruction engine — shared types.
 *
 * Engine algorithm based on cstimer's reconstruction system (recons.js / cubeutil.js).
 * cstimer is licensed GPL v3 — direct port with credit.
 *
 * The engine analyzes a sequence of timestamped cube turns + a known starting state,
 * detecting phase transitions using progress-based monotonic level detection across
 * a method-specific number of cube orientations.
 *
 * Methods:
 *   cfop  — cross, f2l_1..4, oll, pll                    (6 axes, cstimer cf4op)
 *   cfop2 — cross, f2l_1..4, eo, co, cp, ep              (6 axes, cstimer cf4o2p2)
 *   roux  — fb, sb, cmll, lse                            (24 axes, cstimer roux)
 *   zz    — eoline, block_1, block_2, ll                 (6 axes, Zkt-Timer original)
 */

export interface SolveTurn {
	turn: string;
	timestamp: number;
}

export type SolveMethod = 'cfop' | 'cfop2' | 'roux' | 'zz';

/**
 * Phase id. Free-form because each method names its own steps; the method
 * definition (shared/util/solve/methods/) is the source of truth for which
 * ids exist and in what order.
 */
export type SolvePhase = string;

/**
 * Legacy CFOP-only union. Kept so existing call sites keep type-checking;
 * new code should use SolvePhase.
 */
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
	phase: SolvePhase;
	turnIndex: number;
	timestamp: number;
	recognitionStart: number;
	firstMoveTimestamp: number;
	moveCount: MoveCounts;
	moves: string[];
	moveTimestamps?: number[]; // cstimer getPrettyMoves 100ms burst detection
	skipped: boolean;
	/**
	 * Set only by mergeOneMovePhases: this phase genuinely happened (real moves, a real
	 * progress descent) but was cosmetically folded into the next phase for display
	 * because it was too short (1 HTM) to show on its own. Distinct from a `skipped`
	 * phase whose progress level was jumped past with zero moves of its own — that one
	 * truly didn't happen as a step; this one did, it's just not shown separately.
	 * Method-detection scoring reads this to avoid penalizing a method's ladder for
	 * something that actually completed.
	 */
	merged?: boolean;
}

/**
 * Which algorithm set a recognized case belongs to. Drives both the lookup
 * table used for the case name and the `case_set` column written to the DB.
 */
export type CaseSet = 'oll' | 'pll' | 'coll' | 'cmll' | 'zbll';

export interface CaseMatch {
	case: string;
	key: string;
}

/** A recognized case bound to the phase it was recognized for. */
export interface IdentifiedCase extends CaseMatch {
	set: CaseSet;
	phase: SolvePhase;
}

export interface PhaseEngineResult {
	transitions: PhaseTransition[];
	totalMoves: MoveCounts;
	totalTimeMs: number;
	/** Every case the method recognized, in phase order. */
	cases: IdentifiedCase[];
	/** Convenience aliases for the CFOP consumers that predate `cases`. */
	ollIdentified?: CaseMatch;
	pllIdentified?: CaseMatch;
	prettyRecon: string;
	method: SolveMethod;
	finalProgress: number;
	/**
	 * Reference face the method locked onto: cross face for CFOP/ZZ, first-block
	 * face for Roux. Null when no phase completed.
	 */
	crossFace: string | null;
}

export interface AnalyzeOptions {
	method?: SolveMethod;
	identifyOLL?: boolean;
	identifyPLL?: boolean;
	/** Turns off every case lookup at once (used by the bulk stats worker). */
	identifyCases?: boolean;
}
