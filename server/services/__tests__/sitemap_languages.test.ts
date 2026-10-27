jest.mock('../redis', () => ({
	acquireRedisLock: jest.fn(),
	createRedisKey: () => 'k',
	RedisNamespace: {SITEMAP: 'sitemap'},
}));
jest.mock('../storage', () => ({uploadObject: jest.fn()}));
jest.mock('../logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn()}}));
jest.mock('../../database', () => ({getPrisma: () => ({})}));
jest.mock('../../models/site_config', () => ({getSiteConfig: jest.fn()}));
jest.mock('../../../client/components/layout/Routes', () => ({
	routes: [
		{path: '/'},
		{path: '/welcome'},
		{path: '/timer'},
		{path: '/settings'},
		{path: '/user/:username'},
		{path: '/stats', restricted: true},
		{path: '/trainer/recognition'},
	],
}));

import {getDefaultSiteMapUrls} from '../sitemap';

describe('site sitemap languages', () => {
	const prevBase = process.env.BASE_URI;
	beforeAll(() => {
		process.env.BASE_URI = 'https://zktimer.app';
	});
	afterAll(() => {
		process.env.BASE_URI = prevBase;
	});

	it('lists every page once per language, the home page once in all', () => {
		const locations = getDefaultSiteMapUrls().map((u) => u.location);
		expect(locations).toEqual([
			'https://zktimer.app/welcome?lang=tr',
			'https://zktimer.app/',
			'https://zktimer.app/welcome?lang=es',
			'https://zktimer.app/welcome?lang=ru',
			'https://zktimer.app/welcome?lang=zh',
			'https://zktimer.app/timer?lang=tr',
			'https://zktimer.app/timer',
			'https://zktimer.app/timer?lang=es',
			'https://zktimer.app/timer?lang=ru',
			'https://zktimer.app/timer?lang=zh',
		]);
	});

	it('gives each entry the full hreflang set with x-default on English', () => {
		const timer = getDefaultSiteMapUrls().find((u) => u.location === 'https://zktimer.app/timer?lang=tr');
		expect(timer?.alternates).toEqual([
			{hrefLang: 'tr', location: 'https://zktimer.app/timer?lang=tr'},
			{hrefLang: 'en', location: 'https://zktimer.app/timer'},
			{hrefLang: 'es', location: 'https://zktimer.app/timer?lang=es'},
			{hrefLang: 'ru', location: 'https://zktimer.app/timer?lang=ru'},
			{hrefLang: 'zh-Hans', location: 'https://zktimer.app/timer?lang=zh'},
			{hrefLang: 'x-default', location: 'https://zktimer.app/timer'},
		]);
	});
});
