// ZKT Live "Anlık durum" as the same table as "Resmi sonuçlar": one row per
// competitor, ranked, average and best columns. The federation already cut every
// phone card to what may be public (the first `level` attempts of its group, K3),
// so the rows only use what arrives; the average appears once every attempt of
// the format is visible, by the site's rule (cardAverage). Official rows keep
// the desk's own numbers.

import {cardAverage} from '../../../../../shared/zkt_judge';
import {computeAdvancementStates, type ZktAdvancementType, type ZktFormat} from './live-advancement';

export interface LiveStatusEntryInput {
	personName?: string | null;
	personLiveId?: string | null;
	personCountryIso2?: string | null;
	done?: number | null;
	expected?: number | null;
	noShow?: boolean | null;
	official?: boolean | null;
	attempts?: ({result?: number | null} | null)[] | null;
}

export interface OfficialResultInput {
	personName?: string | null;
	personLiveId?: string | null;
	personWcaId?: string | null;
	personCountryIso2?: string | null;
	best?: number | null;
	average?: number | null;
	attempts?: ({result?: number | null} | null)[] | null;
}

export type LiveStatusTag = 'official' | 'noShow' | 'progress';

export interface LiveStatusRow {
	personLiveId: string | null;
	personName: string;
	personWcaId: string | null;
	personCountryIso2: string | null;
	attempts: {result: number}[];
	best: number | null;
	average: number | null;
	/** Shared by ties; null for a row with nothing to rank (no attempt yet, Gelmedi). */
	ranking: number | null;
	tag: LiveStatusTag;
	done: number;
	expected: number;
	/** Green (advancing, not questionable) / orange (advancing, questionable), as on the official table. */
	advancing: boolean;
	advancingQuestionable: boolean;
}

interface Options {
	numAttempts: number;
	/** 'average' ranks by the average first, as the official table does. */
	sortBy: string;
	eventId: string;
	/** The round's cutoff: a row that missed it is done after `attempts`. */
	cutoff?: {attempts: number; result: number} | null;
	/** Who goes to the next round; null on a final or a round without one. */
	advancement?: {type: ZktAdvancementType; level: number} | null;
	/** The round's field size; competitors not on the table yet count as rivals. */
	fieldSize?: number;
}

function results(list: ({result?: number | null} | null)[] | null | undefined): {result: number}[] {
	return (list || []).filter((a): a is {result: number} => !!a && typeof a.result === 'number' && a.result !== 0);
}

/** WCA best: the fastest success, DNF when every attempt so far failed, null with none. */
export function liveBest(values: readonly number[]): number | null {
	if (values.length === 0) return null;
	const ok = values.filter((v) => v > 0);
	return ok.length ? Math.min(...ok) : -1;
}

function formatOf(numAttempts: number): string | null {
	if (numAttempts === 5) return 'AO5';
	if (numAttempts === 3) return 'MO3';
	if (numAttempts === 12) return 'AO12';
	return null;
}

/** The round's format for the advancement math; null for a shape ZKT has no format for. */
function zktFormatOf(numAttempts: number, byAverage: boolean): ZktFormat | null {
	if (byAverage) return formatOf(numAttempts) as ZktFormat | null;
	if (numAttempts === 1) return 'BO1';
	if (numAttempts === 2) return 'BO2';
	if (numAttempts === 3) return 'BO3';
	return null;
}

// Successes first, fastest first; then DNF/DNS; then nothing at all.
function bestKey(v: number | null): number {
	if (v === null) return Number.POSITIVE_INFINITY;
	return v > 0 ? v : Number.MAX_SAFE_INTEGER;
}

