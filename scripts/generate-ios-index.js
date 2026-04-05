/**
 * iOS Capacitor icin dist/index.html olusturur.
 * iOS'ta server.url olmadigi icin local asset'lerden yuklenir.
 * SSR yok — React client-side render yapar.
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
if (!fs.existsSync(distDir)) {
	fs.mkdirSync(distDir, { recursive: true });
}

fs.writeFileSync(path.join(distDir, 'index.html'), html);
console.log('[generate-ios-index] dist/index.html olusturuldu');
