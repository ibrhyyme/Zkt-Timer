import {DNF_TIME, invalidSolveTimeFields, isValidSolveTime} from '../solve';

describe('isValidSolveTime', () => {
	describe('DNF sentinel', () => {
		// The regression this suite exists for: a guard added to Solve.resolver.ts read the
		// app's own DNF sentinel as corrupt data, so every solve that was DNF at the moment
		// it was created was refused by the server for two months.
		it('accepts the DNF sentinel on time', () => {
			expect(isValidSolveTime('time', DNF_TIME)).toBe(true);
			expect(isValidSolveTime('time', -1)).toBe(true);
		});

		it('rejects the sentinel on raw_time, which no producer ever writes negative', () => {
			expect(isValidSolveTime('raw_time', -1)).toBe(false);
		});

		it('rejects other negatives on time, so real corruption is still caught', () => {
			expect(isValidSolveTime('time', -2)).toBe(false);
			expect(isValidSolveTime('time', -0.5)).toBe(false);
			expect(isValidSolveTime('time', -1.0001)).toBe(false);
			expect(isValidSolveTime('time', -Number.MAX_SAFE_INTEGER)).toBe(false);
		});
	});

	describe('non-finite values', () => {
		it('rejects NaN and infinities on both fields', () => {
			for (const field of ['time', 'raw_time'] as const) {
				expect(isValidSolveTime(field, NaN)).toBe(false);
				expect(isValidSolveTime(field, Infinity)).toBe(false);
				expect(isValidSolveTime(field, -Infinity)).toBe(false);
			}
		});

		it('rejects values that are not numbers', () => {
			expect(isValidSolveTime('time', '12.34')).toBe(false);
			expect(isValidSolveTime('time', {})).toBe(false);
			expect(isValidSolveTime('time', [])).toBe(false);
			expect(isValidSolveTime('time', true)).toBe(false);
		});
	});

	describe('absent values', () => {
		// SolveInput fields are optional; an update that does not touch a time must not be
		// rejected for the field it left alone.
		it('accepts null and undefined', () => {
			expect(isValidSolveTime('time', null)).toBe(true);
			expect(isValidSolveTime('time', undefined)).toBe(true);
			expect(isValidSolveTime('raw_time', null)).toBe(true);
			expect(isValidSolveTime('raw_time', undefined)).toBe(true);
		});
	});

	describe('ordinary times', () => {
		it('accepts zero and positive values on both fields', () => {
			for (const field of ['time', 'raw_time'] as const) {
				expect(isValidSolveTime(field, 0)).toBe(true);
				expect(isValidSolveTime(field, 0.27)).toBe(true);
				expect(isValidSolveTime(field, 12.34)).toBe(true);
				expect(isValidSolveTime(field, 600)).toBe(true);
			}
		});
	});
});

describe('invalidSolveTimeFields', () => {
	it('returns nothing for a storable solve', () => {
		expect(invalidSolveTimeFields({time: 12.34, raw_time: 12.34})).toEqual([]);
	});

	it('returns nothing for a DNF solve as the app writes it', () => {
		// What save.ts produces for an inspection timeout: sentinel time, raw_time clamped
		// to zero by Math.max(time, 0).
		expect(invalidSolveTimeFields({time: -1, raw_time: 0})).toEqual([]);
	});

	it('returns nothing for a solve that carries no times at all', () => {
		expect(invalidSolveTimeFields({})).toEqual([]);
	});

	it('names the offending field', () => {
		expect(invalidSolveTimeFields({time: 12.34, raw_time: -5})).toEqual(['raw_time']);
		expect(invalidSolveTimeFields({time: -7, raw_time: 12.34})).toEqual(['time']);
	});

	it('names every offending field, in a stable order', () => {
		expect(invalidSolveTimeFields({time: NaN, raw_time: -5})).toEqual(['time', 'raw_time']);
	});
});
