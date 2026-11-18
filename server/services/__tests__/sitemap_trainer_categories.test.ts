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
		{path: '/trainer/algorithms/train'},
		{path: '/trainer/algorithms/sets', redirect: '/trainer/sets'},
		{path: '/trainer/algorithms/:category'},
		{path: '/trainer/algorithms'},
		{path: '/trainer/sets'},
		{path: '/trainer/sets/:code'},
		{path: '/judge/approve'},
		{path: '/native-migrate'},
		{path: '/links'},
		{path: '/help'},
	],
}));

import {getDefaultSiteMapUrls} from '../sitemap';

describe('site sitemap trainer categories', () => {
	const prevBase = process.env.BASE_URI;
	beforeAll(() => {
		process.env.BASE_URI = 'https://zktimer.app';
	});
	afterAll(() => {
		process.env.BASE_URI = prevBase;
	});

	const englishPaths = () =>
		getDefaultSiteMapUrls(false, ['oll', '2x2-cll'])
			.map((u) => u.location.replace('https://zktimer.app', ''))
			.filter((path) => !path.includes('?lang='));

	it('lists one page per served category next to the catalog, nothing for study or sets', () => {
		expect(englishPaths()).toEqual(['/trainer/algorithms/oll', '/trainer/algorithms/2x2-cll', '/trainer/algorithms', '/help']);
	});

	it('gives a category page its translations and hreflang set', () => {
		const tr = getDefaultSiteMapUrls(false, ['oll']).find((u) => u.location === 'https://zktimer.app/trainer/algorithms/oll?lang=tr');
		expect(tr?.alternates).toContainEqual({hrefLang: 'x-default', location: 'https://zktimer.app/trainer/algorithms/oll'});
		expect(tr?.alternates).toHaveLength(6);
	});

	it('leaves out the judge tool, the native data bridge and the link-in-bio page', () => {
		const paths = englishPaths();
		expect(paths).not.toContain('/judge/approve');
		expect(paths).not.toContain('/native-migrate');
		expect(paths).not.toContain('/links');
	});
});
