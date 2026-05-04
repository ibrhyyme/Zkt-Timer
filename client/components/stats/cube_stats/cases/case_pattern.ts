/**
 * Case key (orn '333_oll_29') -> 21-char LL pattern lookup.
 *
 * Sync getCasePattern: ll-patterns.json cache + bizim in-memory cache.
 * Async ensureCasePattern: cache miss durumunda runtime'da cubing.js ile uretip
 * yerel Map'e yazar — sonraki getCasePattern bulur.
 *
 * algorithms.ts ile ll-patterns.json arasinda 18-20 case senkronize degil
 * (farkli kaynaklardan generate edildi); fallback bu uretim farkini kapatir.
 *
 * NOT: Trainer'in localStorage custom_patterns alanina YAZMIYORUZ — kullanicinin
 * trainer'da manuel atadigi custom pattern'leri ezmemek icin yerel cache.
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