export function buildLiveStatusRows(
	entries: readonly LiveStatusEntryInput[],
	official: readonly OfficialResultInput[],
	{numAttempts, sortBy, eventId, cutoff, advancement, fieldSize}: Options
): LiveStatusRow[] {
	const byAverage = sortBy === 'average';
	// How many attempts a desk row stands for: the whole format, or the cutoff's
	// count once those attempts are in and none beat it.
	const expectedFor = (values: readonly number[]): number => {
		if (!cutoff || cutoff.attempts <= 0 || values.length < cutoff.attempts) return numAttempts;
		const made = values.slice(0, cutoff.attempts).some((v) => v > 0 && v < cutoff.result);
		return made ? numAttempts : cutoff.attempts;
	};
	const format = byAverage ? formatOf(numAttempts) : null;
	const officialById = new Map<string, OfficialResultInput>();
	for (const r of official) if (r.personLiveId) officialById.set(r.personLiveId, r);

	const rows: LiveStatusRow[] = [];
	const seen = new Set<string>();

	// The desk's row. Its tag stays internal: the table never says "Resmi" in this
	// view (owner's call: a ranked "Resmi" reads as a final place). It shows the
	// same progress count as every other row.
	const fromOfficial = (r: OfficialResultInput, noShow = false): LiveStatusRow => {
		const attempts = results(r.attempts);
		const values = attempts.map((a) => a.result);
		return {
			personLiveId: r.personLiveId ?? null,
			personName: r.personName || '',
			personWcaId: r.personWcaId ?? null,
			personCountryIso2: r.personCountryIso2 ?? null,
			attempts,
			best: typeof r.best === 'number' && r.best !== 0 ? r.best : liveBest(values),
			average: typeof r.average === 'number' && r.average !== 0 ? r.average : null,
			ranking: null,
			tag: noShow ? 'noShow' : 'official',
			done: attempts.length,
			expected: expectedFor(values),
			advancing: false,
			advancingQuestionable: false,
		};
	};

	for (const e of entries) {
		const id = e.personLiveId ?? null;
		if (id) seen.add(id);
		const done = e.done ?? 0;
		const expected = e.expected ?? numAttempts;
		const desk = id ? officialById.get(id) : undefined;
		if (e.official && desk) {
			rows.push(fromOfficial(desk, !!e.noShow));
			continue;
		}
		const attempts = e.noShow ? [] : results(e.attempts);
		const values = attempts.map((a) => a.result);
		rows.push({
			personLiveId: id,
			personName: e.personName || '',
			personWcaId: desk?.personWcaId ?? null,
			personCountryIso2: e.personCountryIso2 ?? desk?.personCountryIso2 ?? null,
			attempts,
			best: liveBest(values),
			average: format ? cardAverage(values, format, eventId) : null,
			ranking: null,
			tag: e.official ? 'official' : e.noShow ? 'noShow' : 'progress',
			done,
			expected,
			advancing: false,
			advancingQuestionable: false,
		});
	}

	// Desk results without a phone card are part of the standings too.
	for (const r of official) {
		if (r.personLiveId && seen.has(r.personLiveId)) continue;
		if (results(r.attempts).length === 0) continue;
		rows.push(fromOfficial(r));
	}

	const avgKey = (r: LiveStatusRow) => (byAverage && r.average !== null && r.average > 0 ? r.average : Number.POSITIVE_INFINITY);
	const order = (x: number, y: number) => (x < y ? -1 : x > y ? 1 : 0);
	const cmp = (a: LiveStatusRow, b: LiveStatusRow) => order(avgKey(a), avgKey(b)) || order(bestKey(a.best), bestKey(b.best));
	rows.sort((a, b) => cmp(a, b) || a.personName.localeCompare(b.personName, 'tr'));

	let rank = 0;
	rows.forEach((r, i) => {
		if (r.best === null) return;
		rank = i > 0 && rows[i - 1].best !== null && cmp(rows[i - 1], r) === 0 ? rank : i + 1;
		r.ranking = rank;
	});

	// Advancement over exactly what the table shows, never the hidden attempts.
	// A Gelmedi row is a finished DNS row (no threat, never advances); a card
	// with nothing visible yet is left to the field-size padding, as a
	// competitor who has not gone yet.
	const advFormat = zktFormatOf(numAttempts, byAverage);
	if (advancement && advFormat) {
		const inputs = rows
			.map((r, i) => ({
				id: String(i),
				attempts: r.tag === 'noShow' ? Array<number>(numAttempts).fill(-2) : r.attempts.map((a) => a.result),
			}))
			.filter((x) => x.attempts.length > 0);
		const states = computeAdvancementStates(
			inputs,
			advancement.type,
			advancement.level,
			advFormat,
			cutoff?.result ?? null,
			cutoff?.attempts ?? null,
			false,
			Math.max(fieldSize ?? 0, rows.length)
		);
		rows.forEach((r, i) => {
			const st = states.get(String(i));
			r.advancing = !!st?.advancing;
			r.advancingQuestionable = !!st?.questionable;
		});
	}
	return rows;
}
