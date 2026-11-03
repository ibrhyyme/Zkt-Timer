// Where ZKT Timer ranks in App Store and Google Play search, to measure listing changes.
// App Store: the public iTunes Search API, which tracks the store's own order closely
// but not exactly. Play: the first page of the web search (about 20 apps), so "-" there
// means "not on the first page", not "not indexed".
// Usage: node scripts/store-rank.js ["term" ...]
const APP_STORE_ID = 6760920873;
const PLAY_ID = 'com.zktimer.app';
const TERMS = process.argv.slice(2).length
	? process.argv.slice(2)
	: ['cube timer', 'speed cube timer', 'speedcube timer', 'rubik timer', 'zkt timer'];
const APP_STORE_COUNTRIES = ['tr', 'us', 'gb'];
const PLAY_LOCALES = [
	['tr', 'TR'],
	['en', 'US'],
];
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36';

async function appStore(term, country) {
	const res = await fetch(
		`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=${country}&entity=software&limit=200`
	);
	const { results } = await res.json();
	const index = results.findIndex((app) => app.trackId === APP_STORE_ID);
	return { rank: index < 0 ? '-' : index + 1, of: results.length, top: results.slice(0, 3).map((app) => app.trackName) };
}

async function play(term, hl, gl) {
	const res = await fetch(
		`https://play.google.com/store/search?q=${encodeURIComponent(term)}&c=apps&hl=${hl}&gl=${gl}`,
		{ headers: { 'user-agent': UA } }
	);
	const html = await res.text();
	const ids = [];
	for (const m of html.matchAll(/details\?id=([a-zA-Z0-9_.]+)/g)) if (!ids.includes(m[1])) ids.push(m[1]);
	const index = ids.indexOf(PLAY_ID);
	return { rank: index < 0 ? '-' : index + 1, of: ids.length, top: ids.slice(0, 3) };
}

(async () => {
	console.log(`Store search rank, ${new Date().toISOString().slice(0, 10)}`);
	for (const term of TERMS) {
		console.log(`\n"${term}"`);
		for (const country of APP_STORE_COUNTRIES) {
			const r = await appStore(term, country);
			console.log(`  App Store ${country.toUpperCase()}: ${String(r.rank).padStart(3)} / ${r.of}   top: ${r.top.join(' | ')}`);
		}
		for (const [hl, gl] of PLAY_LOCALES) {
			const r = await play(term, hl, gl);
			console.log(`  Play ${hl}-${gl}:     ${String(r.rank).padStart(3)} / ${r.of}   top: ${r.top.join(' | ')}`);
		}
	}
})();
