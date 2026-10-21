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

export interface PriceParts {
	/** Whatever precedes the number, e.g. "$" or "US$". */
	prefix: string;
	/** Integer part as a number, so it can be counted up. */
	integer: number;
	/** Decimal digits without the separator, "" when there are none. */
	decimals: string;
	decimalSep: string;
	/** Thousands separator to use when re-printing `integer`. */
	groupSep: string;
	/** Whatever follows the number, e.g. " ₺" or " €". */
	suffix: string;
}

/**
 * Splits a formatted price ("899,99 ₺", "1.800 ₺", "$19.99", "1.234,56 €") into the
 * integer the page animates and the pieces printed around it. Store strings follow the
 * device locale, so the separators are read from the string rather than assumed.
 */
export function splitPriceString(raw: string): PriceParts {
	const numMatch = raw.match(/[\d.,]+/);
	const numToken = numMatch?.[0] || '0';
	const numIdx = numMatch?.index ?? 0;
	const prefix = raw.slice(0, numIdx);
	const suffix = raw.slice(numIdx + numToken.length);

	// A trailing separator followed by 1-2 digits is the decimal part. Three digits
	// ("1.800") is a thousands group, not decimals.
	const decMatch = numToken.match(/[.,](\d{1,2})$/);
	const decimals = decMatch?.[1] || '';
	const decimalSep = decMatch?.[0]?.[0] || '';
	const rawInt = decMatch ? numToken.slice(0, -decMatch[0].length) : numToken;
	const integer = parseInt(rawInt.replace(/[.,]/g, '') || '0', 10);

	// Keep the string's own grouping when it has one, otherwise use the opposite of the
	// decimal separator (TR "," -> "."; US "." -> ",").
	const groupSep = rawInt.match(/[.,]/)?.[0] || (decimalSep === ',' ? '.' : ',');

	return {prefix, integer, decimals, decimalSep, groupSep, suffix};
}

function formatPerMonth(value: number, currencyCode: string): string {
	try {
		return new Intl.NumberFormat(undefined, {style: 'currency', currency: currencyCode}).format(value);
	} catch {
		// Unknown/invalid currency code — fall back to a plain numeric string rather than throwing.
		return `${value.toFixed(2)} ${currencyCode}`;
	}
}
