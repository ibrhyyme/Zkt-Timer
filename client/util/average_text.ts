import dayjs from 'dayjs';
import { getTimeString } from './time';
import { getCubeTypeName } from './cubes/util';
import { Solve } from '../../server/schemas/Solve.schema';

export function generateAverageText(
	description: string,
	time: number,
	solves: Solve[],
	reverseOrder?: boolean
): string {
	const lines = [];
	const isSingle = solves.length === 1;
	const dateStr = isSingle ? dayjs(solves[0].started_at).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');

	lines.push('Zkt Timer tarafından ' + dateStr + ' tarihinde oluşturuldu');

	let desc = description;
	if (time && getTimeString(time)) {
		desc += `: ${getTimeString(time)}`;
	}
	lines.push(desc);
	lines.push('');
	lines.push('Çözümler:');

	const trimmedIds = getTrimmedSolveIds(solves);

	for (let i = 0; i < solves.length; i += 1) {
		let index = i;
		let displayIndex = solves.length - i;
		if (reverseOrder) {
			index = solves.length - i - 1;
			displayIndex = i + 1;
		}

		const solve = solves[index];
		let solveTime = getTimeString(solve);

		if (trimmedIds.has(solve.id)) {
			solveTime = `(${solveTime})`;
		}

		if (!solve.dnf && solve.plus_two) {
			solveTime += '+';
		}

		const scramble = solve.scramble || '';
		lines.push(`${displayIndex}. ${solveTime}    ${scramble}`);
	}

	return lines.join('\n');
}

export interface SolvesStatsTextOptions {
	includeScramble?: boolean;
	includeCubeType?: boolean;
	includeDate?: boolean;
	includeNotes?: boolean;
}

/**
 * The plain-text solve list "Stats olarak goruntule" shows (SolvesText.tsx) and
 * that a solve card's native share reuses (NormalSolveLayout.tsx), so both
 * produce identical text instead of the formatting living in two places.
 * i18n-aware (unlike generateAverageText above, which predates it and is kept
 * for its own callers): takes `t` rather than importing useTranslation itself,
 * since this is plain util code, not a component.
 */
export function generateSolvesStatsText(
	t: (key: string, opts?: any) => string,
	description: string,
	time: number,
	solves: Solve[],
	reverseOrder?: boolean,
	options: SolvesStatsTextOptions = {}
): string {
	const { includeScramble = true, includeCubeType = false, includeDate = false, includeNotes = false } = options;

	const lines: string[] = [];
	const isSingle = solves.length === 1;
	const dateStr = isSingle ? dayjs(solves[0].started_at).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');

	lines.push(t('solve_info.generated_by', { date: dateStr }));

	let desc = description;
	if (time && getTimeString(time)) {
		desc += `: ${getTimeString(time)}`;
	}
	lines.push(desc);
	lines.push('');
	lines.push(t('solve_info.solves_colon'));

	for (let i = 0; i < solves.length; i += 1) {
		let index = i;
		let displayIndex = solves.length - i;
		if (reverseOrder) {
			index = solves.length - i - 1;
			displayIndex = i + 1;
		}

		const solve = solves[index];
		let solveTime = getTimeString(solve);
		if (!solve.dnf && solve.plus_two) {
			solveTime += '+';
		}

		const parts: string[] = [`${displayIndex}.`, solveTime];
		const add: string[] = [];
		if (includeScramble) add.push(solve.scramble);
		if (includeCubeType) add.push(getCubeTypeName(solve.cube_type));
		if (includeDate) add.push(new Date(solve.ended_at).toLocaleString());
		if (includeNotes) add.push(solve.notes);

		for (const a of add) {
			parts.push('  ', a);
		}

		lines.push(parts.join(' '));
	}

	return lines.join('\n');
}

function getTrimmedSolveIds(solves: Solve[]): Set<string> {
	const ids = new Set<string>();
	if (solves.length < 5) return ids;

	const sorted = [...solves].sort((a, b) => {
		const aTime = a.dnf ? Infinity : a.time;
		const bTime = b.dnf ? Infinity : b.time;
		return aTime - bTime;
	});

	// Standard trimming: Remove top/bottom 5% (min 1)
	const dropCount = Math.ceil(Math.max(1, solves.length * 0.05));

	for (let i = 0; i < dropCount; i++) {
		ids.add(sorted[i].id);
		ids.add(sorted[sorted.length - 1 - i].id);
	}

	return ids;
}
