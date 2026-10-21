import {computeYearlyPricing, splitPriceString} from '../pricing';

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

describe('splitPriceString', () => {
	it('reads Turkish decimals with the lira sign after the number', () => {
		expect(splitPriceString('899,99 ₺')).toEqual({
			prefix: '', integer: 899, decimals: '99', decimalSep: ',', groupSep: '.', suffix: ' ₺',
		});
	});

	it('treats a three digit tail as a thousands group, not decimals', () => {
		const parts = splitPriceString('1.800 ₺');
		expect(parts.integer).toBe(1800);
		expect(parts.decimals).toBe('');
		expect(parts.groupSep).toBe('.');
		expect(parts.suffix).toBe(' ₺');
	});

	it('reads a US price with the symbol in front', () => {
		const parts = splitPriceString('$19.99');
		expect(parts).toMatchObject({prefix: '$', integer: 19, decimals: '99', decimalSep: '.', groupSep: ','});
	});

	it('keeps the grouping of a European price', () => {
		expect(splitPriceString('1.234,56 €')).toMatchObject({integer: 1234, decimals: '56', decimalSep: ',', groupSep: '.'});
	});

	it('handles a price with no separators', () => {
		expect(splitPriceString('US$49')).toMatchObject({prefix: 'US$', integer: 49, decimals: '', suffix: ''});
	});
});
