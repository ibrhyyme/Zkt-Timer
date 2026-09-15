import {computeYearlyPricing} from '../pricing';

describe('computeYearlyPricing', () => {
	it('computes TRY savings and per-month price from the decided store prices', () => {
		const result = computeYearlyPricing(
			{price: 99.99, currencyCode: 'TRY'},
			{price: 899.99, currencyCode: 'TRY'}
		);

		expect(result).not.toBeNull();
		expect(result!.savingsPercent).toBe(25);
		// Locale-agnostic: just confirm the ~75 figure landed, regardless of symbol/decimal style.
		expect(result!.perMonthString).toMatch(/75[.,]00|75\b/);
	});

	it('computes USD savings and per-month price from the decided store prices', () => {
		const result = computeYearlyPricing(
			{price: 2.99, currencyCode: 'USD'},
			{price: 19.99, currencyCode: 'USD'}
		);

		expect(result).not.toBeNull();
		expect(result!.savingsPercent).toBe(44);
		expect(result!.perMonthString).toMatch(/1[.,]67/);
	});

	it('prefers the store-provided pricePerMonthString when available', () => {
		const result = computeYearlyPricing(
			{price: 2.99, currencyCode: 'USD'},
			{price: 19.99, currencyCode: 'USD', pricePerMonthString: '$1.67'}
		);

		expect(result!.perMonthString).toBe('$1.67');
	});

	it('falls back to null when the monthly product is missing', () => {
		expect(computeYearlyPricing(undefined, {price: 19.99, currencyCode: 'USD'})).toBeNull();
	});

	it('falls back to null when the yearly product is missing', () => {
		expect(computeYearlyPricing({price: 2.99, currencyCode: 'USD'}, undefined)).toBeNull();
	});

	it('falls back to null when a price is zero or missing', () => {
		expect(computeYearlyPricing({price: 0, currencyCode: 'USD'}, {price: 19.99, currencyCode: 'USD'})).toBeNull();
		expect(computeYearlyPricing({price: 2.99, currencyCode: 'USD'}, {price: 0, currencyCode: 'USD'})).toBeNull();
	});

	it('falls back to a plain numeric string for an unknown currency code', () => {
		const result = computeYearlyPricing(
			{price: 2.99, currencyCode: 'NOT_A_CODE'},
			{price: 19.99, currencyCode: 'NOT_A_CODE'}
		);

		expect(result).not.toBeNull();
		expect(result!.perMonthString).toBe('1.67 NOT_A_CODE');
	});
});
