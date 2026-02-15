import dayjs from 'dayjs';
import { getTimeString } from './time';
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

	lines.push('ZKT-Timer tarafından ' + dateStr + ' tarihinde oluşturuldu');

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
