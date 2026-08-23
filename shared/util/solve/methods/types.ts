/**
 * Method definition contract.
 *
 * Everything method-specific lives behind this interface so the engine
 * (shared/util/solve/phase_engine.ts) stays method-agnostic. Adding a method
 * means adding one file here and registering it — the engine does not change.
 */

import { CaseMatch, CaseSet, SolveMethod, SolvePhase } from '../types';

export interface CaseSpec {
	/** The phase whose execution solves this case. */
	phase: SolvePhase;
	set: CaseSet;
	/**
	 * Phases to read the "before" state from, most preferred first. The case is
	 * recognized from the cube as it looked when the phase STARTED, which is the
	 * end state of whichever earlier phase completed last.
	 */
	fromPhases: SolvePhase[];
	identify(beforeState: string): CaseMatch | null;
}

export interface MethodDefinition {
	id: SolveMethod;
	/** Orientations to scan. 6 when only the down-face matters, 24 when y position matters too. */
	axisCount: number;
	/** Progress value meaning "nothing solved yet" — the top of the ladder. */
	maxProgress: number;
	/** Step ids in execution order. */
	steps: SolvePhase[];
	/**
	 * Progress level -> the step that COMPLETED when progress dropped to it.
	 * Returns null for levels that map to no step.
	 */
	progressToPhase(newProgress: number): SolvePhase | null;
	/**
	 * Progress for a single orientation. `getCube` lazily builds the rotated
	 * cubejs object for methods needing piece-level state (edge orientation);
	 * mask-based methods ignore it and stay on the cheap string path.
	 */
	getProgress(facelet: string, getCube: () => any): number;
	caseSpecs: CaseSpec[];
}
