// The device cache behind every competition screen. Jest runs in node, so a
// small localStorage stands in for the browser's; IndexedDB is absent here and
// the module has to degrade to memory without throwing.

class MemoryStorage {
	private map = new Map<string, string>();
	get length() {
		return this.map.size;
	}
	key(i: number) {
		return Array.from(this.map.keys())[i] ?? null;
	}
	getItem(k: string) {
		return this.map.has(k) ? this.map.get(k)! : null;
	}
	setItem(k: string, v: string) {
		this.map.set(k, String(v));
	}
	removeItem(k: string) {
		this.map.delete(k);
	}
}

function freshModule(storage: MemoryStorage) {
	(global as any).window = {};
	(global as any).localStorage = storage;
	let mod: typeof import('../competition-cache');
	jest.isolateModules(() => {
		mod = require('../competition-cache');
	});
	return mod!;
}

afterEach(() => {
	delete (global as any).window;
	delete (global as any).localStorage;
});

describe('competition cache', () => {
	it('keeps a list on the device and hands it to the next session at once', () => {
		const storage = new MemoryStorage();
		const first = freshModule(storage);
		first.storeCached('list:zkt', [{id: 'a'}], 'local');

		// A new app session: memory is empty, the copy comes from the device.
		const second = freshModule(storage);
		expect(second.peekCached<any[]>('list:zkt')?.data).toEqual([{id: 'a'}]);
	});

	it('drops nothing but its own keys on logout', async () => {
		const storage = new MemoryStorage();
		storage.setItem('zkt_has_auth', 'true');
		const mod = freshModule(storage);
		mod.storeCached('list:wca', [1], 'local');
		await mod.clearCompetitionCaches();
		expect(mod.peekCached('list:wca')).toBeNull();
		expect(freshModule(storage).peekCached('list:wca')).toBeNull();
		expect(storage.getItem('zkt_has_auth')).toBe('true');
	});

	it('files the viewer’s own lists under their account', () => {
		const storage = new MemoryStorage();
		storage.setItem('zkt_cached_me', JSON.stringify({me: {id: 'u-1', username: 'x'}, saved_at: Date.now()}));
		const mod = freshModule(storage);
		// No store in this test: the key falls back to the account saved on the
		// device, the same one a native cold start reads before /me answers.
		expect(mod.userScoped('list:my-zkt')).toBe('u:u-1:list:my-zkt');
	});

	it('works on memory alone without IndexedDB', async () => {
		const mod = freshModule(new MemoryStorage());
		mod.storeCached('detail:zkt-x', {competitionId: 'zkt-x'}, 'idb');
		expect(mod.peekCached<any>('detail:zkt-x')?.data.competitionId).toBe('zkt-x');
		expect((await mod.loadCached<any>('detail:zkt-x'))?.data.competitionId).toBe('zkt-x');
		expect(await mod.loadCached('detail:missing')).toBeNull();
	});

	it('tells how old a copy is', () => {
		const mod = freshModule(new MemoryStorage());
		expect(mod.isOlderThan(null, 1000)).toBe(true);
		expect(mod.isOlderThan({data: 1, ts: Date.now()}, 1000)).toBe(false);
		expect(mod.isOlderThan({data: 1, ts: Date.now() - 5000}, 1000)).toBe(true);
	});
});
