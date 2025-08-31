import request from 'request';

export function exposeResourcesForSearchEngines() {
	global.app.get('/robots.txt', (req, res) => {
		request(`https://cdn.zkt-timer.io/static/robots.txt`).pipe(res);
	});
	global.app.get('/sitemap.xml', (req, res) => {
		request('https://cdn.zkt-timer.io/site/sitemaps/sitemap.xml').pipe(res);
	});
}
