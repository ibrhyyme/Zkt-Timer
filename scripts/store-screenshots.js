// Renders the store screenshots (caption + app capture on the app's own background) for
// every language:
//   play   1080x1920  android/fastlane/metadata/android/<locale>/images/phoneScreenshots/<n>.png
//   iphone 1290x2796  ios/App/fastlane/screenshots/<locale>/<n>_iphone67.png
//   ipad   2732x2048  ios/App/fastlane/screenshots/<locale>/<n>_ipadPro129.png
// Raw captures come from the live app (?lang=<lang>): phone at 390x844 @3x as
// raw_<n>_<lang>.png, iPad at 1366x1024 @2x (landscape) as ipad_<n>_<lang>.png.
// <rawDir>/look.json holds the look the captures were taken in:
//   { "background": "aurora", "palette": { "bg": "18, 20, 28", "mod": .., "pri": .., "sec": .., "txt": .. } }
// The backdrop is that ready-made background drawn full size by the app's own renderer
// (preset_renderer.ts, bundled here with esbuild), so the image carries the real theme
// instead of a stock gradient. No device frame: Google Play asks for no device imagery.
// Poppins has no Cyrillic or CJK, so Russian captions use Segoe UI and Chinese ones
// Microsoft YaHei (Windows system fonts). The "ipadPro129" file name tells deliver
// the images belong to the 12.9/13-inch iPad slot.
// Usage: node scripts/store-screenshots.js <projectRoot> <rawDir> <fontDir> [play,iphone,ipad]
// STORE_SHOTS_OUT=<dir> writes the same tree under <dir> instead of the repo, for a preview;
// STORE_SHOTS_LANGS=tr,en limits the languages.
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');

const [, , projectRoot, rawDir, fontDir, only] = process.argv;
const outRoot = process.env.STORE_SHOTS_OUT || projectRoot;
const projectRequire = createRequire(path.join(projectRoot, 'package.json'));
const { chromium } = projectRequire('playwright');
const esbuild = projectRequire('esbuild');
const url = (p) => 'file:///' + path.resolve(p).split(path.sep).join('/');

