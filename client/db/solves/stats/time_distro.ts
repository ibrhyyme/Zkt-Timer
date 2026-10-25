import {getTimeString} from '../../../util/time';
import {fetchSolves, FilterSolvesOptions} from '../query';

/**
 * A bucket edge as the chart prints it. Whole seconds above 10 s used to be the rule, so
 * buckets narrower than a second got the same label ("15-15" twice). The label is also
 * the chart's band key, so two such buckets were drawn on the same spot, one hidden behind
 * the other. The decimals now follow the bucket width as well.
 */
export function bucketEdgeLabel(edge: number, bucketSize: number): string {
	const widthDecimals = bucketSize >= 1 ? 0 : bucketSize >= 0.15 ? 1 : 2;
	let dec = Math.max(edge < 10 ? 1 : 0, widthDecimals);
	if (Math.floor(edge) === edge) {
		dec = 0;
	}

	return `${getTimeString(edge, dec)}`;
}

export function getTimeDistro(filter: FilterSolvesOptions, buckets: number) {
	const solves = fetchSolves(
		{
			...filter,
			dnf: false,
			time: {
				$gt: 0,
			},
		},
		{
			sortBy: 'time',
		}
	);

	function roundNumber(num) {
		return Math.floor(num * 100) / 100;
	}

	if (!solves || !solves.length) {
		return [];
	}

	const min = Math.floor(solves[0].time);
	// At least a second wide: solves all on the same whole second gave a zero bucket size
	// and every bucket the same label.
	const max = Math.max(min + 1, Math.ceil(solves[solves.length - 1].time));

	const bucketSize = roundNumber((max - min) / buckets);

	let solveStart = 0;
	const data = [];

	const getRangeStr = (range: number) => bucketEdgeLabel(range, bucketSize);

	for (let i = 0; i < buckets; i += 1) {
		const bucketMin = min + i * bucketSize;
		const bucketMax = bucketMin + bucketSize;

		let freq = 0;
		// bucketSize rounding can leave the slowest solve past the last bucketMax;
		// the final bucket absorbs the remainder so no solve goes uncounted.
		const isLastBucket = i === buckets - 1;
		for (let k = solveStart; k < solves.length; k += 1) {
			if (isLastBucket || solves[k].time < bucketMax) {
				freq += 1;
			} else {
				solveStart = k;
				break;
			}
		}

		const lowRange = getRangeStr(bucketMin);
		const highRange = getRangeStr(bucketMax);

		data.push({
			x: `${lowRange}-${highRange}`,
			y: freq,
		});
	}

	return data;
}
