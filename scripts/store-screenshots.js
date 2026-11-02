// Renders the store screenshots (caption + framed app capture) for every language:
//   play   1080x1920  android/fastlane/metadata/android/<locale>/images/phoneScreenshots/<n>.png
//   iphone 1290x2796  ios/App/fastlane/screenshots/<locale>/<n>_iphone67.png
//   ipad   2732x2048  ios/App/fastlane/screenshots/<locale>/<n>_ipadPro129.png
// Raw captures come from the live app (?lang=<lang>): phone at 390x844 @3x as
// raw_<n>_<lang>.png, iPad at 1366x1024 @2x (landscape) as ipad_<n>_<lang>.png.
// Poppins has no Cyrillic or CJK, so Russian captions use Segoe UI and Chinese ones
// Microsoft YaHei (Windows system fonts). The "ipadPro129" file name tells deliver
// the images belong to the 12.9/13-inch iPad slot.
// Usage: node scripts/store-screenshots.js <projectRoot> <rawDir> <fontDir> [play,iphone,ipad]
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

const [, , projectRoot, rawDir, fontDir, only] = process.argv;
const { chromium } = createRequire(path.join(projectRoot, 'package.json'))('playwright');
const url = (p) => 'file:///' + path.resolve(p).split(path.sep).join('/');

const SHOTS = [
	{
		n: 1,
		tr: 'Karıştırma, süre ve ortalamalar',
		en: 'Scramble, time and averages',
		es: 'Mezcla, tiempo y medias',
		ru: 'Скрамбл, время и средние',
		zh: '打乱、成绩和平均一屏看全',
	},
	{
		n: 2,
		pro: true,
		tr: 'Smart küple her aşamanın süresi',
		en: 'Every phase of a smart cube solve',
		es: 'Cada fase con tu cubo inteligente',
		ru: 'Время каждого этапа на смарт-кубе',
		zh: '智能魔方每个阶段的用时',
	},
	{
		n: 4,
		tr: "Smart küple online 1'e 1",
		en: '1v1 online with smart cubes',
		es: '1 contra 1 online con cubo inteligente',
		ru: '1 на 1 онлайн на смарт-кубах',
		zh: '用智能魔方在线一对一',
	},
	{
		n: 3,
		tr: "40'tan fazla algoritma seti",
		en: 'More than 40 algorithm sets',
		es: 'Más de 40 sets de algoritmos',
		ru: 'Более 40 наборов алгоритмов',
		zh: '超过 40 组公式',
	},
	{
		n: 5,
		tr: 'Tüm çözümlerinin istatistikleri',
		en: 'Stats across all your solves',
		es: 'Estadísticas de todas tus resoluciones',
		ru: 'Статистика всех ваших сборок',
		zh: '所有还原的统计',
	},
];

// lang -> [Play locale, App Store locale]
const LOCALES = {
	tr: ['tr-TR', 'tr'],
	en: ['en-US', 'en-US'],
	es: ['es-ES', 'es-ES'],
	ru: ['ru-RU', 'ru'],
	zh: ['zh-CN', 'zh-Hans'],
};
const CAPTION_FONT = { ru: "'Segoe UI'", zh: "'Microsoft YaHei'" };

const PROFILES = {
	play: {
		w: 1080, h: 1920, raw: 'raw', pad: 128, side: 96, font: 78, badge: 34, gap: 88,
		frame: 820, border: 16, radius: 76,
		out: (lang, i) => path.join(projectRoot, 'android/fastlane/metadata/android', LOCALES[lang][0], 'images/phoneScreenshots', `${i}.png`),
		mine: (f) => /^\d+\.png$/.test(f),
	},
	iphone: {
		w: 1290, h: 2796, raw: 'raw', pad: 210, side: 116, font: 92, badge: 40, gap: 110,
		frame: 1010, border: 20, radius: 96,
		out: (lang, i) => path.join(projectRoot, 'ios/App/fastlane/screenshots', LOCALES[lang][1], `${i}_iphone67.png`),
		mine: (f) => /_iphone67\.png$/.test(f),
	},
	// Large iPads run the app in landscape only (AppDelegate), so the 13-inch set is landscape.
	ipad: {
		w: 2732, h: 2048, raw: 'ipad', pad: 140, side: 180, font: 96, badge: 44, gap: 90,
		frame: 2000, border: 24, radius: 56,
		out: (lang, i) => path.join(projectRoot, 'ios/App/fastlane/screenshots', LOCALES[lang][1], `${i}_ipadPro129.png`),
		mine: (f) => /_ipadPro129\.png$/.test(f),
	},
};

