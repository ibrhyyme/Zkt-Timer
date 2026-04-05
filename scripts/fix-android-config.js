/**
 * Android cap sync sonrasi server.url ekler.
 * Android remote'dan yukler (online gerekli, ama WebView cache agresif).
 */

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'capacitor.config.json');

if (!fs.existsSync(configPath)) {
	console.error('[fix-android-config] capacitor.config.json bulunamadi! Once "npx cap sync android" calistirin.');
	process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
config.server = config.server || {};
config.server.url = 'https://zktimer.app';

fs.writeFileSync(configPath, JSON.stringify(config, null, '\t'));
console.log('[fix-android-config] Android config\'e server.url eklendi');
