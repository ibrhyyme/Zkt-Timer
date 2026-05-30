#!/usr/bin/env node
// Downloads circle-flag SVGs and writes an inline-SVG TS module for the
// language switcher.
//
// Why inline SVG instead of react-circle-flags' external <img>:
//   - The Android Capacitor WebView does not reliably render an external SVG
//     loaded via <img> (iOS WKWebView does — that's why flags only broke on
//     Android). Inlining real <svg> nodes fixes it everywhere.
//   - Works fully offline (PWA service worker + native app), no third-party
//     CDN request, no CSP connect-src widening, no extra latency.
//
// Run on a machine WITH network access:
//   node scripts/generate-flag-icons.mjs
// then commit the regenerated client/.../flag-icons.generated.tsx.
//
// Source assets: react-circle-flags CDN (flags are MIT-licensed).

import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// Flag artwork is HatScripts/circle-flags (MIT). Try several mirrors in order
// because some networks reset pages.dev (e.g. TR ISP blocking); jsDelivr and
// github.io are reliably reachable and serve the identical SVGs.
const SOURCES = [
	(code) => `https://cdn.jsdelivr.net/gh/HatScripts/circle-flags/flags/${code}.svg`,
	(code) => `https://hatscripts.github.io/circle-flags/flags/${code}.svg`,
	(code) => `https://react-circle-flags.pages.dev/${code}.svg`,
];

// i18n language flag codes (ISO country code used for the flag artwork).
// en -> us (global preference), zh -> cn. Keep in sync with LANG_OPTIONS
// in client/components/common/language_switcher/LanguageSwitcher.tsx.
const CODES = ['tr', 'us', 'es', 'ru', 'cn'];

const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(
	dir,
	'../client/components/common/language_switcher/flag-icons.generated.tsx'
);

// Rewrite every internal id to be flag-unique so a <mask>/<clipPath>/<lineargradient>
// id from one flag never bleeds into another when several flags are inlined in
// the same document at once (dropdown shows all five plus the trigger).
function namespaceIds(svg, prefix) {
	const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
	for (const id of new Set(ids)) {
		const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const ns = `${prefix}-${id}`;
		svg = svg
			.replace(new RegExp(`id="${esc}"`, 'g'), `id="${ns}"`)
			.replace(new RegExp(`url\\(\\s*['"]?#${esc}['"]?\\s*\\)`, 'g'), `url(#${ns})`)
			.replace(new RegExp(`(xlink:href|href)="#${esc}"`, 'g'), `$1="#${ns}"`);
	}
	return svg;
}

// Strip XML prolog/comments and force the root <svg> to fill its container so
// the wrapper (fixed px size + circular clip) controls the rendered size.
function normalize(svg) {
	svg = svg
		.replace(/<\?xml[\s\S]*?\?>/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
		.trim();
	return svg.replace(/<svg([^>]*)>/, (_match, attrs) => {
		const cleaned = attrs.replace(/\s(width|height)="[^"]*"/g, '');
		return `<svg${cleaned} width="100%" height="100%">`;
	});
}

// Try each mirror until one returns the SVG; report all failures otherwise.
async function fetchFlag(code) {
	const errors = [];
	for (const src of SOURCES) {
		const url = src(code);
		try {
			const res = await fetch(url);
			if (!res.ok) {
				errors.push(`${url} -> HTTP ${res.status}`);
				continue;
			}
			console.log(`  ${code}: ${url}`);
			return await res.text();
		} catch (e) {
			errors.push(`${url} -> ${e?.cause?.code || e?.message || e}`);
		}
	}
	throw new Error(`Could not fetch ${code}.svg from any mirror:\n  ${errors.join('\n  ')}`);
}

const flags = {};
for (const code of CODES) {
	flags[code] = namespaceIds(normalize(await fetchFlag(code)), code);
}

const file = `// AUTO-GENERATED — DO NOT EDIT BY HAND.
// Regenerate with: node scripts/generate-flag-icons.mjs
//
// Flags are inlined as real <svg> (not an external <img>) so the Android
// Capacitor WebView renders them reliably and they work fully offline
// (PWA + native app). Source assets: react-circle-flags (MIT).
import React from 'react';

export type FlagCode = ${CODES.map((c) => `'${c}'`).join(' | ')};

const FLAG_SVG: Record<FlagCode, string> = {
${CODES.map((c) => `\t${c}: ${JSON.stringify(flags[c])},`).join('\n')}
};

export function FlagSvg({ code }: { code: FlagCode }) {
\treturn (
\t\t<span
\t\t\taria-hidden="true"
\t\t\tstyle={{ display: 'block', width: '100%', height: '100%', lineHeight: 0 }}
\t\t\tdangerouslySetInnerHTML={{ __html: FLAG_SVG[code] }}
\t\t/>
\t);
}
`;

writeFileSync(OUT, file);
console.log(`Wrote ${path.relative(process.cwd(), OUT)} (${CODES.join(', ')})`);
