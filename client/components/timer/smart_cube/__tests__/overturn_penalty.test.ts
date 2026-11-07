const stored = new Map<string, any>();
const toggle = jest.fn();

jest.mock('../../../../db/solves/query', () => ({fetchSolve: (id: string) => stored.get(id) ?? null}));
jest.mock('../../../../db/solves/operations', () => ({togglePlusTwoSolveDb: (s: any) => toggle(s)}));

import {applyOverturnPenalty} from '../overturn_penalty';

describe('applyOverturnPenalty', () => {
	beforeEach(() => {
		stored.clear();
		toggle.mockClear();
		(jest.useFakeTimers as unknown as (config: {legacyFakeTimers: boolean}) => void)({legacyFakeTimers: true});
	});
	afterEach(() => jest.useRealTimers());

	it('adds +2 and tells the caller', () => {
		const solve = {id: 'a', dnf: false, plus_two: false};
		stored.set('a', solve);
		const applied = jest.fn();

		applyOverturnPenalty('a', applied);

		expect(toggle).toHaveBeenCalledWith(solve);
		expect(applied).toHaveBeenCalledTimes(1);
	});

	it.each([
		['already +2', {dnf: false, plus_two: true}],
		['a DNF', {dnf: true, plus_two: false}],
	])('leaves %s alone', (_name, fields) => {
		stored.set('a', {id: 'a', ...fields});
		const applied = jest.fn();

		applyOverturnPenalty('a', applied);

		expect(toggle).not.toHaveBeenCalled();
		expect(applied).not.toHaveBeenCalled();
	});

	it('looks once more for a solve still being saved', () => {
		const applied = jest.fn();
		applyOverturnPenalty('a', applied);
		expect(applied).not.toHaveBeenCalled();

		stored.set('a', {id: 'a', dnf: false, plus_two: false});
		jest.advanceTimersByTime(1000);

		expect(applied).toHaveBeenCalledTimes(1);
	});

	it('gives up after that', () => {
		const applied = jest.fn();
		applyOverturnPenalty('a', applied);
		jest.advanceTimersByTime(1000);

		stored.set('a', {id: 'a', dnf: false, plus_two: false});
		jest.advanceTimersByTime(5000);

		expect(applied).not.toHaveBeenCalled();
	});
});
