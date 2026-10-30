import {
	buildSmartSolveCopyText,
	buildSmartSolveDetailedCopyText,
	buildStepMoveLines,
	summarizeStepGroups,
} from '../solution_copy_text';
import {simplifyMoves, transformMoves} from '../../util/cross_rotation';

// Echo the key and its date so assertions can see which string went where.
const t = (key: string, opts?: any) => (opts && opts.date ? `${key} ${opts.date}` : key);

function step(step_name: string, turns: string, total_time: number, recognition_time: number, parent_name: string | null = null) {
	const turn_count = turns.split(' ').filter(Boolean).length;
	return {step_name, turns, total_time, recognition_time, turn_count, parent_name, oll_case_key: null, pll_case_key: null};
}

const CFOP_STEPS = [
	step('cross', 'R U', 2.0, 0.5),
	step('f2l_1', 'U R U\' R\'', 1.5, 0.4, 'f2l'),
	step('f2l_2', 'L U L\'', 1.2, 0.3, 'f2l'),
	step('f2l_3', 'R U R\'', 1.0, 0.2, 'f2l'),
	step('f2l_4', 'F U F\'', 1.1, 0.3, 'f2l'),
	step('oll', 'R U R\' U R U2 R\'', 1.4, 0.6),
	step('pll', 'R U R\' U\' R\' F R2 U\' R\' U\' R U R\' F\'', 2.0, 0.7),
];

function solve(overrides: Record<string, any> = {}): any {
	return {
		id: 's1',
		time: 12.34,
		raw_time: 12.34,
		smart_turn_count: 50,
		dnf: false,
		plus_two: false,
		scramble: "R U2 F' L2",
		started_at: new Date('2026-09-23T10:00:00Z').getTime(),
		ended_at: new Date('2026-09-23T10:00:12Z').getTime(),
		cube_type: '333',
		...overrides,
	};
}

describe('summarizeStepGroups', () => {
	it('folds the four F2L slots into one line and keeps the CFOP order', () => {
		const groups = summarizeStepGroups(CFOP_STEPS as any);
		expect(groups.map((g) => g.label)).toEqual(['Cross', 'F2L', 'OLL', 'PLL']);
		// Step times already include recognition, so the stage total is their plain sum.
		expect(groups[1].total).toBeCloseTo(1.5 + 1.2 + 1.0 + 1.1);
		expect(groups.map((g) => g.turns)).toEqual([2, 4 + 3 + 3 + 3, 7, 14]);
	});
});

describe('buildStepMoveLines', () => {
	it('prints moves in the solver\'s orientation, with the rotation leading the cross', () => {
		const lines = buildStepMoveLines([step('cross', 'R U', 1, 0)] as any, 'z2');
		expect(lines[0]).toBe(`z2 ${simplifyMoves(transformMoves('R U', 'z2'))} // Cross`);
		// The old detailed copy printed the cube's own frame; with a rotation the two differ.
		expect(lines[0]).not.toContain('R U //');
	});

	it('prints the gyro reconstruction the table shows, rotations and its holding included', () => {
		const steps = [step('cross', 'R U', 1, 0), step('f2l_1', "B U B'", 1, 0, 'f2l'), step('pll', "R L' U2", 1, 0)];
		const gyro = { holding: 'z2 y', byStep: [['L', 'D'], ['y', 'R', 'U', "R'"], ['M', 'U2']] };
		expect(buildStepMoveLines(steps as any, 'z2', gyro)).toEqual([
			'z2 y L D // Cross',
			"y R U R' // F2L Slot 1",
			'M U2 // PLL',
		]);
	});

	it('skips steps with no moves', () => {
		const lines = buildStepMoveLines([step('oll', '', 0, 0), step('pll', 'U', 1, 0)] as any, '');
		expect(lines).toEqual(['U // PLL']);
	});
});

describe('buildSmartSolveDetailedCopyText', () => {
	it('has scramble, time, TPS, the steps and the stage summary, and no move metrics', () => {
		const text = buildSmartSolveDetailedCopyText(t, solve(), CFOP_STEPS as any, '');
		expect(text).toContain("solve_info.copy_scramble: R U2 F' L2");
		expect(text).toContain('solve_info.copy_time: 12.34');
		expect(text).toContain('TPS: 4.05');
		expect(text).toContain('// F2L Slot 3');
		expect(text).toMatch(/^Cross: 2\.00 \(2 smart_cube\.turns_label\)$/m);
		expect(text).toMatch(/^F2L: 4\.80 \(13 smart_cube\.turns_label\)$/m);
		expect(text).toMatch(/^PLL: 2\.00 \(14 smart_cube\.turns_label\)$/m);
		expect(text).not.toContain('solve_info.recognition');
		expect(text).not.toMatch(/OBTM|ETM|STM|HTM/);
	});

	it('leaves the move count off a stage whose steps have none stored', () => {
		const old = [{...step('cross', 'R U', 2.0, 0.5), turn_count: 0}];
		expect(buildSmartSolveDetailedCopyText(t, solve(), old as any, '')).toMatch(/^Cross: 2\.00$/m);
	});

	it('writes DNF and +2 the way the solve card does', () => {
		expect(buildSmartSolveDetailedCopyText(t, solve({dnf: true}), [], '')).toContain('solve_info.copy_time: DNF');
		expect(buildSmartSolveDetailedCopyText(t, solve({plus_two: true}), [], '')).toContain('solve_info.copy_time: 12.34+');
	});

	it('prints a dash for TPS when the solve has no raw time', () => {
		expect(buildSmartSolveDetailedCopyText(t, solve({raw_time: 0}), [], '')).toContain('TPS: -');
	});
});

describe('buildSmartSolveCopyText', () => {
	it('is the normal share text with TPS underneath', () => {
		const text = buildSmartSolveCopyText(t, solve());
		expect(text.startsWith('solve_info.generated_by 2026-09-23')).toBe(true);
		expect(text).toContain("R U2 F' L2");
		expect(text.split('\n').pop()).toBe('TPS: 4.05');
	});
});
