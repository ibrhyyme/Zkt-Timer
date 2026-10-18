// First-launch language in the native app (E-4). The bootstrap in i18n.ts runs at module
// scope, so every case loads a fresh copy against stubbed browser globals.

type Env = {
	native: boolean;
	pluginAvailable?: boolean;
	deviceLanguage?: string;
	navigatorLanguage?: string;
	stored?: string | null;
	cookie?: string;
	beforeDeviceAnswers?: (i18n: any) => Promise<void> | void;
};

const flush = () => new Promise((r) => setImmediate(r));

async function boot(env: Env) {
	const store: Record<string, string> = {};
	if (env.stored) store.zkt_language = env.stored;
	const localStorage = {
		getItem: (k: string) => (k in store ? store[k] : null),
		setItem: (k: string, v: string) => { store[k] = String(v); },
		removeItem: (k: string) => { delete store[k]; },
	};
	const cookieJar: Record<string, string> = {};
	if (env.cookie) cookieJar.zkt_language = env.cookie;
	const document = {
		documentElement: { lang: '' },
		get cookie() {
			return Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
		},
		set cookie(value: string) {
			const [pair] = value.split(';');
			const [k, v] = pair.split('=');
			cookieJar[k.trim()] = v;
		},
	};
	const navigatorLanguage = env.navigatorLanguage || 'en-US';
	Object.assign(globalThis, { window: { localStorage, document }, document });
	Object.defineProperty(globalThis, 'navigator', {
		value: { language: navigatorLanguage, languages: [navigatorLanguage] },
		configurable: true,
		writable: true,
	});
	(globalThis as any).localStorage = localStorage;

	const getLanguageCode = jest.fn(async () => {
		await flush();
		return { value: env.deviceLanguage || 'en' };
	});

	let i18n: any;
	jest.isolateModules(() => {
		jest.doMock('@capacitor/core', () => ({
			Capacitor: {
				isNativePlatform: () => env.native,
				isPluginAvailable: (name: string) => name === 'Device' && env.pluginAvailable !== false,
			},
		}));
		jest.doMock('@capacitor/device', () => ({ Device: { getLanguageCode } }));
		i18n = require('../i18n').default;
	});

	if (env.beforeDeviceAnswers) await env.beforeDeviceAnswers(i18n);
	for (let i = 0; i < 5; i++) await flush();

	return { i18n, getLanguageCode, store, cookieJar, document };
}

afterEach(() => {
	delete (globalThis as any).window;
	delete (globalThis as any).document;
	delete (globalThis as any).localStorage;
	jest.resetModules();
});

describe('native first launch language', () => {
	it('follows a Turkish phone even when the WebView reports English (iOS)', async () => {
		const { i18n, getLanguageCode, store, cookieJar, document } = await boot({ native: true, deviceLanguage: 'tr', navigatorLanguage: 'en-US' });
		expect(getLanguageCode).toHaveBeenCalled();
		expect(i18n.language).toBe('tr');
		expect(store.zkt_language).toBe('tr');
		expect(cookieJar.zkt_language).toBe('tr');
		expect(document.documentElement.lang).toBe('tr');
	});

	it('opens English on a German phone', async () => {
		const { i18n } = await boot({ native: true, deviceLanguage: 'de', navigatorLanguage: 'de-DE' });
		expect(i18n.language).toBe('en');
	});

	it('maps a regional Chinese tag to zh', async () => {
		const { i18n } = await boot({ native: true, deviceLanguage: 'zh-Hans', navigatorLanguage: 'zh-CN' });
		expect(i18n.language).toBe('zh');
	});

	it('never overrides a saved choice', async () => {
		const { i18n, getLanguageCode } = await boot({ native: true, deviceLanguage: 'tr', navigatorLanguage: 'tr-TR', stored: 'en' });
		expect(getLanguageCode).not.toHaveBeenCalled();
		expect(i18n.language).toBe('en');
	});

	it('keeps the navigator guess when the shell has no Device plugin', async () => {
		const { i18n, getLanguageCode } = await boot({ native: true, pluginAvailable: false, deviceLanguage: 'ru', navigatorLanguage: 'tr-TR' });
		expect(getLanguageCode).not.toHaveBeenCalled();
		expect(i18n.language).toBe('tr');
	});

	it('drops the device answer when the user picked a language meanwhile', async () => {
		const { i18n } = await boot({
			native: true,
			deviceLanguage: 'tr',
			navigatorLanguage: 'en-US',
			beforeDeviceAnswers: (i18n) => i18n.changeLanguage('es'),
		});
		expect(i18n.language).toBe('es');
	});

	it('does not ask the device on the web, where the SSR cookie decides', async () => {
		const { i18n, getLanguageCode } = await boot({ native: false, deviceLanguage: 'ru', navigatorLanguage: 'en-US', cookie: 'tr' });
		expect(getLanguageCode).not.toHaveBeenCalled();
		expect(i18n.language).toBe('tr');
	});
});
