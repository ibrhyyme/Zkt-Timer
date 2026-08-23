/**
 * Method registry. The engine resolves a method id through here and never
 * imports a specific method itself.
 */

import { SolveMethod } from '../types';
import { MethodDefinition } from './types';
import { CFOP_METHOD, CFOP2_METHOD } from './cfop';
import { ROUX_METHOD } from './roux';
import { ZZ_METHOD } from './zz';

const REGISTRY: Record<SolveMethod, MethodDefinition> = {
	cfop: CFOP_METHOD,
	cfop2: CFOP2_METHOD,
	roux: ROUX_METHOD,
	zz: ZZ_METHOD,
};

export const DEFAULT_METHOD: SolveMethod = 'cfop';

export function getMethod(id?: SolveMethod | string | null): MethodDefinition {
	if (id && (id as SolveMethod) in REGISTRY) {
		return REGISTRY[id as SolveMethod];
	}
	return REGISTRY[DEFAULT_METHOD];
}

export function isKnownMethod(id?: string | null): id is SolveMethod {
	return !!id && id in REGISTRY;
}

export function listMethods(): MethodDefinition[] {
	return Object.values(REGISTRY);
}

export { MethodDefinition } from './types';
export { CFOP_METHOD, CFOP2_METHOD, ROUX_METHOD, ZZ_METHOD };
