/**
 * cubingapp (spencerchubb/cubingapp) algoritma verilerini
 * Zkt-Timer default-algs.json formatina donusturur.
 *
 * Kullanim: node scripts/convert-cubingapp-algs.mjs
 *
 * 1. cubingapp reposundan JSON dosyalarini indirir
 * 2. Her dosya icin ilk (en populer) algoritmmayi secer
 * 3. Mevcut default-algs.json'daki cubingapp'te olmayan kategorileri korur
 * 4. Sonucu public/trainer/default-algs.json olarak yazar
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT = join(ROOT, 'public', 'trainer', 'default-algs.json');
const EXISTING = existsSync(OUTPUT) ? JSON.parse(readFileSync(OUTPUT, 'utf-8')) : {};

const BASE_URL = 'https://raw.githubusercontent.com/spencerchubb/cubingapp/main/alg-codegen/algs';

// cubingapp dosyasi → Zkt-Timer kategori adi
const FILE_MAP = {
	// 3x3
	'PLL.json': 'PLL',
	'OLL.json': 'OLL',
	'F2L.json': 'F2L',
	'ZBLL.json': 'ZBLL',
	'COLL.json': 'COLL',
	'CMLL.json': 'CMLL',
	'OLLCP.json': 'OLLCP',
	'Winter-Variation.json': 'WVLS',
	'2-Look-OLL.json': '2-Look OLL',
	'2-Look-PLL.json': '2-Look PLL',
	'LSE-EO.json': 'L6E-EO',
	'LSE-EOLR.json': 'L6E-EOLR',
	'2-Look-CMLL.json': '2-Look CMLL',
	'OH-CMLL.json': 'OH-CMLL',
	// 2x2
	'2x2-CLL.json': '2x2 CLL',
	'2x2-EG1.json': '2x2 EG1',
	'2x2-EG2.json': '2x2 EG2',
	'2x2-PBL.json': '2x2 PBL',
	// 4x4
	'4x4-PLL-Parity.json': '4x4 PLL Parity',
	// Pyraminx
	'Pyraminx-Last-Layer.json': 'Pyraminx LL',
	'Pyraminx-L4E.json': 'Pyraminx L4E',
	// Skewb
	'Sarah-Intermediate.json': 'Sarah Intermediate',
	'Sarah-Advanced.json': 'Sarah Advanced',
	// Square-1
	'SQ1-Cube-Shape.json': 'SQ1 Cube Shape',
	'SQ1-CP.json': 'SQ1 CP',
	'SQ1-CSP.json': 'SQ1 CSP',
	'SQ1-EO.json': 'SQ1 EO',
	'SQ1-EP.json': 'SQ1 EP',
	'SQ1-OBL.json': 'SQ1 OBL',
};

// Kategori sirasi (dropdown'da bu sirada gorunecek)
const CATEGORY_ORDER = [
	// 3x3
	'PLL', 'OLL', 'F2L', '2-Look PLL', '2-Look OLL',
	'COLL', 'OLLCP', 'ZBLL', 'CMLL', '2-Look CMLL', 'OH-CMLL',
	'WVLS', 'L6E-EO', 'L6E-EOLR',
	// 2x2
	'2x2 CLL', '2x2 EG1', '2x2 EG2', '2x2 PBL',
	// 4x4
	'4x4 PLL Parity',
	// Pyraminx
	'Pyraminx LL', 'Pyraminx L4E',
	// Skewb
	'Sarah Intermediate', 'Sarah Advanced',
	// Square-1
	'SQ1 Cube Shape', 'SQ1 CP', 'SQ1 CSP', 'SQ1 EO', 'SQ1 EP', 'SQ1 OBL',
];

/**
 * cubingapp JSON → Zkt-Timer AlgorithmSubset[] formatina donustur
 */
function convertFile(data, categoryName) {
	const cases = data.cases || {};
	const subsetOrder = data.subsets || [];

	// Subset'lere gore gruplama
	const subsetMap = {};

	for (const [caseName, caseData] of Object.entries(cases)) {
		const subset = caseData.subset || 'Default';
		if (!subsetMap[subset]) subsetMap[subset] = [];

		const algs = caseData.algs || {};
		const allAlgs = Object.keys(algs);

		if (allAlgs.length > 0) {
			const entry = {
				name: caseName,
				algorithm: allAlgs[0],
			};

			// Geri kalan alternatifleri ekle
			if (allAlgs.length > 1) {
				entry.alternatives = allAlgs.slice(1);
			}

			subsetMap[subset].push(entry);
		}
	}

	// Subset sirasini koru (cubingapp'teki siraya gore)
	const orderedSubsets = subsetOrder.length > 0
		? subsetOrder
		: Object.keys(subsetMap);

	return orderedSubsets
		.filter((s) => subsetMap[s] && subsetMap[s].length > 0)
		.map((subset) => ({
			subset,
			algorithms: subsetMap[subset],
		}));
}

async function fetchJSON(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
	return res.json();
}

async function main() {
	const result = {};
	const errors = [];

	console.log('cubingapp algoritma verilerini indiriliyor...\n');

	for (const [filename, categoryName] of Object.entries(FILE_MAP)) {
		const url = `${BASE_URL}/${filename}`;
		try {
			process.stdout.write(`  ${categoryName} (${filename})... `);
			const data = await fetchJSON(url);
			const converted = convertFile(data, categoryName);

			const algCount = converted.reduce((sum, s) => sum + s.algorithms.length, 0);
			result[categoryName] = converted;
			console.log(`${algCount} algoritma, ${converted.length} subset`);
		} catch (err) {
			errors.push({ filename, categoryName, error: err.message });
			console.log(`HATA: ${err.message}`);
		}
	}

	// Mevcut default-algs.json'daki cubingapp'te olmayan kategorileri koru
	for (const [category, subsets] of Object.entries(EXISTING)) {
		if (!result[category]) {
			result[category] = subsets;
			console.log(`  ${category} — mevcut veriden korundu`);
		}
	}

	// Sirala
	const ordered = {};
	for (const cat of CATEGORY_ORDER) {
		if (result[cat]) ordered[cat] = result[cat];
	}
	// Siralamada olmayan kategorileri sona ekle
	for (const [cat, data] of Object.entries(result)) {
		if (!ordered[cat]) ordered[cat] = data;
	}

	writeFileSync(OUTPUT, JSON.stringify(ordered, null, 2), 'utf-8');

	const totalAlgs = Object.values(ordered)
		.flat()
		.reduce((sum, s) => sum + s.algorithms.length, 0);
	const totalCats = Object.keys(ordered).length;

	console.log(`\nToplam: ${totalCats} kategori, ${totalAlgs} algoritma`);
	console.log(`Yazildi: ${OUTPUT}`);

	if (errors.length > 0) {
		console.log('\nHatalar:');
		for (const e of errors) {
			console.log(`  - ${e.categoryName}: ${e.error}`);
		}
	}

	console.log('\nSonraki adim: node scripts/generate-ll-patterns.mjs');
}

main().catch(console.error);
