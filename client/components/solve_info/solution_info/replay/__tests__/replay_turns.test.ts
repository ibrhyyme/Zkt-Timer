import { CubeModel } from '../../../../timer/smart_cube/cube_view/render/cube_model';
import { turnsUpTo } from '../replay_turns';
import { getCrossRotation, getCrossSide } from '../../../util/cross_rotation';
import { f2lSlotFaces } from '../../../util/f2l_slots';
import { expandMove } from '../../../../../util/expand_notation';
import { parseSmartTurns } from '../../../../../../shared/smart_cube/parse_turns';
import { splitTurnsBySteps } from '../../../../../../shared/smart_cube/rotation_reconstruction';
import { prepareAlgs } from '../../../../../../shared/smart_cube/ll_alg_match';
import { reconstructFromState } from '../../../../../../shared/smart_cube/state_reconstruction';
import fixture from '../../../../../../shared/smart_cube/__tests__/fixtures/state_reading_solves.json';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const library = require('../../../../../../public/trainer/default-algs.json');
const algsOf = (category: string) =>
	prepareAlgs(library[category].flatMap((s: any) => s.algorithms.flatMap((a: any) => [a.algorithm, ...(a.alternatives || [])])));
const OLL = algsOf('OLL');
const PLL = algsOf('PLL');

type FixtureSolve = (typeof fixture.solves)[number];

/** The replay's positions for a gyro solve, built the way SolutionInfo builds them. */
function gyroPositions(solve: FixtureSolve): { move: string }[] {
	const turns = parseSmartTurns(solve.smart_turns);
	const names = solve.steps.map((s) => s.step_name);
	const cross = solve.steps.find((s) => s.step_name === 'cross')!;
	const ranges = splitTurnsBySteps(turns.map((t) => t.turn), solve.steps.map((s) => s.turns))!;
	const slots = f2lSlotFaces(solve.scramble, turns.map((t) => t.turn), ranges, names, getCrossSide(solve.scramble, cross.turns));
	const { tokens } = reconstructFromState(
		turns,
		ranges.map((range, i) => ({
			range,
			slot: slots[i] ? ([slots[i]!.left, slots[i]!.right] as const) : null,
			algs: names[i] === 'oll' ? OLL : names[i] === 'pll' ? PLL : null,
		})),
		getCrossRotation(solve.scramble, cross.turns)
	);
	const byStep = ranges.map(([start, end]) => tokens.filter((k) => k.rawStart >= start && k.rawStart < end));
	return byStep.flat().map((k) => ({ move: k.raws.map((r) => turns[r].turn).join(' ') }));
}

/** The renderer's model after these turns; every one has to be notation it knows. */
function modelAfter(turns: string[]): CubeModel {
	const model = new CubeModel(3);
	for (const turn of turns) expect([turn, model.applyMove(turn)]).toEqual([turn, true]);
	return model;
}

const isSolved = (model: CubeModel) => {
	const s = model.getFacelets();
	return [0, 1, 2, 3, 4, 5].every((f) => new Set(s.slice(f * 9, f * 9 + 9)).size === 1);
};

describe('the replay on the renderer model', () => {
	it.each(fixture.solves.map((s) => [s.id, s] as const))('%s: the last gyro position shows the cube solved', (_, solve) => {
		const positions = gyroPositions(solve);
		expect(positions.length).toBeGreaterThan(0);
		expect(isSolved(modelAfter(turnsUpTo(solve.scramble, positions, positions.length)))).toBe(true);
	});

	it.each(fixture.solves.map((s) => [s.id, s] as const))('%s: the step rows, without gyro data, solve it too', (_, solve) => {
		// The flat path (useFlattenedMoves): every step's turns, multi-quarter tokens expanded.
		const positions = solve.steps.flatMap((s) =>
			(s.turns || '').split(' ').filter(Boolean).flatMap((tok) => expandMove(tok).split(' ').filter(Boolean)).map((move) => ({ move }))
		);
		expect(isSolved(modelAfter(turnsUpTo(solve.scramble, positions, positions.length)))).toBe(true);
	});

	it('starts from the scramble alone, whatever the spacing', () => {
		expect(turnsUpTo("  R U2\tF' ", [{ move: 'R' }], 0)).toEqual(['R', 'U2', "F'"]);
		expect(turnsUpTo('R', [{ move: 'L R' }, { move: '' }, { move: 'U' }], 2)).toEqual(['R', 'L', 'R']);
	});
});
