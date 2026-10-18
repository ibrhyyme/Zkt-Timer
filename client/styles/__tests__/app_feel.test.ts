import fs from 'fs';
import path from 'path';
import { isOutsideViewport } from '../../util/viewport-lock';

// Guard for feedback 2.0: the page itself never rubber-bands, zooms or drifts
// sideways, on any platform. The rules live in a handful of places that a later
// change can quietly undo (a page stylesheet re-declaring html/body, a new HTML
// shell without the viewport meta, the iOS controller losing its bounce switch),
// so each one is pinned here.

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

interface RootRule {
	file: string;
	selectors: string[];
	body: string;
}

/** Flat rules (no nested braces inside) whose selector list names html or body itself. */
function rootRules(file: string, src: string): RootRule[] {
	const out: RootRule[] = [];
	const re = /([^{};]+)\{([^{}]*)\}/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(stripComments(src)))) {
		const selectors = m[1].split(',').map((s) => s.trim());
		if (selectors.some((s) => s === 'html' || s === 'body')) {
			out.push({ file, selectors, body: m[2] });
		}
	}
	return out;
}

function decl(body: string, prop: string): string | null {
	const m = body.match(new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+)`));
	return m ? m[1].trim() : null;
}

function scssFiles(dir: string): string[] {
	const out: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
			out.push(...scssFiles(full));
		} else if (entry.name.endsWith('.scss')) {
			out.push(full);
		}
	}
	return out;
}

describe('app feel: global styles', () => {
	const index = stripComments(read('client/styles/index.scss'));
	const rules = rootRules('client/styles/index.scss', index);

	it('turns off the root bounce on html and body', () => {
		const rule = rules.find((r) => r.selectors.includes('html') && r.selectors.includes('body') && decl(r.body, 'overscroll-behavior'));
		expect(rule).toBeDefined();
		expect(decl(rule!.body, 'overscroll-behavior')).toBe('none');
	});

	it('disables double-tap zoom with a low-specificity touch-action', () => {
		const html = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === 'html' && decl(r.body, 'touch-action'));
		expect(html && decl(html.body, 'touch-action')).toBe('manipulation');
		// `:where` keeps specificity at zero so components that set their own
		// touch-action (start surfaces, drag handles) still win.
		expect(index).toMatch(/:where\(body \*\)\s*\{\s*touch-action:\s*manipulation;?\s*\}/);
	});

	it('clips sideways overflow on body without making it a scroll container', () => {
		const body = rules.find((r) => r.selectors.length === 1 && r.selectors[0] === 'body' && decl(r.body, 'overflow-x'));
		// `hidden` would turn body into a scroller and break position: sticky everywhere.
		expect(body && decl(body.body, 'overflow-x')).toBe('clip');
	});

	it('no other stylesheet re-declares the root scroll behaviour', () => {
		const offenders: string[] = [];
		for (const file of scssFiles(path.join(ROOT, 'client'))) {
			const rel = path.relative(ROOT, file).replace(/\\/g, '/');
			if (rel === 'client/styles/index.scss') continue;
			for (const rule of rootRules(rel, fs.readFileSync(file, 'utf8'))) {
				for (const prop of ['overscroll-behavior', 'overscroll-behavior-y', 'overscroll-behavior-x', 'overflow-x', 'touch-action']) {
					const value = decl(rule.body, prop);
					// Repeating `none` (reset.scss does) agrees with index.scss; anything
					// else competes with it and the bundle order would pick the winner.
					if (value === null || (prop.startsWith('overscroll') && value === 'none')) continue;
					offenders.push(`${rel}: ${rule.selectors.join(', ')} { ${prop}: ${value} }`);
				}
			}
		}
		expect(offenders).toEqual([]);
	});
});

describe('app feel: viewport meta in every HTML shell', () => {
	// The SSR shell (web) and the generated native bundle shell (Capacitor) both
	// need it: it is what stops pinch zoom on Android and in the iOS WebView.
	for (const rel of ['server/html_template.ts', 'build-native-bundle.js']) {
		it(rel, () => {
			const meta = read(rel).match(/<meta name="viewport" content="([^"]+)"/);
			expect(meta).not.toBeNull();
			const content = meta![1].replace(/\s+/g, '');
			expect(content).toMatch(/maximum-scale=1(\.0)?(,|$)/);
			expect(content).toContain('user-scalable=no');
			expect(content).toContain('width=device-width');
		});
	}
});

describe('app feel: iOS native shell', () => {
	it('switches off the document scroll view bounce (WebKit ignores overscroll-behavior before iOS 16)', () => {
		const swift = read('ios/App/App/ZKTBridgeViewController.swift');
		expect(swift).toMatch(/webView\?\.scrollView\.bounces\s*=\s*false/);
	});
});

describe('isOutsideViewport (dev overflow detector rule)', () => {
	it('accepts a box inside the viewport', () => {
		expect(isOutsideViewport({ left: 0, right: 390 }, 390)).toBe(false);
	});

	it('allows 1px of sub-pixel rounding on either side', () => {
		expect(isOutsideViewport({ left: -0.5, right: 390.6 }, 390)).toBe(false);
	});

	it('flags a box wider than the screen on the right', () => {
		expect(isOutsideViewport({ left: 0, right: 412 }, 390)).toBe(true);
	});

	it('flags a box pushed off the left edge', () => {
		expect(isOutsideViewport({ left: -24, right: 300 }, 390)).toBe(true);
	});
});
