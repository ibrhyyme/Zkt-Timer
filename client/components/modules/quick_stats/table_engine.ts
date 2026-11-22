/**
 * The numbers behind the stats table: for one window size N, the current aoN and the best
 * and worst aoN over a list of solves, with the window each one came from.
 *
 * Rules are the app's (rolling_average.ts, average.ts) and cstimer's default "p5" trim:
 * ceil(5% of N) dropped from each end, none below 5 solves, a DNF sorts as the slowest
 * time and more DNFs than the slow trim make the average a DNF. N = 1 is the single.
 *
 * Speed matters more here than anywhere else in the stats: the table shows up to a dozen
 * window sizes (ao10000 included) over sessions of 100k imported solves, and it refreshes
 * after every solve. Three paths keep it cheap:
 *  - A full pass slides the window over the list with two Fenwick trees (count and sum,
 *    indexed by each solve's rank in the whole list), so every step is O(log n) whatever N
 *    is. The sorted-array window the solves grid uses costs O(N) per step and took 1.8 s
 *    for the dozen sizes over 100k solves; this pass takes a few ms per size.
 *  - Bests and worsts are kept as stacks of successive records (cstimer's _bestAvg), so
 *    a change at the end of the list (a new solve, +2 or DNF on the last one, deleting the
 *    last one) only pops the records whose window it touched and recomputes the windows
 *    from there on.
 *  - Those few windows are averaged on their own by sorting N times, which beats a full
 *    pass until the changed tail grows long; past that the full pass runs instead.
 *
 * Times come in as integer milliseconds with DNF as Infinity (toWindowTime), so the sums
 * are exact and the averages equal the solves grid's to the last digit.
 */

/** Solves trimmed from each end of an average of `n`; a mean trims nothing. */
export function tableTrimCount(n: number, mean = false): number {
	if (mean || n < 5) return 0;
	return Math.ceil(n * 0.05);
}

export interface WindowPick {
	/** Seconds; a pick is never a DNF (a DNF average is never a best or a worst). */
	value: number;
	/** Index of the window's oldest solve in the oldest-first list. */
	start: number;
}

/** A DNF average, the app's convention. */
export const DNF_VALUE = -1;

// Scratch buffers for the Fenwick pass (count and sum trees), reused across sizes and
// updates so a pass over 100k solves allocates nothing.
let fenwickCount = new Int32Array(0);
let fenwickSum = new Float64Array(0);

function ensureFenwick(nodes: number) {
	if (fenwickCount.length < nodes) {
		fenwickCount = new Int32Array(nodes);
		fenwickSum = new Float64Array(nodes);
	} else {
		fenwickCount.fill(0, 0, nodes);
		fenwickSum.fill(0, 0, nodes);
	}
}

/**
 * Each solve's rank (1-based) in the list sorted by time, ties by position, so every rank
 * is unique and the Fenwick leaves hold 0 or 1 solve. Shared by every size's pass.
 */
export function rankTimes(times: number[]): Int32Array {
	const len = times.length;
	// Time and position packed into one number (time * len + position), so a native typed
	// sort does the work; a comparator sort took 22 ms on 100k solves. Exact while the
	// product stays below 2^53: a DNF takes the slowest finite time + 1, and times are
	// whole milliseconds (an 11-day solve times a million solves still fits).
	let slowest = 0;
	for (let i = 0; i < len; i++) {
		const t = times[i];
		if (t !== Infinity && t > slowest) slowest = t;
	}
	const keys = new Float64Array(len);
	for (let i = 0; i < len; i++) {
		const t = times[i];
		keys[i] = (t === Infinity ? slowest + 1 : t) * len + i;
	}
	keys.sort();
	const ranks = new Int32Array(len);
	for (let r = 0; r < len; r++) ranks[keys[r] % len] = r + 1;
	return ranks;
}

/** Average of one window given on its own; sorts a copy. */
function windowValue(times: number[], start: number, n: number, trim: number): number {
	if (trim === 0) {
		let sum = 0;
		for (let i = start; i < start + n; i++) {
			const t = times[i];
			if (t === Infinity) return DNF_VALUE;
			sum += t;
		}
		return sum / n / 1000;
	}

	const sorted = Float64Array.from(times.slice(start, start + n)).sort();
	// Infinity sorts last, so a DNF in the counted range means too many DNFs.
	if (sorted[n - trim - 1] === Infinity) return DNF_VALUE;
	let sum = 0;
	for (let i = trim; i < n - trim; i++) sum += sorted[i];
	return sum / (n - 2 * trim) / 1000;
}

/** One window size over a list that changes mostly at its end. */
export class AverageSeries {
	readonly n: number;
	readonly trim: number;
	/** Latest window's average: seconds, DNF_VALUE, or null with fewer than n solves. */
	current: number | null = null;
	private times: number[] = [];
	private bests: WindowPick[] = [];
	private worsts: WindowPick[] = [];

