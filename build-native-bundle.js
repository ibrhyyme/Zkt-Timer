/*
 * Assembles the self-contained web root for the native apps (Faz 2 local bundle).
 *
 * Output: native-bundle/
 *   index.html          (generated below — client-only boot shell)
 *   dist/               (app.min.js/css + the three worker bundles, copied from ./dist)
 *   public/             (runtime assets, copied from ./public minus exclusions)
 *
 * The directory layout mirrors the live site's URL structure on purpose: hardcoded
 * absolute paths in the client (/dist/scramble-worker.js, /public/trainer/*.json,
 * /public/fonts|images|audio/*, resourceUri('/public')) resolve against the local
 * origin without any code changes.
 *
 * Used as `webDir` by capacitor.config.ts (baked into APK/IPA via `cap sync`) and
 * zipped by the deploy pipeline as the OTA bundle (see /api/ota/latest).
 *
 * Run AFTER `yarn build`: node build-native-bundle.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'native-bundle');
const DIST = path.join(ROOT, 'dist');
const PUBLIC = path.join(ROOT, 'public');

const version = process.env.RELEASE_NAME || Date.now().toString();

// Everything the app can fetch at runtime must ship; everything site-only stays out.
// partners/ + welcome/ (~20 MB landing imagery) are intentionally excluded — the
// client resolves them remotely in the local shell (client/util/api-base.ts
// landingAsset). uploads/ is server-side user content, never bundled.
const PUBLIC_EXCLUDES = new Set([
	'uploads',
	'partners',
	'welcome',
	'.well-known',
	'sw.js',
	'index.html',
	'error.html',
	'robots.txt',
	'llms.txt',
	'google63ac6a88a4ff5ea8.html',
]);

// Only the build outputs — never stale artifacts like dist/offline-bundle or the
// hand-authored dist/index.html.
const DIST_FILES = [
	'app.min.js',
	'app.min.css',
	'scramble-worker.js',
	'solver-worker.js',
	'cross-solver-worker.js',
];

function copyDir(src, dest, excludes) {
	fs.mkdirSync(dest, {recursive: true});
	for (const entry of fs.readdirSync(src, {withFileTypes: true})) {
		if (excludes && excludes.has(entry.name)) continue;
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			copyDir(srcPath, destPath, null);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

// The shell replicates the boot-critical parts of server/html_template.ts:
// theme pre-paint script, viewport, app css/js with cache-busting, cubing icons,
// empty __STORE__ (client boots from local DB + cached identity) and
// __ASSET_VERSION__ for the worker managers. Google Fonts degrade gracefully offline.
const INDEX_HTML = `<!DOCTYPE html>
<html lang="tr">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
		<meta name="theme-color" content="#0F142B">
		<title>Zkt Timer</title>
		<script>try{var _t=JSON.parse(localStorage.getItem('zkt_theme'));if(_t){var _h=document.documentElement,_s=_h.style;if(_t.bg)_s.setProperty('--background-color',_t.bg);if(_t.mod)_s.setProperty('--module-color',_t.mod);if(_t.btn)_s.setProperty('--button-color',_t.btn);if(_t.txt)_s.setProperty('--text-color',_t.txt);if(_t.pri)_s.setProperty('--primary-color',_t.pri);if(_t.sec)_s.setProperty('--secondary-color',_t.sec);_h.classList.add(_t.light?'theme-light':'theme-dark');}}catch(e){}</script>
		<link rel="preconnect" href="https://fonts.gstatic.com">
		<link rel="preload" href="https://fonts.googleapis.com/css2?family=Fira+Mono&family=Fira+Sans&family=JetBrains+Mono&family=Kiwi+Maru&family=Montserrat&family=Poppins&family=Roboto+Mono&family=Space+Mono&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
		<link rel="preload" href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,500;0,600;0,700;0,800;0,900;1,500;1,600;1,700;1,900&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
		<link rel="stylesheet" href="/dist/app.min.css?v=${version}">
		<link rel="stylesheet" href="/public/cubing-icons/cubing-icons.css">
		<link rel="icon" type="image/png" href="/public/images/zkt-logo.png">
		<style>body{margin:0;background:#12141C}#app{min-height:100vh}</style>
	</head>
	<body>
		<div id="app"></div>
	</body>
	<script type="text/javascript">
		window.__STORE__ = "{}";
		window.__ASSET_VERSION__ = ${JSON.stringify(version)};
	</script>
	<script src="/dist/app.min.js?v=${version}"></script>
</html>
`;

// Fresh output every run — a stale native-bundle must never leak old assets into
// the binary or the OTA zip.
fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(OUT, {recursive: true});

const distOut = path.join(OUT, 'dist');
fs.mkdirSync(distOut, {recursive: true});
let missing = [];
for (const file of DIST_FILES) {
	const src = path.join(DIST, file);
	if (!fs.existsSync(src)) {
		missing.push(file);
		continue;
	}
	fs.copyFileSync(src, path.join(distOut, file));
}
if (missing.length) {
	console.error('[native-bundle] Missing build outputs (run `yarn build` first):', missing.join(', '));
	process.exit(1);
}

copyDir(PUBLIC, path.join(OUT, 'public'), PUBLIC_EXCLUDES);
fs.writeFileSync(path.join(OUT, 'index.html'), INDEX_HTML);

const sizeMb = (dir) => {
	let total = 0;
	const walk = (d) => {
		for (const e of fs.readdirSync(d, {withFileTypes: true})) {
			const p = path.join(d, e.name);
			if (e.isDirectory()) walk(p);
			else total += fs.statSync(p).size;
		}
	};
	walk(dir);
	return (total / 1024 / 1024).toFixed(1);
};

console.info(`[native-bundle] OK — version=${version}, size=${sizeMb(OUT)} MB → ${OUT}`);
