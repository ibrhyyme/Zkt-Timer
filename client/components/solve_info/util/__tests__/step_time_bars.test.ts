import {formatBarTime, getStepTimeBars, getTimeAxis} from '../solution';

function solveWith(steps: Record<string, unknown>[]): any {
	return {solve_method_steps: steps};
}

describe('getStepTimeBars', () => {
	test('splits a step into recognition and the rest', () => {
		const [bar] = getStepTimeBars(
			solveWith([{step_name: 'f2l_1', total_time: 2.8, recognition_time: 0.76, turn_count: 9, tps: 3.2}])
		);

		expect(bar.name).toBe('F2L Slot 1');
		expect(bar.recognition).toBeCloseTo(0.76);
		expect(bar.execution).toBeCloseTo(2.04);
		expect(bar.total).toBeCloseTo(2.8);
		expect(bar.recognitionLabel).toBe('0.76');
		expect(bar.executionLabel).toBe('2.04');
		expect(bar.turns).toBe(9);
		expect(bar.tps).toBe(3.2);
	});

	test('a cross with no recognition draws one segment', () => {
		const [bar] = getStepTimeBars(solveWith([{step_name: 'cross', total_time: 3.69, recognition_time: 0, turn_count: 7}]));

		expect(bar.recognition).toBe(0);
		expect(bar.execution).toBeCloseTo(3.69);
	});

	test('recognition past the total leaves no negative execution', () => {
		const [bar] = getStepTimeBars(solveWith([{step_name: 'oll', total_time: 1, recognition_time: 1.2, turn_count: 0}]));

		expect(bar.execution).toBe(0);
		expect(bar.recognition).toBeCloseTo(1.2);
	});

	test('a time that would print as 0.00 gets no segment', () => {
		const [bar] = getStepTimeBars(solveWith([{step_name: 'pll', total_time: 3, recognition_time: 0.004, turn_count: 12}]));

		expect(bar.recognition).toBe(0);
		expect(bar.execution).toBeCloseTo(2.996);
	});

	test('a skipped step has no column and the order is kept', () => {
		const bars = getStepTimeBars(
			solveWith([
				{step_name: 'oll', total_time: 2, recognition_time: 0.2, turn_count: 9},
				{step_name: 'pll', total_time: 0, recognition_time: 0, turn_count: 0, skipped: true},
				{step_name: 'cross', total_time: null, recognition_time: 0, turn_count: 0},
				{step_name: 'f2l_1', total_time: 1, recognition_time: 0.1, turn_count: 4},
			])
		);

		expect(bars.map((bar) => bar.key)).toEqual(['oll', 'f2l_1']);
	});

	test('parent steps give way to their children', () => {
		const bars = getStepTimeBars(
			solveWith([
				{step_name: 'f2l', total_time: 5, recognition_time: 1, turn_count: 20},
				{step_name: 'f2l_1', parent_name: 'f2l', total_time: 2, recognition_time: 0.5, turn_count: 8},
				{step_name: 'f2l_2', parent_name: 'f2l', total_time: 3, recognition_time: 0.5, turn_count: 12},
			])
		);

		expect(bars.map((bar) => bar.key)).toEqual(['f2l_1', 'f2l_2']);
	});

	test('an unknown step keeps its stored name, and the last word stays together', () => {
		const [known, unknown] = getStepTimeBars(
			solveWith([
				{step_name: 'f2l_1', total_time: 1, recognition_time: 0, turn_count: 1},
				{step_name: 'custom', total_time: 1, recognition_time: 0, turn_count: 1},
			])
		);

		expect(known.axisName).toBe('F2L Slot 1');
		expect(unknown.name).toBe('custom');
		expect(unknown.axisName).toBe('custom');
	});

	test('a solve with no steps has no bars', () => {
		expect(getStepTimeBars(solveWith([]))).toEqual([]);
		expect(getStepTimeBars({} as any)).toEqual([]);
	});
});

describe('getTimeAxis', () => {
	const labels = (longest: number) => getTimeAxis(longest).ticks.map((tick) => tick.label);

	test('round steps from zero past the longest time', () => {
		expect(labels(4.48)).toEqual(['0', '1', '2', '3', '4', '5']);
		expect(labels(2.52)).toEqual(['0.0', '0.5', '1.0', '1.5', '2.0', '2.5', '3.0']);
		expect(labels(6.66)).toEqual(['0', '2', '4', '6', '8']);
		expect(getTimeAxis(6.66).max).toBe(8);
	});

	test('a time exactly on a step ends the axis there', () => {
		expect(getTimeAxis(4).max).toBe(4);
		expect(getTimeAxis(0.6).max).toBe(0.6);
	});

	test('minutes print as minutes', () => {
		expect(labels(62.4)).toEqual(['0', '20', '40', '1:00', '1:20']);
	});

	test('a very short longest time still has an axis above it', () => {
		const axis = getTimeAxis(0.01);
		expect(axis.max).toBe(0.01);
		expect(axis.ticks.length).toBeGreaterThanOrEqual(2);
	});

	test('the axis always covers the longest time', () => {
		for (const longest of [0.03, 0.37, 0.99, 1, 1.01, 5.99, 12.1, 59.9, 61, 600.5]) {
			expect(getTimeAxis(longest).max).toBeGreaterThanOrEqual(longest);
		}
	});
});

describe('formatBarTime', () => {
	test('stays at four characters so it fits a narrow column', () => {
		expect(formatBarTime(0.23)).toBe('0.23');
		expect(formatBarTime(6.36)).toBe('6.36');
		expect(formatBarTime(12.34)).toBe('12.3');
		expect(formatBarTime(62.4)).toBe('1:02');
	});
});