const pageHtml = (p, caption, img, pro, lang) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
@font-face { font-family: P; font-weight: 700; src: url('${url(path.join(fontDir, 'poppins-700-latin.woff2'))}'); }
@font-face { font-family: P; font-weight: 700; src: url('${url(path.join(fontDir, 'poppins-700-latin-ext.woff2'))}'); unicode-range: U+0100-024F; }
@font-face { font-family: P; font-weight: 600; src: url('${url(path.join(fontDir, 'poppins-600-latin.woff2'))}'); }
html, body { margin: 0; width: ${p.w}px; height: ${p.h}px; overflow: hidden; background: #f3f1ec; }
body { box-sizing: border-box; padding-top: ${p.pad}px; display: flex; flex-direction: column; align-items: center; }
.cap { align-self: stretch; margin: 0 ${p.side}px; font: 700 ${p.font}px/1.16 ${CAPTION_FONT[lang] || 'P'}, sans-serif; color: #15161c; letter-spacing: ${CAPTION_FONT[lang] ? '0' : '-1px'}; }
.pro { display: inline-block; margin-bottom: ${Math.round(p.badge * 0.8)}px; padding: ${Math.round(p.badge * 0.3)}px ${Math.round(p.badge * 0.76)}px; border-radius: 999px; background: #ecd9a4; color: #15161c; font: 600 ${p.badge}px/1 P, sans-serif; letter-spacing: 3px; }
.frame { flex: none; margin-top: ${p.gap}px; width: ${p.frame}px; border: ${p.border}px solid #15161c; border-radius: ${p.radius}px; overflow: hidden; background: #15161c; }
.frame img { display: block; width: 100%; border-radius: ${p.radius - p.border}px; }
</style></head><body>
<div class="cap">${pro ? '<div class="pro">PRO</div><br>' : ''}${caption}</div>
<div class="frame"><img src="${url(img)}"></div>
</body></html>`;

(async () => {
	const browser = await chromium.launch();
	const wanted = only ? only.split(',') : Object.keys(PROFILES);
	for (const name of wanted) {
		const p = PROFILES[name];
		const page = await browser.newPage({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: 1 });
		for (const lang of Object.keys(LOCALES)) {
			const dir = path.dirname(p.out(lang, 1));
			fs.mkdirSync(dir, { recursive: true });
			for (const f of fs.readdirSync(dir)) if (p.mine(f)) fs.unlinkSync(path.join(dir, f));
			for (const [i, s] of SHOTS.entries()) {
				const img = path.join(rawDir, `${p.raw}_${s.n}_${lang}.png`);
				if (!fs.existsSync(img)) throw new Error(`missing capture ${img}`);
				// about:blank cannot load file:// images or fonts, so render from a file.
				const htmlPath = path.join(rawDir, '_compose.html');
				fs.writeFileSync(htmlPath, pageHtml(p, s[lang], img, s.pro, lang));
				await page.goto(url(htmlPath), { waitUntil: 'load' });
				await page.evaluate(() => document.fonts.ready);
				// Fonts load lazily: Poppins is only on the page for Latin captions or the PRO badge.
				const usesPoppins = !CAPTION_FONT[lang] || !!s.pro;
				const ok = await page.evaluate(
					(needP) => [document.querySelector('img').naturalWidth, !needP || document.fonts.check('600 34px P') || document.fonts.check('700 78px P')],
					usesPoppins
				);
				if (!ok[0] || !ok[1]) throw new Error(`asset not loaded for ${name} ${lang} ${s.n}: ${ok}`);
				const out = p.out(lang, i + 1);
				await page.screenshot({ path: out });
				console.log(out);
			}
		}
		await page.close();
	}
	fs.rmSync(path.join(rawDir, '_compose.html'), { force: true });
	await browser.close();
})();
