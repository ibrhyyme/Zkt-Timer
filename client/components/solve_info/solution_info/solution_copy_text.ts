/**
 * The two clipboard texts on a smart cube solve's Solution tab.
 *
 * The normal copy is the same text a normal solve shares, plus TPS. The detailed copy
 * replaces a cstimer-style reconstruction that ended in move-metric counts (OBTM, ETM, STM)
 * nobody reading it could use, and that printed moves in the cube's own frame while the
 * table beside it shows them in the solver's. Everything here reads what the Solution and
 * Stats tabs already show, so the clipboard never disagrees with the screen.
 */

import dayjs from 'dayjs';
import {generateSolvesStatsText} from '../../../util/average_text';
import {getTimeString} from '../../../util/time';
import {getStepDisplayName, STEP_NAME_MAP} from '../util/consts';
import {simplifyMoves, transformMoves} from '../util/cross_rotation';
import {getSmartSolveTps} from '../util/solution';
import type {Solve} from '../../../../server/schemas/Solve.schema';
import type {SolveMethodStep} from '../../../../server/schemas/SolveStepMethod.schema';

type Translate = (key: string, opts?: any) => string;

type CopyStep = Pick<SolveMethodStep, 'step_name' | 'parent_name' | 'turns' | 'total_time' | 'oll_case_key' | 'pll_case_key'>;

export interface StepGroupSummary {
	label: string;
	/** Seconds spent on the stage, recognition included. */
	total: number;
}

function formatTps(solve: Solve): string {
	const tps = getSmartSolveTps(solve);
	return tps === null ? '-' : tps.toFixed(2);
}

/**
 * One line per step, "moves // Step name", in the orientation the solver held the cube.
 *
 * The cube reports moves relative to its own core; a solver who did the cross on the bottom
 * turned "R" as their "L". `rotation` is that correction, and the cross line carries it as a
 * prefix so the reconstruction replays from the scrambled state.
 */
export function buildStepMoveLines(steps: CopyStep[], rotation: string): string[] {
	const lines: string[] = [];
	for (const step of steps) {
		const moves = simplifyMoves(rotation ? transformMoves(step.turns, rotation) : step.turns);
		if (!moves) continue;
		const prefix = step.step_name === 'cross' && rotation ? `${rotation} ` : '';
		lines.push(`${prefix}${moves} // ${getStepDisplayName(step as SolveMethodStep)}`);
	}
	return lines;
}

/**
 * Total time per stage: Cross, F2L, OLL, PLL for CFOP.
 *
 * Grouped on the parent step, so the four F2L slots add up to one F2L line, and a Roux or ZZ
 * solve groups by its own stages without a method-specific branch. A step's `total_time`
 * already includes its recognition, so the stage total is a plain sum.
 */
export function summarizeStepGroups(steps: CopyStep[]): StepGroupSummary[] {
	const groups = new Map<string, StepGroupSummary>();
	for (const step of steps) {
		const key = step.parent_name || step.step_name;
		let group = groups.get(key);
		if (!group) {
			group = {label: STEP_NAME_MAP[key] || key, total: 0};
			groups.set(key, group);
		}
		group.total += step.total_time || 0;
	}
	return [...groups.values()];
}

/** The normal solve share text, with TPS underneath because this solve has it. */
export function buildSmartSolveCopyText(t: Translate, solve: Solve): string {
	const statsText = generateSolvesStatsText(t, t('solve_info.single_solve'), solve.time, [solve], true);
	return `${statsText}\nTPS: ${formatTps(solve)}`;
}

export function buildSmartSolveDetailedCopyText(
	t: Translate,
	solve: Solve,
	steps: CopyStep[],
	rotation: string
): string {
	const time = solve.dnf ? 'DNF' : getTimeString(solve.time, 2) + (solve.plus_two ? '+' : '');

	const lines: string[] = [
		t('solve_info.generated_by', {date: dayjs(solve.started_at).format('YYYY-MM-DD')}),
		`${t('solve_info.copy_scramble')}: ${solve.scramble || ''}`,
		`${t('solve_info.copy_time')}: ${time}`,
		`TPS: ${formatTps(solve)}`,
	];

	const moveLines = buildStepMoveLines(steps, rotation);
	if (moveLines.length) {
		lines.push('', ...moveLines);
	}

	const groups = summarizeStepGroups(steps);
	if (groups.length) {
		lines.push('');
		for (const g of groups) {
			lines.push(`${g.label}: ${getTimeString(g.total, 2)}`);
		}
	}

	return lines.join('\n');
}
