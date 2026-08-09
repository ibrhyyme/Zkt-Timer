import {firstYoutubeVideo, parseMessageBody, toSafeHref, youtubeVideoId} from '../message-links';

const links = (body: string) =>
	parseMessageBody(body)
		.filter((s) => s.type === 'link')
		.map((s) => (s as any).href);

const rebuilt = (body: string) =>
	parseMessageBody(body)
		.map((s) => (s.type === 'link' ? s.label : s.value))
		.join('');

describe('parseMessageBody', () => {
	it('leaves plain text alone', () => {
		expect(parseMessageBody('R U R\' U\' merhaba')).toEqual([{type: 'text', value: "R U R' U' merhaba"}]);
	});

	it('finds an http url in the middle of a sentence', () => {
		expect(links('bak buna https://example.com/a?b=1 guzelmis')).toEqual(['https://example.com/a?b=1']);
	});

	it('accepts a bare www host and gives it a scheme', () => {
		expect(links('www.zktimer.app adresine bak')).toEqual(['https://www.zktimer.app/']);
	});

	it('keeps sentence punctuation out of the address', () => {
		expect(links('sitesi https://example.com.')).toEqual(['https://example.com/']);
		expect(links('buraya bak: https://example.com/x, sonra')).toEqual(['https://example.com/x']);
	});

	it('keeps a closing bracket that belongs to the url', () => {
		expect(links('https://tr.wikipedia.org/wiki/Kup_(oyun)')).toEqual(['https://tr.wikipedia.org/wiki/Kup_(oyun)']);
	});

	it('drops a closing bracket that belongs to the sentence', () => {
		expect(links('(bak https://example.com/x)')).toEqual(['https://example.com/x']);
	});

	it('never loses a character of the original body', () => {
		const bodies = [
			'bak buna https://example.com/a?b=1 guzelmis',
			'(bak https://example.com/x) sonra www.zktimer.app.',
			'link yok burada',
			'https://a.com https://b.com arka arkaya',
			'3. adimda U R U\' R\' yap',
		];
		bodies.forEach((body) => expect(rebuilt(body)).toBe(body));
	});

	it('finds several links in one message', () => {
		expect(links('https://a.com ve https://b.com')).toEqual(['https://a.com/', 'https://b.com/']);
	});

	it('does not turn ordinary dotted words into links', () => {
		expect(links('3.adimda dosya.txt ve v1.2 surumu')).toEqual([]);
	});

	it('refuses schemes other than http and https', () => {
		// The pattern cannot match these, and the guard rejects them as well.
		expect(links('javascript:alert(1) ve data:text/html,<b>x</b>')).toEqual([]);
		expect(toSafeHref('javascript:alert(1)')).toBeNull();
	});

	it('treats a message that is only a link as one link', () => {
		expect(parseMessageBody('https://example.com')).toEqual([
			{type: 'link', href: 'https://example.com/', label: 'https://example.com'},
		]);
	});
});

describe('youtubeVideoId', () => {
	it('reads the id from every shape YouTube uses', () => {
		expect(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		expect(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		expect(youtubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		expect(youtubeVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=90s')).toBe('dQw4w9WgXcQ');
		expect(youtubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		expect(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe('dQw4w9WgXcQ');
	});

	it('ignores anything that is not a video', () => {
		expect(youtubeVideoId('https://www.youtube.com/@zktimer')).toBeNull();
		expect(youtubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
		expect(youtubeVideoId('https://www.youtube.com/watch?v=short')).toBeNull();
		expect(youtubeVideoId('not a url')).toBeNull();
	});

	it('does not fall for a lookalike host', () => {
		expect(youtubeVideoId('https://youtube.com.evil.tr/watch?v=dQw4w9WgXcQ')).toBeNull();
		expect(youtubeVideoId('https://notyoutube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
	});
});

describe('firstYoutubeVideo', () => {
	it('cards only the first video in a message', () => {
		const segments = parseMessageBody('https://youtu.be/dQw4w9WgXcQ ve https://youtu.be/aQw4w9WgXcQ');
		expect(firstYoutubeVideo(segments)?.id).toBe('dQw4w9WgXcQ');
	});

	it('returns nothing when there is no video', () => {
		expect(firstYoutubeVideo(parseMessageBody('https://example.com'))).toBeNull();
	});
});
