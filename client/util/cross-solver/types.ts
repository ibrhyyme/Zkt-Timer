export type SolverType =
	| 'cross'
	| 'xcross'
	| 'eoline'
	| 'eocross'
	| 'roux1'
	| '222face'
	| '333cf'
	| '333roux'
	| '333petrus'
	| '333zz'
	| '333222'
	| '333eodr'
	| 'sq1cs'
	| 'pyrv'
	| 'skbl1';

export interface SolverResult {
	face: string;
	rotation: string;
	solution: string[];
	moveCount: number;
}

export interface SolverWorkerRequest {
	cmd: 'init' | 'solve';
	id?: number;
	scramble?: string;
	solverType?: SolverType;
	orientation?: string;
}

export const STEP_SOLVER_TYPES: SolverType[] = [
	'333cf', '333roux', '333petrus', '333zz', '333eodr',
];

export const CUBE_ORIENTATIONS = [
	'z2', '', 'z', "z'", 'x', "x'",
	'z2 y', 'z2 y2', "z2 y'",
	'y', 'y2', "y'",
	'z y', 'z y2', "z y'",
	"z' y", "z' y2", "z' y'",
	'x y', 'x y2', "x y'",
	"x' y", "x' y2", "x' y'",
];

export interface SolverWorkerResponse {
	cmd: 'init' | 'solve';
	id?: number;
	status?: string;
	results?: SolverResult[];
	error?: string;
}
