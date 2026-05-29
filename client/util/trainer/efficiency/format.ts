/**
 * Cozum gosterim/format yardimcilari.
 */
import type {SolverResult} from '../../cross-solver/types';

/**
 * Notasyon gosterimi: rotation'i da iceren okunabilir cozum string'i.
 */
export function solutionToString(result: SolverResult | null): string {
	if (!result) return '';
	if (result.solution.length === 0) return '';
	return `${result.rotation} ${result.solution.join(' ')}`.trim();
}
