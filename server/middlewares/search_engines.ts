import fetch from 'node-fetch';
import { getSiteConfig } from '../models/site_config';
import { applyLaunchBlocks, isOnlineBattleLaunched } from '../../client/components/battle/battle_landing_modes';

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
	// Not piped: lines marked for the Online Battle launch are dropped until the flag is on
	// (ranking-battle 7.4), so they appear with the flag and need no deploy.
	global.app.get('/llms.txt', async (req, res) => {
		try {
			const response = await fetch('https://zktimer.app/public/llms.txt');
			if (!response.ok) {
				res.status(response.status || 502).end();
				return;
			}
			const text = await response.text();
			let launched = false;
			try {
				launched = isOnlineBattleLaunched(await getSiteConfig());
			} catch {
				// Unknown flag: keep the launch lines out
			}
			res.setHeader('Content-Type', 'text/plain; charset=utf-8');
			res.send(applyLaunchBlocks(text, launched));
		} catch {
			res.status(502).end();
		}
	});
}
