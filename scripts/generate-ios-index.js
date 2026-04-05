/**
 * iOS offline bundle olusturur.
 * Online'da sunucudan yuklenir, offline'da bu bundle fallback olarak kullanilir.
 *
 * Kullanim:
 *   yarn build
 *   node scripts/generate-ios-index.js
 *   Cikan "offline-bundle" klasorunu Xcode projesine ekle (Add Files > Create folder reference)
 */

const fs = require('fs');
const path = require('path');

const deploymentId = process.env.DEPLOYMENT_ID || 'app';
const jsFile = `${deploymentId}.min.js`;
const cssFile = `${deploymentId}.min.css`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#0F142B">
<title>Zkt-Timer</title>
<link rel="stylesheet" href="${cssFile}">
<style>
  body { margin: 0; background: #12141C; }
  #app { min-height: 100vh; }
</style>
</head>
<body>
<div id="app"></div>
<script>window.__STORE__ = "{}";</script>
<script src="${jsFile}"></script>
</body>
</html>`;

const distDir = path.join(__dirname, '..', 'dist');
const bundleDir = path.join(distDir, 'offline-bundle');
const publicDir = path.join(__dirname, '..', 'public');

// offline-bundle klasorunu olustur
if (fs.existsSync(bundleDir)) {
	fs.rmSync(bundleDir, { recursive: true });
}
fs.mkdirSync(bundleDir, { recursive: true });

// index.html olustur
fs.writeFileSync(path.join(bundleDir, 'index.html'), html);

// JS ve CSS kopyala
const filesToCopy = [jsFile, cssFile, 'solver-worker.js', 'cross-solver-worker.js'];
for (const file of filesToCopy) {
	const src = path.join(distDir, file);
	if (fs.existsSync(src)) {
		fs.copyFileSync(src, path.join(bundleDir, file));
	}
}

// public/images kopyala (logo, ikonlar vs.)
function copyDirSync(src, dest) {
	if (!fs.existsSync(src)) return;
	if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
	const entries = fs.readdirSync(src, { withFileTypes: true });
	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			copyDirSync(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

const imagesDir = path.join(publicDir, 'images');
if (fs.existsSync(imagesDir)) {
	copyDirSync(imagesDir, path.join(bundleDir, 'public', 'images'));
}

console.log('[generate-ios-index] offline-bundle olusturuldu: dist/offline-bundle/');
console.log('[generate-ios-index] Xcode\'a "offline-bundle" klasorunu ekle (Add Files > Create folder reference)');
