/**
 * Deletion tombstones, and withdrawing one.
 *
 * A tombstone is what tells the sync layer that "local has it, the server does not" means
 * a real deletion rather than an out-of-sync device. An undone deletion has to withdraw
 * its own, or the next sync would delete the solve the user just got back.
 */

let store: Record<string, string>;

beforeEach(() => {
	store = {};
	(global as any).window = {};
	(global as any).localStorage = {
		getItem: (key: string) => (key in store ? store[key] : null),
		setItem: (key: string, value: string) => {
			store[key] = String(value);
		},
		removeItem: (key: string) => {
			delete store[key];
		},
	};
});

afterEach(() => {
	delete (global as any).window;
	delete (global as any).localStorage;
	jest.resetModules();
});

function tombstones() {
	// Re-required per test so the localStorage stub above is the one in scope.
	return require('../solve-tombstones');
}

describe('removeSolveTombstones', () => {
	it('withdraws only the ids it is given', () => {
		const {addSolveTombstones, getSolveTombstones, removeSolveTombstones} = tombstones();

		addSolveTombstones(['a', 'b', 'c']);
		removeSolveTombstones(['b']);

		const left = getSolveTombstones();
		expect(left.has('a')).toBe(true);
		expect(left.has('b')).toBe(false);
		expect(left.has('c')).toBe(true);
	});

	it('is a no-op for an id that was never tombstoned', () => {
		const {addSolveTombstones, getSolveTombstones, removeSolveTombstones} = tombstones();

		addSolveTombstones(['a']);
		removeSolveTombstones(['never', '']);
		removeSolveTombstones([]);

		expect(Array.from(getSolveTombstones())).toEqual(['a']);
	});

	it('leaves the solve fetchable again, which is the point of an undo', () => {
		const {addSolveTombstones, getSolveTombstones, removeSolveTombstones} = tombstones();

		addSolveTombstones(['a']);
		expect(getSolveTombstones().has('a')).toBe(true);

		removeSolveTombstones(['a']);
		expect(getSolveTombstones().size).toBe(0);
	});
});
