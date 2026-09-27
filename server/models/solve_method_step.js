import { getPrisma } from '../database';
import { generateUUID } from '../../shared/code';

export function deleteSolveMethodSteps(solve) {
	return getPrisma().solveMethodStep.deleteMany({
		where: {
			solve_id: solve.id,
		},
	});
}

function buildSolveMethodStepRows(solve, steps) {
	const data = [];

	// getSolveSteps tags its output with the method it ran, so the rows record
	// which ladder produced them instead of assuming CFOP.
	const methodName = steps.__method || 'cfop';

	for (const step of Object.keys(steps)) {
		if (step === '__method') {
			continue;
		}

		const method = steps[step];

		if (!method) {
			continue;
		}

		data.push({
			id: generateUUID(),
			solve_id: solve.id,
			turn_count: method.turnCount || 0,
			turns: method.turnsString,
			total_time: method.time,
			parent_name: method.parentName,
			tps: method.tps,
			skipped: method.skipped,
			recognition_time: method.recognitionTime,
			oll_case_key: method.ollCaseKey || null,
			pll_case_key: method.pllCaseKey || null,
			case_key: method.caseKey || null,
			case_set: method.caseSet || null,
			method_name: methodName,
			step_index: method.index,
			step_name: step,
		});
	}

	return data;
}

export async function createSolveMethodSteps(solve, steps) {
	const data = buildSolveMethodStepRows(solve, steps);
	await getPrisma().solveMethodStep.createMany({ data });
	return data;
}

/**
 * Swaps a solve's steps for a new set in one transaction.
 *
 * Delete and create used to be two separate statements, so a failure between them left
 * the solve with no steps at all, and a bulk re-import running alongside the reindex
 * job could interleave the two and leave the solve with both sets. The solve row is
 * locked first so two replacements of the same solve run one after the other.
 *
 * There is deliberately no unique (solve_id, step_name) constraint to lean on instead:
 * db push refuses to add one while duplicate rows exist, and a refused push stops the
 * container from starting.
 */
export async function replaceSolveMethodSteps(solve, steps) {
	const data = buildSolveMethodStepRows(solve, steps);
	await getPrisma().$transaction(async (tx) => {
		await tx.$queryRaw`SELECT id FROM solve WHERE id = ${solve.id} FOR UPDATE`;
		await tx.solveMethodStep.deleteMany({ where: { solve_id: solve.id } });
		if (data.length) {
			await tx.solveMethodStep.createMany({ data });
		}
	});
	return data;
}
