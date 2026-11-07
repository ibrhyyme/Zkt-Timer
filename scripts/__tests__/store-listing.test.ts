// Store listing guard: the fastlane text and screenshots that `fastlane listing` uploads.
// The Terms of Use link is not optional: App Review rejected 2.0.31 (Guideline 3.1.2)
// when a rewrite of the descriptions dropped it. Apps with auto-renewable subscriptions
// must carry a working Terms of Use (EULA) link in every App Store localization.
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const IOS_METADATA = path.join(ROOT, 'ios/App/fastlane/metadata');
const IOS_SCREENSHOTS = path.join(ROOT, 'ios/App/fastlane/screenshots');
const PLAY_METADATA = path.join(ROOT, 'android/fastlane/metadata/android');
const TERMS_URL = 'https://zktimer.app/terms';

const dirs = (root: string) =>
	fs.readdirSync(root).filter((name) => fs.statSync(path.join(root, name)).isDirectory());
const read = (...parts: string[]) => fs.readFileSync(path.join(...parts), 'utf8');
const chars = (text: string) => Array.from(text).length;
const words = (text: string) =>
	text
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean);

describe('App Store listing', () => {
	const locales = dirs(IOS_METADATA);

	it('has every locale', () => {
		expect(locales.sort()).toEqual(['en-US', 'es-ES', 'ru', 'tr', 'zh-Hans']);
	});

	describe.each(locales)('%s', (locale) => {
		const field = (name: string) => read(IOS_METADATA, locale, `${name}.txt`);

		it('links the Terms of Use in the description', () => {
			expect(field('description')).toContain(TERMS_URL);
		});

		it('stays within the field limits', () => {
			expect(chars(field('name'))).toBeLessThanOrEqual(30);
			expect(chars(field('subtitle'))).toBeLessThanOrEqual(30);
			expect(chars(field('promotional_text'))).toBeLessThanOrEqual(170);
			expect(chars(field('description'))).toBeLessThanOrEqual(4000);
			expect(field('release_notes').trim()).not.toBe('');
		});

		it('writes keywords as a comma list within 100 bytes', () => {
			const keywords = field('keywords');
			expect(Buffer.byteLength(keywords, 'utf8')).toBeLessThanOrEqual(100);
			expect(keywords).not.toMatch(/,\s|\s,/);
		});

		it('does not repeat name or subtitle words in the keywords', () => {
			const taken = new Set([...words(field('name')), ...words(field('subtitle'))]);
			const repeated = field('keywords')
				.toLowerCase()
				.split(',')
				.filter((keyword) => taken.has(keyword));
			expect(repeated).toEqual([]);
		});
	});

	describe.each(dirs(IOS_SCREENSHOTS))('%s screenshots', (locale) => {
		it('pairs every iPhone screenshot with an iPad one', () => {
			const files = fs.readdirSync(path.join(IOS_SCREENSHOTS, locale));
			const iphone = files.filter((f) => f.endsWith('_iphone67.png')).length;
			const ipad = files.filter((f) => f.endsWith('_ipadPro129.png')).length;
			expect(iphone).toBeGreaterThan(0);
			expect(iphone).toBeLessThanOrEqual(10);
			expect(ipad).toBe(iphone);
		});
	});
});

describe('Google Play listing', () => {
	describe.each(dirs(PLAY_METADATA))('%s', (locale) => {
		const field = (name: string) => read(PLAY_METADATA, locale, `${name}.txt`);

		it('stays within the field limits', () => {
			expect(chars(field('title'))).toBeLessThanOrEqual(30);
			expect(chars(field('short_description'))).toBeLessThanOrEqual(80);
			expect(chars(field('full_description'))).toBeLessThanOrEqual(4000);
		});

		it('has 4 to 8 phone screenshots', () => {
			// Fewer than 4 (at 1080px or more) drops the app out of Play's recommendation formats.
			const shots = fs
				.readdirSync(path.join(PLAY_METADATA, locale, 'images/phoneScreenshots'))
				.filter((f) => f.endsWith('.png'));
			expect(shots.length).toBeGreaterThanOrEqual(4);
			expect(shots.length).toBeLessThanOrEqual(8);
		});

		it('has a 1024x500 feature graphic without alpha', () => {
			// Play rejects any other size and any PNG with an alpha channel.
			const png = fs.readFileSync(path.join(PLAY_METADATA, locale, 'images/featureGraphic.png'));
			expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1024, 500]);
			expect(png[25]).toBe(2); // IHDR colour type 2 = truecolour RGB
		});
	});
});
