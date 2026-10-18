import {createSlotPool, MAX_TWISTY_SLOTS} from '../common/twisty_slots';

describe('3D player budget (twisty_slots)', () => {
	it('allows at most 8 live players by default', () => {
		expect(MAX_TWISTY_SLOTS).toBe(8);
	});

	it('grants up to the limit, queues the rest in order, and hands a freed slot on', () => {
		const pool = createSlotPool(2);
		const granted: number[] = [];
		for (const id of [1, 2, 3, 4]) pool.request(id, () => granted.push(id));
		expect(granted).toEqual([1, 2]);
		expect(pool.snapshot()).toEqual({active: [1, 2], waiting: [3, 4]});

		pool.release(1);
		expect(granted).toEqual([1, 2, 3]);
		expect(pool.snapshot()).toEqual({active: [2, 3], waiting: [4]});
	});

	it('a waiting card that scrolls away leaves the queue', () => {
		const pool = createSlotPool(1);
		const granted: number[] = [];
		pool.request(1, () => granted.push(1));
		pool.request(2, () => granted.push(2));
		pool.request(3, () => granted.push(3));
		pool.release(2);
		pool.release(1);
		expect(granted).toEqual([1, 3]);
	});

	it('ignores a repeated request and an unknown release', () => {
		const pool = createSlotPool(1);
		let calls = 0;
		pool.request(1, () => calls++);
		pool.request(1, () => calls++);
		pool.release(99);
		expect(calls).toBe(1);
		expect(pool.snapshot()).toEqual({active: [1], waiting: []});
	});
});