// Order is the store order; n names the raw capture. Pro screens carry the PRO badge
// (App Review 2.3.2: paid features must say so). h = headline, s = line under it.
const SHOTS = [
	{
		n: 1,
		tr: { h: 'Cube Timer', s: 'Dokunmatik ekran, StackMat veya akıllı küp: Nasıl istersen öyle süre tut.' },
		en: { h: 'Cube Timer', s: 'Touchscreen, StackMat or smart cube: time your solves the way you like.' },
		es: { h: 'Cronómetro de cubo', s: 'Pantalla táctil, StackMat o cubo inteligente: cronometra como prefieras.' },
		ru: { h: 'Таймер для кубика', s: 'Сенсорный экран, StackMat или смарт-куб: засекайте время как удобно.' },
		zh: { h: '魔方计时器', s: '触屏、StackMat 或智能魔方，用你喜欢的方式计时。' },
	},
	{
		n: 2,
		pro: true,
		tr: { h: 'Zamanı Nerede Kaybediyorsun?', s: 'Smart küp ile her çözümde Cross, F2L, OLL ve PLL sürelerini ayrı ayrı analiz et.' },
		en: { h: 'Where Are You Losing Time?', s: 'Analyze your Cross, F2L, OLL and PLL times separately on every smart cube solve.' },
		es: { h: '¿Dónde pierdes tiempo?', s: 'Con un cubo inteligente, analiza por separado Cross, F2L, OLL y PLL en cada resolución.' },
		ru: { h: 'Где вы теряете время?', s: 'Со смарт-кубом анализируйте Cross, F2L, OLL и PLL каждой сборки отдельно.' },
		zh: { h: '时间都花在哪了？', s: '用智能魔方分别分析每次还原的 Cross、F2L、OLL 和 PLL 用时。' },
	},
	{
		n: 3,
		tr: { h: '40+ Algoritma Seti', s: 'OLL, PLL, F2L ve ZBLL hazır; dilersen kendi özel setini de oluştur.' },
		en: { h: '40+ Algorithm Sets', s: 'OLL, PLL, F2L and ZBLL ready to go, or build a custom set of your own.' },
		es: { h: 'Más de 40 sets de algoritmos', s: 'OLL, PLL, F2L y ZBLL listos; si quieres, crea tu propio set.' },
		ru: { h: '40+ наборов алгоритмов', s: 'OLL, PLL, F2L и ZBLL уже готовы, а можно собрать свой набор.' },
		zh: { h: '40+ 组公式', s: 'OLL、PLL、F2L 和 ZBLL 现成可用，也能自建公式组。' },
	},
	{
		n: 4,
		tr: { h: 'Canlı 1v1 Düellolar', s: 'Aynı scramble, eş zamanlı yarış: Üç turu ilk kazanan maçı alır!' },
		en: { h: 'Live 1v1 Duels', s: 'Same scramble, solved at the same time: first to three rounds wins!' },
		es: { h: 'Duelos 1 contra 1 en vivo', s: 'La misma mezcla, a la vez: ¡gana quien se lleve tres rondas!' },
		ru: { h: 'Дуэли 1 на 1 вживую', s: 'Один скрамбл, старт одновременно: побеждает первый, кто выиграет три раунда!' },
		zh: { h: '实时一对一对决', s: '同一打乱，同时开拼：先赢三局者胜！' },
	},
	{
		n: 5,
		tr: { h: 'Gelişimin Hep Yanında', s: "PB'lerin, ao5/ao12 ortalamaların ve toplam çözüm istatistiklerin tek yerde." },
		en: { h: 'Your Progress, Always With You', s: 'Your PBs, ao5/ao12 averages and total solve stats in one place.' },
		es: { h: 'Tu progreso, siempre contigo', s: 'Tus PB, medias ao5/ao12 y estadísticas de resoluciones en un solo lugar.' },
		ru: { h: 'Прогресс всегда под рукой', s: 'PB, средние ao5/ao12 и статистика сборок в одном месте.' },
		zh: { h: '进步随时可见', s: 'PB、ao5/ao12 平均和总还原统计集中在一处。' },
	},
	{
		n: 6,
		tr: { h: 'Yarışma Profilin', s: 'Katıldığın tüm yarışmalar, turnuva sıralamaların ve en iyi derecelerin.' },
		en: { h: 'Your Competition Profile', s: "Every competition you've entered, your rankings and your best results." },
		es: { h: 'Tu perfil de competiciones', s: 'Todas tus competiciones, tus clasificaciones y tus mejores marcas.' },
		ru: { h: 'Соревновательный профиль', s: 'Все ваши соревнования, места и лучшие результаты.' },
		zh: { h: '你的比赛档案', s: '参加过的所有比赛、排名和最好成绩。' },
	},
	{
		n: 7,
		tr: { h: 'Anlık Yarışma Takibi', s: 'Turnuva sonuçları girildikçe anlık güncellenen canlı sıralamalar.' },
		en: { h: 'Live Competition Tracking', s: 'Live rankings that update the moment results are entered.' },
		es: { h: 'Competiciones al instante', s: 'Clasificaciones en directo que se actualizan al introducir los resultados.' },
		ru: { h: 'Соревнования в реальном времени', s: 'Таблицы обновляются сразу по мере ввода результатов.' },
		zh: { h: '比赛实时追踪', s: '成绩一录入，实时排名就更新。' },
	},
	{
		n: 8,
		tr: { h: 'Dinamik Arka Planlar', s: 'Uygulamanın renklerine uyum sağlayan hareketli arka planlar (Temalar Pro ile).' },
		en: { h: 'Dynamic Backgrounds', s: "Moving backgrounds that match the app's colors (themes with Pro)." },
		es: { h: 'Fondos dinámicos', s: 'Fondos animados que se adaptan a los colores de la app (temas con Pro).' },
		ru: { h: 'Динамические фоны', s: 'Живые фоны в цветах приложения (темы с Pro).' },
		zh: { h: '动态背景', s: '跟随应用配色的动态背景（主题需 Pro）。' },
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
// Google Play: taglines take no more than 20% of the image.
const MAX_CAPTION_SHARE = 0.2;

const PROFILES = {
	play: {
		w: 1080, h: 1920, raw: 'raw', pad: 96, side: 84, head: 80, sub: 40, badge: 28, gap: 56,
		card: 900, radius: 52, border: 3,
		out: (lang, i) => path.join(outRoot, 'android/fastlane/metadata/android', LOCALES[lang][0], 'images/phoneScreenshots', `${i}.png`),
		mine: (f) => /^\d+\.png$/.test(f),
	},
	iphone: {
		w: 1290, h: 2796, raw: 'raw', pad: 150, side: 100, head: 96, sub: 48, badge: 34, gap: 72,
		card: 1070, radius: 64, border: 4,
		out: (lang, i) => path.join(outRoot, 'ios/App/fastlane/screenshots', LOCALES[lang][1], `${i}_iphone67.png`),
		mine: (f) => /_iphone67\.png$/.test(f),
	},
	// Large iPads run the app in landscape only (AppDelegate), so the 13-inch set is landscape.
	ipad: {
		w: 2732, h: 2048, raw: 'ipad', pad: 96, side: 316, head: 88, sub: 44, badge: 32, gap: 56,
		card: 2100, radius: 44, border: 4,
		out: (lang, i) => path.join(outRoot, 'ios/App/fastlane/screenshots', LOCALES[lang][1], `${i}_ipadPro129.png`),
		mine: (f) => /_ipadPro129\.png$/.test(f),
	},
};

// Phone and desktop keep their own background (mobile_prefs / desktop_prefs), so look.json
// may hold one look per capture kind: { "raw": {..}, "ipad": {..} }.
const looks = JSON.parse(fs.readFileSync(path.join(rawDir, 'look.json'), 'utf8'));
const lookFor = (p) => looks[p.raw] || looks;

// The app's background renderer, bundled for the page. Draws once, then swaps the canvas
// for an image so the screenshot never races the WebGL drawing buffer.
const BG_SCRIPT = path.join(rawDir, '_bg.js');
fs.writeFileSync(
	BG_SCRIPT,
	esbuild.buildSync({
		stdin: {
			contents: `
import { createPresetRenderer } from './client/components/timer/timer_background/presets/preset_renderer';
import { PRESET_STILL_TIME, isPresetBackgroundId } from './client/components/timer/timer_background/presets/preset_shaders';
import { parseRgbTriplet, isLightRgb } from './client/components/timer/timer_background/presets/theme_colors';
(window as any).drawStoreBackground = (id: string, colours: Record<string, string>): string => {
	if (!isPresetBackgroundId(id)) return 'none';
	const canvas = document.getElementById('bg') as HTMLCanvasElement;
	const bg = parseRgbTriplet(colours.bg, [18, 20, 28]);
	const palette = {
		bg,
		mod: parseRgbTriplet(colours.mod, bg),
		pri: parseRgbTriplet(colours.pri, bg),
		sec: parseRgbTriplet(colours.sec, bg),
		txt: parseRgbTriplet(colours.txt, [255, 255, 255]),
		light: isLightRgb(bg),
	};
	const renderer = createPresetRenderer(canvas);
	if (!renderer) return 'no-webgl';
	if (!renderer.draw(id, canvas.width, canvas.height, PRESET_STILL_TIME, palette)) return 'draw-failed';
	const img = document.createElement('img');
	img.id = 'bg';
	img.src = canvas.toDataURL('image/png');
	canvas.replaceWith(img);
	return 'ok';
};`,
			resolveDir: projectRoot,
			loader: 'ts',
		},
		bundle: true,
		write: false,
		format: 'iife',
		platform: 'browser',
		target: 'chrome110',
	}).outputFiles[0].text
);

const esc = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const pageHtml = (p, caption, img, pro, lang) => {
	const look = lookFor(p);
	const rgb = (key) => `rgb(${look.palette[key]})`;
	const rgba = (key, a) => `rgba(${look.palette[key]}, ${a})`;
	const font = CAPTION_FONT[lang] || 'P';
	const tracking = CAPTION_FONT[lang] ? '0' : '-0.02em';
	return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
@font-face { font-family: P; font-weight: 700; src: url('${url(path.join(fontDir, 'poppins-700-latin.woff2'))}'); }
@font-face { font-family: P; font-weight: 700; src: url('${url(path.join(fontDir, 'poppins-700-latin-ext.woff2'))}'); unicode-range: U+0100-024F; }
@font-face { font-family: P; font-weight: 600; src: url('${url(path.join(fontDir, 'poppins-600-latin.woff2'))}'); }
@font-face { font-family: P; font-weight: 600; src: url('${url(path.join(fontDir, 'poppins-600-latin-ext.woff2'))}'); unicode-range: U+0100-024F; }
html, body { margin: 0; width: ${p.w}px; height: ${p.h}px; overflow: hidden; background: ${rgb('bg')}; }
#bg { position: absolute; inset: 0; width: ${p.w}px; height: ${p.h}px; display: block; }
.wrap { position: relative; box-sizing: border-box; height: 100%; padding-top: ${p.pad}px; display: flex; flex-direction: column; align-items: center; }
.cap { align-self: stretch; margin: 0 ${p.side}px; color: ${rgb('txt')}; text-align: center; }
.h { font: 700 ${p.head}px/1.1 ${font}, sans-serif; letter-spacing: ${tracking}; text-wrap: balance; }
.s { margin-top: ${Math.round(p.sub * 0.45)}px; font: 600 ${p.sub}px/1.3 ${font}, sans-serif; text-wrap: balance; }
.pro { display: inline-block; margin-bottom: ${Math.round(p.badge * 0.7)}px; padding: ${Math.round(p.badge * 0.3)}px ${Math.round(p.badge * 0.76)}px; border-radius: 999px; background: #ecd9a4; color: #15161c; font: 600 ${p.badge}px/1 P, sans-serif; letter-spacing: 3px; }
.card { flex: none; margin-top: ${p.gap}px; width: ${p.card}px; border-radius: ${p.radius}px; overflow: hidden; border: ${p.border}px solid ${rgba('txt', 0.18)}; background: ${rgb('mod')}; }
.card img { display: block; width: 100%; }
</style></head><body>
<canvas id="bg" width="${p.w}" height="${p.h}"></canvas>
<div class="wrap">
<div class="cap">${pro ? '<div class="pro">PRO</div><br>' : ''}<div class="h">${esc(caption.h)}</div><div class="s">${esc(caption.s)}</div></div>
<div class="card"><img src="${url(img)}"></div>
</div>
</body></html>`;
};

(async () => {
	// Headless Chromium has no GPU; SwiftShader gives WebGL2 for the background.
	const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
	const wanted = only ? only.split(',') : Object.keys(PROFILES);
	const htmlPath = path.join(rawDir, '_compose.html');
	for (const name of wanted) {
		const p = PROFILES[name];
		const page = await browser.newPage({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: 1 });
		for (const lang of (process.env.STORE_SHOTS_LANGS ? process.env.STORE_SHOTS_LANGS.split(',') : Object.keys(LOCALES))) {
			const dir = path.dirname(p.out(lang, 1));
			fs.mkdirSync(dir, { recursive: true });
			for (const f of fs.readdirSync(dir)) if (p.mine(f)) fs.unlinkSync(path.join(dir, f));
			for (const [i, s] of SHOTS.entries()) {
				const img = path.join(rawDir, `${p.raw}_${s.n}_${lang}.png`);
				if (!fs.existsSync(img)) throw new Error(`missing capture ${img}`);
				// about:blank cannot load file:// images, fonts or scripts, so render from a file.
				fs.writeFileSync(htmlPath, pageHtml(p, s[lang], img, s.pro, lang));
				await page.goto(url(htmlPath), { waitUntil: 'load' });
				await page.addScriptTag({ path: BG_SCRIPT });
				const drawn = await page.evaluate(([id, colours]) => window.drawStoreBackground(id, colours), [lookFor(p).background, lookFor(p).palette]);
				if (drawn !== 'ok' && drawn !== 'none') throw new Error(`background ${lookFor(p).background} not drawn: ${drawn}`);
				await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((im) => im.decode())]));
				const check = await page.evaluate(() => {
					const cap = document.querySelector('.cap').getBoundingClientRect();
					return {
						card: document.querySelector('.card img').naturalWidth,
						share: (cap.height * cap.width) / (window.innerWidth * window.innerHeight),
						poppins: document.fonts.check('700 40px P'),
					};
				});
				if (!check.card) throw new Error(`capture not loaded for ${name} ${lang} ${s.n}`);
				if (!CAPTION_FONT[lang] && !check.poppins) throw new Error(`Poppins not loaded for ${name} ${lang} ${s.n}`);
				if (check.share > MAX_CAPTION_SHARE) console.warn(`caption takes ${(check.share * 100).toFixed(1)}% on ${name} ${lang} ${s.n}`);
				const out = p.out(lang, i + 1);
				await page.screenshot({ path: out });
				console.log(out);
			}
		}
		await page.close();
	}
	fs.rmSync(htmlPath, { force: true });
	fs.rmSync(BG_SCRIPT, { force: true });
	await browser.close();
})();
