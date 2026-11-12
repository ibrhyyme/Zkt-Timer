import {GifItem, klipyLocale, matchLookups, parseGifItem, parseGifPage} from '../klipy';

// Trimmed from the Items API example in KLIPY's docs.
const RAW = {
	id: 8041071659142944,
	slug: 'hello-hi-662',
	title: 'Hello',
	file: {
		md: {
			gif: {url: 'https://static.klipy.com/ii/a/md.gif', width: 498, height: 498},
			webp: {url: 'https://static.klipy.com/ii/a/md.webp'},
		},
		sm: {
			gif: {url: 'https://static.klipy.com/ii/a/sm.gif', width: 220, height: 220},
			webp: {url: 'https://static.klipy.com/ii/a/sm.webp', width: 220, height: 220},
		},
		xs: {
			gif: {url: 'https://static.klipy.com/ii/a/xs.gif', width: 90, height: 90},
		},
	},
	type: 'gif',
	blur_preview: 'data:image/jpeg;base64,AAAA',
};

describe('parseGifItem', () => {
	it('prefers webp and takes dimensions from the gif of the same size', () => {
		expect(parseGifItem(RAW)).toEqual({
			slug: 'hello-hi-662',
			title: 'Hello',
			previewUrl: 'https://static.klipy.com/ii/a/sm.webp',
			url: 'https://static.klipy.com/ii/a/md.webp',
			width: 498,
			height: 498,
			blur: 'data:image/jpeg;base64,AAAA',
		});
	});

	it('falls back to smaller renditions and drops what cannot be drawn', () => {
		const onlyXs = {slug: 'x', file: {xs: RAW.file.xs}};
		expect(parseGifItem(onlyXs)?.url).toBe('https://static.klipy.com/ii/a/xs.gif');
		expect(parseGifItem({slug: 'x', file: {}})).toBeNull();
		expect(parseGifItem({file: RAW.file})).toBeNull();
		expect(parseGifItem(null)).toBeNull();
	});

	it('never uses a blur preview that is not an inline image', () => {
		expect(parseGifItem({...RAW, blur_preview: 'https://evil.example/x.jpg'})?.blur).toBeNull();
	});
});

describe('parseGifPage', () => {
	it('keeps KLIPY order and reads has_next', () => {
		const page = parseGifPage({
			result: true,
			data: {data: [{...RAW, slug: 'b'}, {slug: 'broken'}, {...RAW, slug: 'a'}], has_next: true},
		});
		expect(page.items.map((i) => i.slug)).toEqual(['b', 'a']);
		expect(page.hasNext).toBe(true);
	});

	it('survives an empty or malformed response', () => {
		expect(parseGifPage(null)).toEqual({items: [], hasNext: false});
		expect(parseGifPage({data: {data: 'nope'}})).toEqual({items: [], hasNext: false});
	});
});

describe('matchLookups', () => {
	const item = (slug: string) => ({...(parseGifItem(RAW) as GifItem), slug});

	// Measured: search returns the suffixed slug, the items endpoint the bare one.
	it('matches a suffixed search slug to the bare slug the items endpoint returns', () => {
		const found = matchLookups(['rubik-cube-1980s--kOxbjG4Q5'], [item('rubik-cube-1980s')]);
		expect(found.get('rubik-cube-1980s--kOxbjG4Q5')?.slug).toBe('rubik-cube-1980s');
	});

	it('prefers an exact match, then the longest bare prefix', () => {
		const found = matchLookups(
			['cube-win--abc', 'hello-hi-662'],
			[item('cube'), item('cube-win'), item('hello-hi-662')]
		);
		expect(found.get('cube-win--abc')?.slug).toBe('cube-win');
		expect(found.get('hello-hi-662')?.slug).toBe('hello-hi-662');
	});

	it('leaves a slug KLIPY did not return unmatched', () => {
		expect(matchLookups(['gone--x'], [item('other')]).size).toBe(0);
	});
});

describe('klipyLocale', () => {
	it('maps the UI language to a country code', () => {
		expect(klipyLocale('tr')).toBe('tr');
		expect(klipyLocale('en-US')).toBe('us');
		expect(klipyLocale('zh')).toBe('cn');
		expect(klipyLocale(undefined)).toBe('tr');
		expect(klipyLocale('de')).toBe('tr');
	});
});
