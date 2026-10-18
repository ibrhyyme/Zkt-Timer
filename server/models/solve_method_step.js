import { getPrisma } from '../database';
import { generateUUID } from '../../shared/code';
import { methodStepRowsFromSteps } from '../../shared/util/solve/solve_steps';

export function deleteSolveMethodSteps(solve) {
	return getPrisma().solveMethodStep.deleteMany({
		where: {
			solve_id: solve.id,
		},
	});
}

// One row builder for the server and the device (shared/util/solve/solve_steps.ts), so a
// breakdown the phone computes without a connection has exactly the stored shape.
function buildSolveMethodStepRows(solve, steps) {
	return methodStepRowsFromSteps(solve.id, steps, () => generateUUID());
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
