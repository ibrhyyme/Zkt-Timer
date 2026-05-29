/**
 * Case key (e.g., '333_oll_29') -> 21-char LL pattern lookup.
 *
 * Sync getCasePattern: ll-patterns.json cache + in-memory cache.
 * Async ensureCasePattern: on cache miss, generate at runtime with cubing.js
 * and write to local Map — next getCasePattern will find it.
 *
 * algorithms.ts and ll-patterns.json are not fully in sync: 18-20 cases
 * differ (generated from different sources); fallback generation closes this gap.
 *
 * NOTE: We do NOT write to trainer's localStorage custom_patterns field — to avoid
 * overwriting user's manually-assigned patterns in trainer, we use local cache.
 */

import algorithms from '../../../../util/algorithms/algorithms';
import { getLLPattern, loadLLPatterns } from '../../../../util/trainer/ll_patterns';
import { generateLLPattern } from '../../../../util/trainer/pattern_utils';

const ALG_KEY: Record<'oll' | 'pll', string> = {
	oll: '3_oll',
	pll: '3_pll',
};

const generatedCache = new Map<string, string>();
const generationInFlight = new Set<string>();

function getCaseSolution(type: 'oll' | 'pll', caseKey: string): string | null {
	const entry = (algorithms as any)[ALG_KEY[type]]?.[caseKey];
	return entry?.defaultSolution || null;
}

export function getCasePattern(type: 'oll' | 'pll', caseKey: string): string {
	const alg = getCaseSolution(type, caseKey);
	if (!alg) return '';
	return generatedCache.get(alg) || getLLPattern(alg) || '';
}

export async function ensureCasePattern(type: 'oll' | 'pll', caseKey: string): Promise<string> {
	const alg = getCaseSolution(type, caseKey);
	if (!alg) return '';
	const cached = generatedCache.get(alg) || getLLPattern(alg);
	if (cached) return cached;
	if (generationInFlight.has(alg)) return '';
	generationInFlight.add(alg);
	try {
		const generated = await generateLLPattern(alg);
		if (generated) {
			generatedCache.set(alg, generated);
		}
		return generated || '';
	} catch {
		return '';
	} finally {
		generationInFlight.delete(alg);
	}
}

export { loadLLPatterns };
