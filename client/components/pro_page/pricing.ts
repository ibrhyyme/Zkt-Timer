// Pure pricing math for the Pro page yearly plan, kept separate from ProPage.tsx so it
// can be unit tested without mounting React. Computes the "per month" price and the
// savings percentage of the yearly plan from RevenueCat's live product data, so these
// numbers can never drift from what the store actually charges (unlike static i18n copy).

export interface PricingProduct {
	// Numeric price in the product's local currency, e.g. 899.99.
	price: number;
	// ISO 4217 currency code, e.g. "TRY" or "USD".
	currencyCode: string;
	// RevenueCat-formatted per-month price for this product, when the store already
	// provides it (e.g. for an annual product). Preferred over formatting manually
	// because it matches the store's own locale/currency formatting exactly.
	pricePerMonthString?: string | null;
}

export interface YearlyPricingResult {
	perMonthString: string;
	// Whole percent, rounded. Savings vs paying the monthly price 12 times.
	savingsPercent: number;
}

/**
 * Computes the yearly plan's "per month" price and its savings percentage vs.
 * 12x the monthly price. Returns null when either product is missing or has an
 * invalid (non-positive) price, so callers can fall back to static i18n strings.
 */
export function computeYearlyPricing(
	monthly: PricingProduct | null | undefined,
	yearly: PricingProduct | null | undefined
): YearlyPricingResult | null {
	if (!monthly || !yearly) return null;
	if (!(monthly.price > 0) || !(yearly.price > 0)) return null;

	const monthlyTotal = monthly.price * 12;
	const savingsPercent = Math.round(((monthlyTotal - yearly.price) / monthlyTotal) * 100);

	const perMonthString = yearly.pricePerMonthString || formatPerMonth(yearly.price / 12, yearly.currencyCode);

	return {perMonthString, savingsPercent};
}

function formatPerMonth(value: number, currencyCode: string): string {
	try {
		return new Intl.NumberFormat(undefined, {style: 'currency', currency: currencyCode}).format(value);
	} catch {
		// Unknown/invalid currency code — fall back to a plain numeric string rather than throwing.
		return `${value.toFixed(2)} ${currencyCode}`;
	}
}
