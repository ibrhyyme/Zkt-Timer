import Cube from 'cubejs';
import { getCrossRotation, getCrossSide } from '../../util/cross_rotation';
import { f2lSlotFaces } from '../../util/f2l_slots';
import { parseSmartTurns } from '../../../../../shared/smart_cube/parse_turns';
import { splitTurnsBySteps } from '../../../../../shared/smart_cube/rotation_reconstruction';
import { prepareAlgs } from '../../../../../shared/smart_cube/ll_alg_match';
import { reconstructFromState } from '../../../../../shared/smart_cube/state_reconstruction';
import fixture from '../../../../../shared/smart_cube/__tests__/fixtures/state_reading_solves.json';

// The public library, as a signed-out viewer of a shared solve gets it (useLastLayerAlgs).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const library = require('../../../../../public/trainer/default-algs.json');
const algsOf = (category: string) =>
	prepareAlgs(library[category].flatMap((s: any) => s.algorithms.flatMap((a: any) => [a.algorithm, ...(a.alternatives || [])])));
const OLL = algsOf('OLL');
const PLL = algsOf('PLL');

/** The rows SolutionInfo shows for a gyro solve, put together the same way. */
function rows(solve: (typeof fixture.solves)[number]) {
	const turns = parseSmartTurns(solve.smart_turns);
	const names = solve.steps.map((s) => s.step_name);
	const cross = solve.steps.find((s) => s.step_name === 'cross')!;
	const holding = getCrossRotation(solve.scramble, cross.turns);
	const ranges = splitTurnsBySteps(turns.map((t) => t.turn), solve.steps.map((s) => s.turns))!;
	const slots = f2lSlotFaces(solve.scramble, turns.map((t) => t.turn), ranges, names, getCrossSide(solve.scramble, cross.turns));
	const r = reconstructFromState(
		turns,
		ranges.map((range, i) => ({
			range,
			slot: slots[i] ? ([slots[i]!.left, slots[i]!.right] as const) : null,
			algs: names[i] === 'oll' ? OLL : names[i] === 'pll' ? PLL : null,
		})),
		holding
	);
	const byStep: Record<string, string> = {};
	ranges.forEach(([start, end], i) => {
		byStep[names[i]] = r.tokens.filter((k) => k.rawStart >= start && k.rawStart < end).map((k) => k.move).join(' ');
	});
	return { holding: r.holding, byStep, text: [r.holding, ...r.tokens.map((k) => k.move)].join(' ') };
}

const solvedBy = (alg: string) => {
	const cube = new Cube();
	cube.move(alg);
	const s = cube.asString();
	return [0, 1, 2, 3, 4, 5].every((f) => new Set(s.slice(f * 9, f * 9 + 9)).size === 1);
};

const byId = (id: string) => rows(fixture.solves.find((s) => s.id === id)!);

describe('the rows of a real gyro solve, read without the gyro', () => {
	it.each(fixture.solves.map((s) => [s.id, s] as const))('%s: the scramble and the text as shared solve the cube', (_, solve) => {
		expect(solvedBy(`${solve.scramble} ${rows(solve).text}`)).toBe(true);
	});

	it.each(fixture.solves.map((s) => [s.id] as const))('%s: no F2L row is read with B, b or S', (id) => {
		const { byStep } = byId(id);
		for (const name of ['f2l_1', 'f2l_2', 'f2l_3', 'f2l_4']) expect(byStep[name]).not.toMatch(/(^| )[BbS]/);
	});

	it('writes the G perm the gyro reading turned into S D\' S\' B R B\'', () => {
		expect(byId('4b1a73b8').byStep.pll).toBe("U' R2 U R' U R' U' R U' R2 D U' R' U R D'");
	});

	it('puts the centres back after a slice in the cross, and reads the last layer as algorithms', () => {
		const { byStep } = byId('2ba5ba1c');
		expect(byStep.f2l_1.split(' ')[0]).toBe('z');
		expect(byStep.oll).toBe("U' R U R' U' M' U R U' r'");
	});

	it('reads the slot a missed y left as U B U B\' U L U L\' with the slot in front', () => {
		expect(byId('ac09fe86').byStep.f2l_1).toBe("y' U F U F' U R U R'");
	});
});
