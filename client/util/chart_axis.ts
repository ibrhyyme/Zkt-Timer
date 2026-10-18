// Axis label helpers for the small visx charts (TimeChart, BarGraph). Pure, no DOM.

/**
 * Which y-axis ticks to draw for solve times, and with how many decimals.
 *
 * The time chart used to print every nice tick with 0 decimals once times passed 10 s,
 * so a 11..14 range with half-second ticks read "14, 13, 13, 12, 12, 11, 11". Above 10 s
 * we now keep only the whole-second ticks (when at least two exist); otherwise the
 * decimals follow the tick step, so two neighbouring labels never print the same text.
 */
export function pickTimeAxisTicks(candidates: number[]): {values: number[]; decimals: number} {
	const ticks = (candidates || []).filter((v) => Number.isFinite(v));
	if (!ticks.length) return {values: [], decimals: 2};

	const isWhole = (v: number) => Math.abs(v - Math.round(v)) < 1e-9;
	if (Math.max(...ticks) > 10) {
		const whole = ticks.filter(isWhole);
		if (whole.length >= 2) return {values: whole, decimals: 0};
	}

	const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : 1;
	let decimals = 2;
	if (step >= 1 && ticks.every(isWhole)) decimals = 0;
	else if (isWhole(step * 10)) decimals = 1;
	return {values: ticks, decimals};
}

/**
 * Show every n-th category label so neighbouring labels do not run into each other.
 * Widths are estimated from the character count (11 px tabular-ish font is about 6.5 px
 * a character), which is close enough to decide a stride without measuring text.
 */
export function labelStride(labels: string[], bandWidth: number, charWidth = 6.5, minGap = 6): number {
	if (!labels.length || !(bandWidth > 0)) return 1;
	const longest = Math.max(...labels.map((l) => String(l).length));
	const needed = longest * charWidth + minGap;
	return Math.max(1, Math.ceil(needed / bandWidth));
}
