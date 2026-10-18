// The calibration page's pure view rules (design 5.7, 6.5) and the translation coverage of
// every key the page uses, in all five languages.
import fs from 'fs';
import path from 'path';
import type { CalibrationProgress } from '../../../../util/magnet-start/calibration';
import {
	barFill,
	CAL_NS,
	calibrateLink,
	canRetry,
	failureKey,
	hintKey,
	measureBarScale,
	parseCalibrateLink,
	resultBar,
	stepBodyKey,
	stepNumber,
	stepTitleKey,
	sweepRing,
} from '../calibration_view';

function progress(partial: Partial<CalibrationProgress>): CalibrationProgress {
	return {
		step: 'steady',
		steady: false,
		cubeAway: null,
		canStart: false,
		live: null,
		peak: null,
		rest: null,
		sweepMs: 0,
		canFinish: false,
		settled: false,
		holdMs: 0,
		issue: null,
		noisy: false,
		rateHz: 100,
		failure: null,
		...partial,
	};
}

describe('calibration view', () => {
	it('numbers the three steps, the away check belongs to step 3', () => {
		expect(stepNumber('steady')).toBe(1);
		expect(stepNumber('sweep')).toBe(2);
		expect(stepNumber('rest')).toBe(3);
		expect(stepNumber('away')).toBe(3);
		expect(stepNumber('done')).toBeNull();
		expect(stepNumber('failed')).toBeNull();
	});

	it('the step issue comes before everything else', () => {
		expect(hintKey(progress({ issue: 'noisy', rateHz: null }))).toBe(`${CAL_NS}.issue_noisy`);
		expect(hintKey(progress({ issue: 'moving' }))).toBe(`${CAL_NS}.issue_moving`);
		expect(hintKey(progress({ step: 'sweep', issue: 'no_sweep' }))).toBe(`${CAL_NS}.issue_no_sweep`);
		expect(hintKey(progress({ step: 'away', issue: 'not_back' }))).toBe(`${CAL_NS}.issue_not_back`);
	});

	it('step 1 waits for the sensor, then asks for the cube to go away when the baseline says so', () => {
		expect(hintKey(progress({ rateHz: null }))).toBe(`${CAL_NS}.waiting_sensor`);
		expect(hintKey(progress({ steady: true, cubeAway: false }))).toBe(`${CAL_NS}.issue_cube_near`);
		// Not steady yet: the plateau is not judged, nothing to say.
		expect(hintKey(progress({ steady: false, cubeAway: false }))).toBeNull();
		expect(hintKey(progress({ steady: true, cubeAway: true }))).toBeNull();
		// Unknown baseline: no claim about the cube.
		expect(hintKey(progress({ steady: true, cubeAway: null }))).toBeNull();
		// Later steps do not repeat step 1's hints.
		expect(hintKey(progress({ step: 'sweep', rateHz: null }))).toBeNull();
	});

	it('maps every failure to its sentence; only a slow sensor cannot be tried again', () => {
		expect(failureKey('rate')).toBe(`${CAL_NS}.fail_rate`);
		expect(failureKey('too_weak')).toBe(`${CAL_NS}.fail_too_weak`);
		expect(failureKey('phone_moved')).toBe(`${CAL_NS}.fail_phone_moved`);
		expect(failureKey('timeout')).toBe(`${CAL_NS}.fail_timeout`);
		expect(failureKey('short')).toBe(`${CAL_NS}.fail_short`);
		expect(failureKey(null)).toBe(`${CAL_NS}.fail_short`);
		expect(canRetry('rate')).toBe(false);
		for (const r of ['too_weak', 'phone_moved', 'timeout', 'short', null] as const) expect(canRetry(r)).toBe(true);
	});

	it('the live bar scale stays above the highest value and above the floor', () => {
		expect(measureBarScale(null, null)).toBe(100);
		expect(measureBarScale(null, 40)).toBe(100);
		expect(measureBarScale(500, 200)).toBeCloseTo(550);
		expect(measureBarScale(300, 400)).toBeCloseTo(440);
		expect(barFill(550, 550)).toBe(1);
		expect(barFill(900, 550)).toBe(1);
		expect(barFill(-5, 550)).toBe(0);
		expect(barFill(null, 550)).toBe(0);
		expect(barFill(10, 0)).toBe(0);
	});

	it('the result bar follows the live bar scale of the timer: the resting cube near 80 %', () => {
		// Typical 3x3: R 480, ready line 150.
		const typical = resultBar({ rest_ut: 480, near_min_ut: 150 });
		expect(typical.fill).toBeCloseTo(0.8);
		expect(typical.line).toBeCloseTo(150 / 600);
		// Weak cube: R 200, line 70; 1.25 R = 250 > 2 x 70.
		const weak = resultBar({ rest_ut: 200, near_min_ut: 70 });
		expect(weak.fill).toBeCloseTo(0.8);
		expect(weak.line).toBeCloseTo(70 / 250);
		// The line is always under the fill: a saved calibration is ready where it rests.
		expect(weak.line).toBeLessThan(weak.fill);
	});

	it('the sweep ring runs toward the automatic end', () => {
		expect(sweepRing(0, 20000)).toBe(0);
		expect(sweepRing(10000, 20000)).toBe(0.5);
		expect(sweepRing(30000, 20000)).toBe(1);
		expect(sweepRing(100, 0)).toBe(0);
	});

	it('builds and reads the page link', () => {
		const link = calibrateLink('abc-123');
		expect(link).toBe('/magnet/calibrate?cube=abc-123');
		expect(parseCalibrateLink(link.slice(link.indexOf('?')))).toEqual({ cubeId: 'abc-123' });
		expect(parseCalibrateLink('?cube=')).toEqual({ cubeId: null });
		expect(parseCalibrateLink('')).toEqual({ cubeId: null });
		expect(parseCalibrateLink(null)).toEqual({ cubeId: null });
	});
});

