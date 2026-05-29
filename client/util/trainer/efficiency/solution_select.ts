/**
 * Solver sonuc kumesi icinden gosterilecek cozumu secer.
 * Rotation scramble'a prepend edildiginden cross HEP D yuzunde olur (rotation alt
 * yuzu/rengi belirler) — ayri renk parametresi yok. Saf fonksiyonlar.
 */
import type {SolverResult} from '../../cross-solver/types';
import type {EfficiencyType, EoAxis} from '../../../components/trainer/efficiency/types';

export function selectSolution(
	results: SolverResult[],
	type: EfficiencyType,
	eoAxis: EoAxis
): SolverResult | null {
	if (!results.length) return null;
	const target = type === 'eocross' ? `D(${eoAxis})` : 'D';
	return results.find((r) => r.face === target) ?? null;
}

/**
 * "Tum cozumler" modu: skip (0-move) cozumleri eler, move count'a gore artan sirala.
 */
export function sortSolutions(results: SolverResult[]): SolverResult[] {
	return results.filter((r) => r.moveCount > 0).sort((a, b) => a.moveCount - b.moveCount);
}
