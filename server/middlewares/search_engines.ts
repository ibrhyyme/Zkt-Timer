import request from 'request';

export function exposeResourcesForSearchEngines() {
	global.app.get('/robots.txt', (req, res) => {
		request(`https://zktimer.app/static/robots.txt`).pipe(res);
	});
	global.app.get('/sitemap.xml', (req, res) => {
		request('https://zktimer.app/site/sitemaps/sitemap.xml').pipe(res);
	});
}
