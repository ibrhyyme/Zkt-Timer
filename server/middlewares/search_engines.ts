import fetch from 'node-fetch';

async function pipeRemote(url: string, res: any, contentType?: string) {
	try {
		const response = await fetch(url);
		if (!response.ok || !response.body) {
			res.status(response.status || 502).end();
			return;
		}
		if (contentType) {
			res.setHeader('Content-Type', contentType);
		}
		response.body.pipe(res);
	} catch {
		res.status(502).end();
	}
}

export function exposeResourcesForSearchEngines() {
	global.app.get('/robots.txt', (req, res) => {
		pipeRemote('https://zktimer.app/public/robots.txt', res, 'text/plain; charset=utf-8');
	});
	global.app.get('/sitemap.xml', (req, res) => {
		pipeRemote('https://zktimer.app/public/uploads/site/sitemaps/sitemap.xml', res, 'application/xml; charset=utf-8');
	});
	global.app.get('/llms.txt', (req, res) => {
		pipeRemote('https://zktimer.app/public/llms.txt', res, 'text/plain; charset=utf-8');
	});
}
