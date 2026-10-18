// Number, percent and date formatting in the app's language, not the browser's.
//
// The stats, solves and sessions pages used to format with hard-coded US rules
// (`Intl.NumberFormat('en-US')`, a comma regex, dayjs 'MM/DD/YY', `${x}%`) or with
// `toLocaleString()` and no locale, which follows the BROWSER language. A Turkish user
// on an English browser then saw "11,663" next to "12.135" on one screen. Every helper
// here takes the i18next language explicitly (pass `i18n.language`), so the output only
// depends on the language picked in the app. Pure Intl, no i18n import: unit-testable.

const INTL_LOCALES: Record<string, string> = {
	tr: 'tr-TR',
	en: 'en-US',
	es: 'es-ES',
	ru: 'ru-RU',
	zh: 'zh-CN',
};

/** i18next language ("tr", "tr-TR") to the BCP 47 locale Intl should use. */
export function intlLocale(language: string | null | undefined): string {
	const primary = String(language || '').toLowerCase().split(/[-_]/)[0];
	return INTL_LOCALES[primary] || INTL_LOCALES.en;
}

/** 12450 -> "12.450" (tr), "12,450" (en), "12 450" (ru). */
export function formatInteger(value: number, language: string | null | undefined): string {
	if (!Number.isFinite(value)) return '-';
	return new Intl.NumberFormat(intlLocale(language), {maximumFractionDigits: 0}).format(value);
}

/**
 * Fixed decimals with the locale's separators: 12.5 -> "12,50" (tr). Grouping is off by
 * default because solve times read as times, not amounts ("1234,56" not "1.234,56").
 */
export function formatDecimal(
	value: number,
	fractionDigits: number,
	language: string | null | undefined,
	useGrouping = false
): string {
	if (!Number.isFinite(value)) return '-';
	return new Intl.NumberFormat(intlLocale(language), {
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
		useGrouping,
	}).format(value);
}

/**
 * A percentage given on the 0-100 scale: 0.2 -> "%0,2" (tr), "0.2%" (en), "0,2 %" (es).
 * Trailing zeros are dropped, so 0 reads "%0", not "%0,0".
 */
export function formatPercent(
	percent: number,
	language: string | null | undefined,
	maxFractionDigits = 1
): string {
	if (!Number.isFinite(percent)) return '-';
	return new Intl.NumberFormat(intlLocale(language), {
		style: 'percent',
		minimumFractionDigits: 0,
		maximumFractionDigits: maxFractionDigits,
	}).format(percent / 100);
}

/** Calendar date with year: "15.09.2023" (tr), "09/15/2023" (en), "2023/9/15" (zh). */
export function formatShortDate(date: Date | string | number, language: string | null | undefined): string {
	const d = date instanceof Date ? date : new Date(date);
	if (Number.isNaN(d.getTime())) return '-';
	return new Intl.DateTimeFormat(intlLocale(language), {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(d);
}

/** Day and month only, for chart axes: "24/09" (tr, CLDR pattern), "09/24" (en). */
export function formatDayMonth(date: Date | string | number, language: string | null | undefined): string {
	const d = date instanceof Date ? date : new Date(date);
	if (Number.isNaN(d.getTime())) return '-';
	return new Intl.DateTimeFormat(intlLocale(language), {month: '2-digit', day: '2-digit'}).format(d);
}

export interface DurationParts {
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
}

/** Whole days, hours, minutes and seconds in a span of seconds (negative counts as 0). */
export function splitDuration(totalSeconds: number): DurationParts {
	const total = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
	return {
		days: Math.floor(total / 86400),
		hours: Math.floor((total % 86400) / 3600),
		minutes: Math.floor((total % 3600) / 60),
		seconds: total % 60,
	};
}

/**
 * The units worth showing for a span: the largest non-zero unit and the next two at most,
 * with seconds dropped once the span reaches an hour. "1 gün 15 sa 37 dk", "37 dk 12 sn".
 */
export function durationUnits(totalSeconds: number): {unit: keyof DurationParts; value: number}[] {
	const parts = splitDuration(totalSeconds);
	const order: (keyof DurationParts)[] = ['days', 'hours', 'minutes', 'seconds'];
	const first = order.findIndex((unit) => parts[unit] > 0);
	if (first === -1) return [{unit: 'seconds', value: 0}];

	const units = order.slice(first, first + 3).filter((unit) => !(unit === 'seconds' && first <= 1));
	return units.filter((unit, i) => i === 0 || parts[unit] > 0).map((unit) => ({unit, value: parts[unit]}));
}

const DURATION_KEYS: Record<keyof DurationParts, string> = {
	days: 'stats_page.duration_days',
	hours: 'stats_page.duration_hours',
	minutes: 'stats_page.duration_minutes',
	seconds: 'stats_page.duration_seconds',
};

/**
 * A long span of time in words: "1 gün 15 sa 37 dk" (tr), "1 day 15 h 37 min" (en).
 * Replaces getTimeString's "1d 15:37", which is a stopwatch format with an English unit.
 * `t` is i18next's translate function, passed in so this file stays free of i18n.
 * Each number keeps its unit (no-break space inside a part): in a narrow card the line breaks
 * between parts, never leaving "dk" alone under "40".
 */
export function formatDurationText(totalSeconds: number, t: (key: string, options?: any) => string): string {
	return durationUnits(totalSeconds)
		.map(({unit, value}) => t(DURATION_KEYS[unit], {count: value}).replace(/ /g, '\u00A0'))
		.join(' ');
}
