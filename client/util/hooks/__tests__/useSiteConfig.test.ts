const mockQuery = jest.fn();
jest.mock('../../../components/api', () => ({
	gqlQueryTyped: (...args: any[]) => mockQuery(...args),
}));
jest.mock('../../../@types/generated/graphql', () => ({SiteConfigDocument: 'SiteConfig'}));

const SNAPSHOT_KEY = 'zkt_site_config_cache';
const store = new Map<string, string>();
const originalNavigator = Object.getOwnPropertyDescriptor(global, 'navigator');

function setOnline(onLine: boolean) {
	Object.defineProperty(global, 'navigator', {value: {onLine}, configurable: true, writable: true});
}

type Loaded = typeof import('../useSiteConfig') & {
	render: (el: any) => string;
	React: typeof import('react');
	ReactRedux: typeof import('react-redux');
};

// The first render reads the useState initializer and runs no effects, which is exactly
// the first frame a page hydrates with.
function firstFrame(mod: Loaded, ssrSeed?: object) {
	let seen: any = 'unset';
	function Probe() {
		seen = mod.useSiteConfig();
		return null;
	}
	const probe = mod.React.createElement(Probe);
	if (ssrSeed === undefined) {
		mod.render(probe);
	} else {
		// The shape App hydrates with: the server's store, its ssr slice holding the seed.
		const reduxStore = {getState: () => ({ssr: {site_config: ssrSeed}}), subscribe: () => () => {}, dispatch: () => {}};
		mod.render(mod.React.createElement(mod.ReactRedux.ReactReduxContext.Provider, {value: {store: reduxStore} as any}, probe));
	}
	return seen;
}

// React is loaded inside the same isolated registry as the hook, or the hook would call
// into a second copy of React and fail as an invalid hook call.
function loadWithSnapshot(snapshot: object | null): Loaded {
	store.clear();
	if (snapshot) store.set(SNAPSHOT_KEY, JSON.stringify(snapshot));
	let loaded: Loaded;
	jest.isolateModules(() => {
		loaded = {
			...require('../useSiteConfig'),
			render: require('react-dom/server').renderToString,
			React: require('react'),
			ReactRedux: require('react-redux'),
		};
	});
	return loaded!;
}

beforeAll(() => {
	(global as any).window = {};
	(global as any).localStorage = {
		getItem: (k: string) => (store.has(k) ? store.get(k) : null),
		setItem: (k: string, v: string) => store.set(k, String(v)),
	};
});

afterAll(() => {
	delete (global as any).window;
	delete (global as any).localStorage;
	if (originalNavigator) Object.defineProperty(global, 'navigator', originalNavigator);
	else delete (global as any).navigator;
});

beforeEach(() => {
	mockQuery.mockReset();
});

describe('useSiteConfig boot snapshot', () => {
	const flagOn = {data: {online_battle_enabled: true}, ts: 0};

	it('does not treat a snapshot from a few seconds ago as fresh when online', () => {
		setOnline(true);
		const mod = loadWithSnapshot({...flagOn, ts: Date.now() - 5000});
		// Online: the server-rendered value has to win, so nothing is served from storage.
		expect(firstFrame(mod)).toBeNull();
	});

	it('serves the snapshot on an offline boot, however old', () => {
		setOnline(false);
		const mod = loadWithSnapshot({...flagOn, ts: Date.now() - 24 * 3600 * 1000});
		expect(firstFrame(mod)).toEqual(flagOn.data);
	});

	it('still exposes the snapshot as the last known config', () => {
		setOnline(true);
		const mod = loadWithSnapshot({...flagOn, ts: Date.now() - 5000});
		expect(mod.getLastKnownSiteConfig()).toEqual(flagOn.data);
	});

	it('serves a config fetched in this session within the TTL', async () => {
		setOnline(true);
		const mod = loadWithSnapshot({...flagOn, ts: Date.now() - 5000});
		mockQuery.mockResolvedValue({data: {siteConfig: {online_battle_enabled: false}}});
		await expect(mod.fetchSiteConfig()).resolves.toEqual({online_battle_enabled: false});
		expect(firstFrame(mod)).toEqual({online_battle_enabled: false});
		expect(JSON.parse(store.get(SNAPSHOT_KEY)!).data).toEqual({online_battle_enabled: false});
	});

	it('reports a failed boot fetch as null', async () => {
		setOnline(true);
		const mod = loadWithSnapshot(flagOn);
		mockQuery.mockRejectedValue(new Error('offline'));
		await expect(mod.fetchSiteConfig()).resolves.toBeNull();
	});
});

describe('useSiteConfig SSR seed', () => {
	const seed = {online_battle_enabled: false, maintenance_mode: false};

	it('starts from the server-rendered config, even over a newer-looking snapshot', () => {
		setOnline(true);
		const mod = loadWithSnapshot({data: {online_battle_enabled: true}, ts: Date.now() - 1000});
		expect(firstFrame(mod, seed)).toEqual(seed);
	});

	it('counts the seed as a fresh fetch, so mounting does not ask again', () => {
		setOnline(true);
		const mod = loadWithSnapshot(null);
		firstFrame(mod, seed);
		expect(firstFrame(mod)).toEqual(seed);
		expect(mod.getLastKnownSiteConfig()).toEqual(seed);
	});

	it('adopts the seed once, not again after a newer fetch', async () => {
		setOnline(true);
		const mod = loadWithSnapshot(null);
		firstFrame(mod, seed);
		mockQuery.mockResolvedValue({data: {siteConfig: {online_battle_enabled: true}}});
		await mod.fetchSiteConfig();
		expect(firstFrame(mod, seed)).toEqual({online_battle_enabled: true});
	});

	it('returns the seed when rendering on the server', () => {
		setOnline(true);
		const mod = loadWithSnapshot(null);
		const w = (global as any).window;
		delete (global as any).window;
		try {
			expect(firstFrame(mod, seed)).toEqual(seed);
		} finally {
			(global as any).window = w;
		}
	});
});

// A module, so these top-level names do not collide with other test files under tsc.
export {};