	constructor(n: number, mean = false) {
		this.n = Math.max(1, Math.floor(n));
		this.trim = tableTrimCount(this.n, mean);
	}

	/** Lowest average so far; the oldest window wins a tie, as in the solves grid. */
	get best(): WindowPick | null {
		return this.bests.length ? this.bests[this.bests.length - 1] : null;
	}

	get worst(): WindowPick | null {
		return this.worsts.length ? this.worsts[this.worsts.length - 1] : null;
	}

	/** Whether a full window exists; with one and no best, every window was a DNF. */
	get hasWindow(): boolean {
		return this.times.length >= this.n;
	}

	/**
	 * Takes the whole list, oldest first. `ranks` is rankTimes(times), computed by the caller
	 * once for every size and only when some size needs a full pass.
	 */
	update(times: number[], ranks: () => Int32Array) {
		const previous = this.times;
		const shared = Math.min(previous.length, times.length);
		let p = 0;
		while (p < shared && previous[p] === times[p]) p++;
		if (p === previous.length && p === times.length) return;

		const {n} = this;
		const tail = times.length - p;
		// A full pass costs about 100 operations per solve; averaging one window on its own
		// costs a copy and a sort of n times plus a fixed price for the copy, which made a
		// full ao12 over 100k solves the slowest size (56 ms) before it was counted.
		const tailCost = tail * (n * Math.max(1, Math.log2(n)) + 300);
		const fullCost = times.length * 100;

		this.times = times;
		if (tailCost > fullCost) {
			this.fullPass(ranks());
			return;
		}

		// Records whose window reaches the first changed solve are gone; the rest hold.
		while (this.bests.length && this.bests[this.bests.length - 1].start + n > p) this.bests.pop();
		while (this.worsts.length && this.worsts[this.worsts.length - 1].start + n > p) this.worsts.pop();

		for (let end = Math.max(p, n - 1); end < times.length; end++) {
			this.record(windowValue(times, end - n + 1, n, this.trim), end - n + 1);
		}
		this.current = times.length >= n ? windowValue(times, times.length - n, n, this.trim) : null;
	}

	private record(value: number, start: number) {
		if (value === DNF_VALUE) return;
		const best = this.best;
		if (!best || value < best.value) this.bests.push({value, start});
		const worst = this.worst;
		if (!worst || value > worst.value) this.worsts.push({value, start});
	}

	private fullPass(ranks: Int32Array) {
		const {times, n, trim} = this;
		const len = times.length;
		this.bests = [];
		this.worsts = [];
		this.current = null;
		if (len < n) return;

		// No trim: a running sum and a DNF count are enough.
		if (trim === 0) {
			let sum = 0;
			let dnf = 0;
			let value = DNF_VALUE;
			for (let i = 0; i < len; i++) {
				const t = times[i];
				if (t === Infinity) dnf++;
				else sum += t;
				if (i >= n) {
					const out = times[i - n];
					if (out === Infinity) dnf--;
					else sum -= out;
				}
				if (i >= n - 1) {
					value = dnf ? DNF_VALUE : sum / n / 1000;
					this.record(value, i - n + 1);
				}
			}
			this.current = value;
			return;
		}

		const size = len + 1;
		ensureFenwick(size);
		const count = fenwickCount;
		const sums = fenwickSum;
		let top = 1;
		while (top * 2 <= len) top *= 2;

		// The tree walks are written out in the loop rather than as helpers: this loop runs
		// once per solve per size, and the calls cost a third of the pass.
		const counted = n - 2 * trim;
		const keep = n - trim;
		let dnf = 0;
		let value = DNF_VALUE;
		for (let i = 0; i < len; i++) {
			const tIn = times[i];
			const vIn = tIn === Infinity ? 0 : tIn;
			if (tIn === Infinity) dnf++;
			for (let j = ranks[i]; j < size; j += j & -j) {
				count[j]++;
				sums[j] += vIn;
			}
			if (i >= n) {
				const tOut = times[i - n];
				const vOut = tOut === Infinity ? 0 : tOut;
				if (tOut === Infinity) dnf--;
				for (let j = ranks[i - n]; j < size; j += j & -j) {
					count[j]--;
					sums[j] -= vOut;
				}
			}
			if (i < n - 1) continue;

			if (dnf > trim) {
				value = DNF_VALUE;
			} else {
				// Sums of the `trim` and the `keep` fastest times, walking down by counts.
				let pos = 0;
				let k = trim;
				let low = 0;
				for (let step = top; step > 0; step >>= 1) {
					const next = pos + step;
					if (next < size && count[next] <= k) {
						pos = next;
						k -= count[next];
						low += sums[next];
					}
				}
				pos = 0;
				k = keep;
				let high = 0;
				for (let step = top; step > 0; step >>= 1) {
					const next = pos + step;
					if (next < size && count[next] <= k) {
						pos = next;
						k -= count[next];
						high += sums[next];
					}
				}
				value = (high - low) / counted / 1000;
			}
			this.record(value, i - n + 1);
		}
		this.current = value;
	}
}
