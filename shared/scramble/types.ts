/**
 * Scramble system type definitions.
 * All scramble type IDs, generator function signature, and worker message protocol.
 */

// Generator function signature: returns a scramble string
export type ScrambleGenerator = (typeId: string, length?: number, state?: number) => string;

// Worker message types
export interface ScrambleWorkerRequest {
	id: number;
	typeId: string;
	length?: number;
	state?: number;
}

export interface ScrambleWorkerResponse {
	id: number;
	scramble: string;
	error?: string;
}

export interface ScrambleWorkerInitResponse {
	type: 'init';
	ready: boolean;
	elapsed: number;
}

// Heavy scramble types that need Web Worker on client
export const ASYNC_SCRAMBLE_TYPES = new Set([
	'333', '333fm',
	'pll', 'oll', 'll', 'f2l', 'lsll2',
	'zbll', 'zzll', 'zbls', 'coll', 'cll', 'ell', '2gll', 'ttll',
	'eols', 'wvls', 'vls',
	'lse', 'cmll', 'sbrx', 'lsemu',
	'mt3qb', 'mteole', 'mttdr', 'mt6cp', 'mtl5ep', 'mtcdrll',
	'eoline', 'eocross',
	'edges', 'corners',
	'333drud', 'half',
	'2gen', '2genl', '3gen_F', '3gen_L', 'RrU', 'roux',
	'333ni',
	'444wca', '4edge', '444ll', '444ell', '444edo', '444cto',
	'444ctud', '444ud3c', '444l8e', '444ctrl', '444rlda', '444rlca',
	'sqrs', 'sqrcsp', 'sq1pll',
	'mgmso',
]);

export function isAsyncScrambleType(typeId: string): boolean {
	return ASYNC_SCRAMBLE_TYPES.has(typeId);
}
