import SortedArray from 'sorted-array';
import {getAverage} from './average';
import {Solve} from '../../../../../../server/schemas/Solve.schema';

// average_pb.ts'in window-min algoritmasinin saf, cache'siz, fetch'siz variant'i.
// Liste zaten kisitlanmis (orn. son N cozum) oldugunda `getAveragePB`'nin filterOptions
// bazli cache key'i bozulmadan in-place hesap icin kullanilir.
//
// Liste'nin sort sirasi onemli degil — window kayar, her pencereden trimmed average alinir.
export function getBestAverageFromSolves(solves: Solve[], count: number): { time: number; solves: Solve[] } | null {
	if (!solves || solves.length < count || count < 3) {
		return null;
	}

	const firstSolves = solves.slice(0, count);
	const sortedTimes = new SortedArray(firstSolves.map((s) => s.time));

	let bestList: Solve[] = [...firstSolves];
	let best = getAverage(firstSolves);

	for (let i = 1; i <= solves.length - count; i++) {
		const dropSolve = solves[i - 1];
		const addSolve = solves[i + count - 1];

		sortedTimes.remove(dropSolve.time);
		sortedTimes.insert(addSolve.time);

		const avg = getAverage(sortedTimes.array);

		if (avg > 0 && (best <= 0 || avg < best)) {
			best = avg;
			bestList = solves.slice(i, i + count);
		}
	}

	if (best <= 0) return null;

	return {time: best, solves: bestList};
}
