/**
 * Pretty reconstruction string formatter — cstimer tarzi annotated solve cikti.
 *
 * Ornek format:
 *   R U R' U' // cross [2.34s, 4 moves, 1.71 TPS]
 *   R U' R' U R U' R' // f2l_1 [3.21s, 7 moves, 2.18 TPS]
 *   ...
 *
 * Cikti hem clipboard'a kopyalanabilir hem de logging'de kullanilabilir.
 */

import { PhaseTransition, PhaseEngineResult } from './types';

const PHASE_LABEL: Record<string, string> = {
	cross: 'cross',
	f2l_1: 'F2L 1',
	f2l_2: 'F2L 2',
	f2l_3: 'F2L 3',
	f2l_4: 'F2L 4',
	oll: 'OLL',
	pll: 'PLL',
};

function formatLine(t: PhaseTransition, durMs: number): string {
	const moves = t.moves.join(' ');
	const seconds = (durMs / 1000).toFixed(2);
	const moveCount = t.moveCount.htm;
	const tps = durMs > 0 ? (moveCount / (durMs / 1000)).toFixed(2) : '0.00';
	const label = PHASE_LABEL[t.phase] || t.phase;
	const skipMark = t.skipped ? ' [skip]' : '';
	return `${moves} // ${label} [${seconds}s, ${moveCount} HTM, ${tps} TPS]${skipMark}`;
}

export function buildPrettyRecon(result: PhaseEngineResult): string {
	const lines: string[] = [];
	let prevEnd = 0;
	for (let i = 0; i < result.transitions.length; i++) {
		const t = result.transitions[i];
		const durMs = i === 0 ? t.timestamp - t.recognitionStart : t.timestamp - prevEnd;
		lines.push(formatLine(t, Math.max(0, durMs)));
		prevEnd = t.timestamp;
	}

	const totalSeconds = (result.totalTimeMs / 1000).toFixed(2);
	lines.push(
		`// Total: ${totalSeconds}s, ${result.totalMoves.htm} HTM (${result.totalMoves.obtm} OBTM, ${result.totalMoves.etm} ETM, ${result.totalMoves.stm} STM)`
	);
	if (result.ollIdentified) {
		lines.push(`// OLL: ${result.ollIdentified.case} (${result.ollIdentified.key})`);
	}
	if (result.pllIdentified) {
		lines.push(`// PLL: ${result.pllIdentified.case} (${result.pllIdentified.key})`);
	}
	return lines.join('\n');
}