describe('calibration page translations', () => {
	const localesDir = path.join(__dirname, '../../../../i18n/locales');
	const languages = ['tr', 'en', 'es', 'ru', 'zh'];
	const dir = path.join(__dirname, '..');

	/** Every `${CAL_NS}.key` used in the page's files, plus the keys the view module returns. */
	function usedKeys(): string[] {
		const keys = new Set<string>();
		for (const file of fs.readdirSync(dir)) {
			if (!/\.tsx?$/.test(file)) continue;
			const src = fs.readFileSync(path.join(dir, file), 'utf8');
			for (const m of src.matchAll(/\$\{CAL_NS\}\.([a-z_]+)/g)) keys.add(m[1]);
		}
		return Array.from(keys).sort();
	}

	const fromView = [
		...(['steady', 'sweep', 'rest', 'away', 'done', 'failed'] as const).map(stepTitleKey),
		...(['steady', 'sweep', 'rest', 'away'] as const).map((s) => stepBodyKey(s) as string),
	].map((k) => k.slice(CAL_NS.length + 1));

	it.each(languages)('%s has every key of the page, without em dashes', (lang) => {
		const json = JSON.parse(fs.readFileSync(path.join(localesDir, lang, 'translation.json'), 'utf8'));
		const ns = json[CAL_NS];
		expect(ns).toBeTruthy();
		const keys = Array.from(new Set([...usedKeys(), ...fromView]));
		expect(keys.length).toBeGreaterThan(30);
		for (const key of keys) {
			expect([lang, key, typeof ns[key]]).toEqual([lang, key, 'string']);
			expect(ns[key]).not.toMatch(/—/);
		}
		// Same key set in every language.
		const tr = JSON.parse(fs.readFileSync(path.join(localesDir, 'tr', 'translation.json'), 'utf8'))[CAL_NS];
		expect(Object.keys(ns).sort()).toEqual(Object.keys(tr).sort());
	});
});
