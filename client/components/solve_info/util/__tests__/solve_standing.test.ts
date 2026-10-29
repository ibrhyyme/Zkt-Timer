import {getSolveStanding, RECENT_COUNT, RECENT_MIN} from '../solve_standing';

// The line under a solve's time on its card: a record across every session of its bucket,
// or the gap to the mean of the solves just before it in its own session.

let next = 0;
function solve(time: number, endedAt: number, extra: any = {}) {
	return {id: `s${next++}`, time, ended_at: endedAt, dnf: false, ...extra};
}

describe('getSolveStanding', () => {
	it('calls the fastest solve of the bucket a record, across sessions', () => {
		const pb = solve(9.5, 100);
		const bucket = [solve(10.2, 10), solve(11, 20), pb, solve(12, 200)];
		expect(getSolveStanding(pb, bucket, [])).toEqual({kind: 'pb'});
	});

	it('lets a solve that ties the record hold it too', () => {
		const a = solve(9.5, 10);
		const b = solve(9.5, 20);
		expect(getSolveStanding(b, [a, b, solve(10, 30)], [])).toEqual({kind: 'pb'});
	});

	it('does not call the first solve ever a record', () => {
		const only = solve(20, 10);
		expect(getSolveStanding(only, [only], [only])).toBeNull();
	});

	it('ignores DNFs both as the solve and as a faster rival', () => {
		const dnfRival = solve(5, 10, {dnf: true});
		const s = solve(9, 20);
		expect(getSolveStanding(s, [dnfRival, s, solve(10, 30)], [])).toEqual({kind: 'pb'});
		const dnf = solve(4, 40, {dnf: true});
		expect(getSolveStanding(dnf, [dnf, s], [dnf, s])).toBeNull();
	});

	it('compares a non-record with the mean of the solves just before it, newest first', () => {
		const record = solve(8, 1);
		// Older than the last twelve: must not count.
		const old = solve(100, 2);
		const recent = Array.from({length: RECENT_COUNT}, (_, i) => solve(14, 10 + i));
		const later = solve(1000, 999);
		const s = solve(12.5, 500);
		const session = [old, ...recent, s, later];
		const standing = getSolveStanding(s, [record, ...session], session);
		expect(standing).toEqual({kind: 'recent', diff: expect.any(Number), count: RECENT_COUNT});
		expect((standing as any).diff).toBeCloseTo(-1.5);
	});

	it('says nothing with fewer than RECENT_MIN solves before it', () => {
		const record = solve(8, 1);
		const before = Array.from({length: RECENT_MIN - 1}, (_, i) => solve(14, 10 + i));
		const s = solve(12, 100);
		expect(getSolveStanding(s, [record, ...before, s], [...before, s])).toBeNull();
	});

	it('says nothing when the gap rounds to zero', () => {
		const record = solve(8, 1);
		const before = Array.from({length: RECENT_MIN}, (_, i) => solve(12, 10 + i));
		const s = solve(12.004, 100);
		expect(getSolveStanding(s, [record, ...before, s], [...before, s])).toBeNull();
	});
});
