import {fillRedirectParams, mergeRedirectQuery} from '../../shared/redirect_query';

// B-2 (trainer-sets.md 1.8): the 301 for a routeRedirect row used to drop the query string.
// server/router.tsx redirectPage and client/components/map_route.tsx LegacyRedirect both
// build the target with these helpers.

describe('mergeRedirectQuery', () => {
	it('keeps the incoming query when the target has none', () => {
		expect(mergeRedirectQuery('/trainer/algorithms', 'cat=pll')).toBe('/trainer/algorithms?cat=pll');
		expect(mergeRedirectQuery('/trainer/algorithms/train', '?cat=oll')).toBe('/trainer/algorithms/train?cat=oll');
	});

	it('returns the target unchanged without an incoming query', () => {
		expect(mergeRedirectQuery('/trainer/algorithms?mode=smart', '')).toBe('/trainer/algorithms?mode=smart');
		expect(mergeRedirectQuery('/competitions', undefined)).toBe('/competitions');
		expect(mergeRedirectQuery('/competitions', '?')).toBe('/competitions');
	});

	it('puts the target query first and appends the incoming pairs', () => {
		expect(mergeRedirectQuery('/trainer/algorithms?mode=smart', 'cat=oll')).toBe('/trainer/algorithms?mode=smart&cat=oll');
	});

	it('lets the target win on a shared key', () => {
		expect(mergeRedirectQuery('/trainer/algorithms?mode=smart', 'mode=standard&cat=oll')).toBe(
			'/trainer/algorithms?mode=smart&cat=oll'
		);
	});

	it('keeps repeated incoming keys and their order', () => {
		expect(mergeRedirectQuery('/x', 'a=1&b=2&a=3')).toBe('/x?a=1&b=2&a=3');
	});

	it('keeps encoded values intact', () => {
		const out = mergeRedirectQuery('/x', 'q=%C3%BC%20k&redirect=%2Ftimer%3Fa%3D1');
		const params = new URLSearchParams(out.split('?')[1]);
		expect(params.get('q')).toBe('ü k');
		expect(params.get('redirect')).toBe('/timer?a=1');
	});

	it('keeps a hash on the target at the end', () => {
		expect(mergeRedirectQuery('/x?a=1#top', 'b=2')).toBe('/x?a=1&b=2#top');
	});
});

describe('fillRedirectParams', () => {
	it('replaces each placeholder with the matched param', () => {
		expect(
			fillRedirectParams('/competitions/:competitionId/wca-live/:eventId', {competitionId: 'Foo2026', eventId: '333'})
		).toBe('/competitions/Foo2026/wca-live/333');
	});

	it('does not eat a longer placeholder that starts with a shorter key', () => {
		expect(fillRedirectParams('/a/:id/b/:idx', {id: '1', idx: '2'})).toBe('/a/1/b/2');
		expect(fillRedirectParams('/a/:idx/b/:id', {id: '1'})).toBe('/a/:idx/b/1');
	});

	it('leaves the target alone without params', () => {
		expect(fillRedirectParams('/trainer/algorithms', {})).toBe('/trainer/algorithms');
		expect(fillRedirectParams('/trainer/algorithms', undefined)).toBe('/trainer/algorithms');
	});

	it('does not treat `$` in a value as a replacement pattern', () => {
		expect(fillRedirectParams('/u/:name', {name: 'a$&b'})).toBe('/u/a$&b');
	});
});

describe('legacy trainer addresses (trainer-sets.md 2.5)', () => {
	// Mirrors the four routeRedirect rows in client/components/layout/Routes.ts.
	const rows: [string, string][] = [
		['/trainer/standard/train', '/trainer/algorithms/train'],
		['/trainer/standard', '/trainer/algorithms'],
		['/trainer/smart/train', '/trainer/algorithms/train?mode=smart'],
		['/trainer/smart', '/trainer/algorithms?mode=smart'],
	];
	const target = (path: string) => rows.find(([from]) => from === path)[1];

	it('keeps ?cat on every old address', () => {
		expect(mergeRedirectQuery(target('/trainer/standard'), 'cat=pll')).toBe('/trainer/algorithms?cat=pll');
		expect(mergeRedirectQuery(target('/trainer/standard/train'), 'cat=pll')).toBe('/trainer/algorithms/train?cat=pll');
		expect(mergeRedirectQuery(target('/trainer/smart'), 'cat=oll')).toBe('/trainer/algorithms?mode=smart&cat=oll');
		expect(mergeRedirectQuery(target('/trainer/smart/train'), 'cat=oll')).toBe(
			'/trainer/algorithms/train?mode=smart&cat=oll'
		);
	});
});
