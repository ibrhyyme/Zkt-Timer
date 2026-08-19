/*
 * Packages native-bundle/ into an OTA artifact for the self-hosted Capgo updater.
 *
 * Outputs (under dist/ota/, shipped into the runtime image with the rest of dist/):
 *   bundle-<semver>.zip   index.html at the zip root (Capgo requirement)
 *   latest.json           { version, file, release, min_native, built_at }
 *
 * /api/ota/latest (server/app.ts) reads latest.json and answers the plugin's
 * update-check POST. The semver is 1.0.<epoch-seconds>: Capgo requires semver and
 * the epoch patch keeps it monotonically increasing across deploys. The underlying
 * git RELEASE_NAME is recorded as `release` for traceability.
 *
 * min_native: the lowest NATIVE app version whose plugin set is compatible with
 * this web bundle. BUMP THIS whenever a web change starts depending on a native
 * plugin/API that older binaries don't ship — otherwise old apps OTA into a bundle
 * that calls plugins they don't have.
 *
 * ...but it CANNOT gate a single platform, so do not reach for it when adding one
 * plugin. The value is compared against the native app version, and the two
 * platforms live in disjoint number spaces: Android versionName is 1.6.x while
 * iOS CFBundleShortVersionString is 2.0.x. Raising it to 1.6.2 lets every iOS
 * binary through (2 > 1); raising it to 2.0.18 cuts EVERY Android device off from
 * all future bundles. For a new plugin, make the web layer degrade at runtime
 * instead: probe for the plugin and fall back when it is absent. See
 * client/util/native-calendar.ts and client/util/slam-stop/plugin.ts.
 *
 * Run AFTER build-native-bundle.js: node build-ota-zip.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const ROOT = __dirname;
const BUNDLE = path.join(ROOT, 'native-bundle');
const OUT_DIR = path.join(ROOT, 'dist', 'ota');

// First native version that ships the local-bundle architecture (Capgo plugin,
// Preferences, zkttimer:// scheme). Bundles must never be offered below this.
const MIN_NATIVE_VERSION = process.env.OTA_MIN_NATIVE_VERSION || '1.6.0';

if (!fs.existsSync(path.join(BUNDLE, 'index.html'))) {
	console.error('[ota-zip] native-bundle/index.html missing — run build-native-bundle.js first');
	process.exit(1);
}

const version = `1.0.${Math.floor(Date.now() / 1000)}`;
const release = process.env.RELEASE_NAME || 'dev';
const fileName = `bundle-${version}.zip`;

fs.rmSync(OUT_DIR, {recursive: true, force: true});
fs.mkdirSync(OUT_DIR, {recursive: true});

const zip = new AdmZip();
zip.addLocalFolder(BUNDLE); // adds contents at zip root → index.html at root
zip.writeZip(path.join(OUT_DIR, fileName));

const manifest = {
	version,
	file: fileName,
	release,
	min_native: MIN_NATIVE_VERSION,
	built_at: new Date().toISOString(),
};
fs.writeFileSync(path.join(OUT_DIR, 'latest.json'), JSON.stringify(manifest, null, '\t'));

const sizeMb = (fs.statSync(path.join(OUT_DIR, fileName)).size / 1024 / 1024).toFixed(1);
console.info(`[ota-zip] OK — ${fileName} (${sizeMb} MB), release=${release}, min_native=${MIN_NATIVE_VERSION}`);
