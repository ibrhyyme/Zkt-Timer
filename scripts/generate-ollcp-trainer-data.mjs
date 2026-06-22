/**
 * Generate OLLCP trainer data JSON for the in-app OLLCP recognition mode.
 *
 * Reuses the proven logic from Referans/ollcp-reco/generate-ollcp-recognition.mjs but emits
 * structured data (recognition cues + priority + 21-char LL patterns + REAL Kociemba scrambles)
 * instead of a standalone HTML page.
 *
 * Output: public/trainer/ollcp-recognition.json
 *   { "<ollNum>": {
 *       shape: 21-char LL pattern (orientation diagram),
 *       checkList: ["<what to look at>", ...],
 *       variants: [{ n:"#1", algorithm, pattern (21-char), moves, prioTier:1|2|3, prioLabel,
 *                    checks:[{text, on}] }, ...],
 *       scrambles: [{ s:"<real scramble>", v:<variant 1..6> }, ...]   // pooled across the 6
 *   }, ... }
 *
 * Usage (from repo root): node scripts/generate-ollcp-trainer-data.mjs
 */
import {readFileSync, writeFileSync} from 'fs';
import {createRequire} from 'module';
import {cube3x3x3} from 'cubing/puzzles';
import {Alg} from 'cubing/alg';

const require = createRequire(import.meta.url);
const Cube = require('cubejs'); // Kociemba two-phase solver (build-time scramble generation)

// ─── Scramble generation helpers ───
const AUF = ['', 'U', 'U2', "U'"];
const EPLL = ['', "M2 U M U2 M' U M2", "M2 U' M U2 M' U' M2", 'M2 U M2 U2 M2 U M2'];
const invMove = (m) => m.endsWith("'") ? m.slice(0, -1) : m.endsWith('2') ? m : m + "'";
const invSolution = (s) => s.trim().split(/\s+/).reverse().map(invMove).join(' ');
const invSolutionClean = (sol) => invSolution(sol).replace(/\s+/g, ' ').trim();
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

// ─── Reid ordering (ported from pattern_utils.ts) ───
const REID_EDGE_ORDER = 'UF UR UB UL DF DR DB DL FR FL BR BL'.split(' ');
const REID_CORNER_ORDER = 'UFR URB UBL ULF DRF DFL DLB DBR'.split(' ');
const REID_CENTER_ORDER = 'U L F R B D'.split(' ');
const REID_TO_FACELETS_MAP = [
	[1,2,0],[0,2,0],[1,1,0],[0,3,0],[2,0,0],[0,1,0],[1,3,0],[0,0,0],[1,0,0],[1,0,2],[0,1,1],[1,1,1],
	[0,8,1],[2,3,0],[0,10,1],[1,4,1],[0,5,1],[1,7,2],[1,3,2],[0,0,1],[1,0,1],[0,9,0],[2,2,0],[0,8,0],
	[1,5,1],[0,4,1],[1,4,2],[1,5,0],[0,4,0],[1,4,0],[0,7,0],[2,5,0],[0,5,0],[1,6,0],[0,6,0],[1,7,0],
	[1,2,2],[0,3,1],[1,3,1],[0,11,1],[2,1,0],[0,9,1],[1,6,1],[0,7,1],[1,5,2],[1,1,2],[0,2,1],[1,2,1],
	[0,10,0],[2,4,0],[0,11,0],[1,7,1],[0,6,1],[1,6,2],
];
const LL_FACELET_INDICES = [0,1,2,3,4,5,6,7,8, 18,19,20, 11,10,9, 47,46,45, 36,37,38];

function rotateLeft(s, i) { return s.slice(i) + s.slice(0, i); }
function patternToFacelets(pattern) {
	const output = [[], []];
	for (let i = 0; i < 12; i++) output[0].push(rotateLeft(REID_EDGE_ORDER[pattern.patternData['EDGES'].pieces[i]], pattern.patternData['EDGES'].orientation[i]));
	for (let i = 0; i < 8; i++) output[1].push(rotateLeft(REID_CORNER_ORDER[pattern.patternData['CORNERS'].pieces[i]], pattern.patternData['CORNERS'].orientation[i]));
	output.push(REID_CENTER_ORDER);
	return REID_TO_FACELETS_MAP.map(([orbit, perm, ori]) => output[orbit][perm][ori]).join('');
}
function expandNotation(input) {
	let o = input.replace(/["´`']/g, "'").replace(/\[/g,'(').replace(/\]/g,')').replace(/XYZ/g,'xyz');
	o = o.replace(/[^RLFBUDMESrlfbudxyz2()']/g,'').replace(/\(/g,' (').replace(/\)(?!\s)/g,') ').replace(/'(?![\s)])/g,"' ").replace(/2(?![\s')])/g,'2 ').replace(/([RLFBUDMESrlfbudxyz])(?![\s)'2])/g,'$1 ').replace(/(\s)(?=2)/g,'').replace(/'2/g,"2'").replace(/\s+/g,' ');
	return o.trim();
}
function cleanAlgorithm(alg) {
	let s = alg.replace(/\+/g,' ').replace(/’/g,"'").replace(/["“”]/g,"'").replace(/'2/g,"2'");
	s = s.replace(/([RLFBUD])w/g,(_,m)=>m.toLowerCase());
	s = s.replace(/\(([RLFBUDMESrlfbudxyz][2']?)\)/g,'$1');
	return expandNotation(s);
}

// ─── Recognition cue logic (pure relational, color-free) ───
const NAMES = {
	9:'ön-sol köşe', 11:'ön-sağ köşe', 10:'ön kenar',
	12:'sağ-üst köşe', 14:'sağ-alt köşe', 13:'sağ kenar',
	15:'arka-sol köşe', 17:'arka-sağ köşe', 16:'arka kenar',
	18:'sol-üst köşe', 20:'sol-alt köşe', 19:'sol kenar',
	0:'üst sol-arka', 2:'üst sağ-arka', 6:'üst sol-ön', 8:'üst sağ-ön',
};
// CORNER stickers only (8 side corners + 4 top corners). Edges are excluded: they change with the
// leftover EPLL (not part of the OLLCP case identity), so edge-based cues would be unreliable.
// Verified: corner-only distinguishes all 6 variants in every OLL.
const POS = [9, 11, 12, 14, 15, 17, 18, 20, 0, 2, 6, 8];
const FACE = {Ön:[9, 11], Sağ:[12, 14], Arka:[15, 17], Sol:[18, 20]};
const PIECES = [[8, 11, 14], [6, 9, 20], [2, 12, 15], [0, 17, 18]];
const samePiece = (a, b) => PIECES.some(t => t.includes(a) && t.includes(b));
const faceOf = (i) => Object.keys(FACE).find(f => FACE[f].includes(i)) || null;

const FEATURES = [];
for (let x = 0; x < POS.length; x++) for (let y = x + 1; y < POS.length; y++) {
	const a = POS[x], b = POS[y];
	if (samePiece(a, b)) continue;
	const fa = faceOf(a), fb = faceOf(b);
	let score;
	if (fa && fa === fb) score = 0;
	else if ([0, 2, 6, 8].includes(a) && [0, 2, 6, 8].includes(b)) score = 1;
	else if (fa && fb) score = 2;
	else score = 3;
	FEATURES.push({a, b, score});
}
FEATURES.sort((p, q) => p.score - q.score);

function pickDiscriminators(patterns) {
	let sig = patterns.map(() => '');
	const chosen = [];
	for (let iter = 0; iter < 6 && new Set(sig).size < patterns.length; iter++) {
		let best = null, bestGain = -1;
		for (const f of FEATURES) {
			const ns = patterns.map((p, i) => sig[i] + (p[f.a] === p[f.b] ? '1' : '0'));
			const gain = new Set(ns).size;
			if (gain > bestGain) { bestGain = gain; best = f; }
		}
		chosen.push(best);
		sig = patterns.map((p, i) => sig[i] + (p[best.a] === p[best.b] ? '1' : '0'));
	}
	return chosen;
}
function phraseFeature(f, same) {
	const fa = faceOf(f.a), fb = faceOf(f.b);
	// Same face = the face's two corners → "far" (headlights).
	if (fa && fa === fb) return same ? `${fa} far` : `${fa} köşeler ≠`;
	return `${NAMES[f.a]} ${same ? '=' : '≠'} ${NAMES[f.b]}`;
}
function featureLabel(f) {
	const fa = faceOf(f.a), fb = faceOf(f.b);
	if (fa && fa === fb) return `${fa} far?`;
	return `${NAMES[f.a]}–${NAMES[f.b]}?`;
}

// ─── Real scramble generation (build-time, Kociemba) ───
const CANON_CENTERS = JSON.stringify([0, 1, 2, 3, 4, 5]);
function canonicalizeY(T) {
	if (JSON.stringify(T.patternData.CENTERS.pieces) === CANON_CENTERS) return {pat: T, undo: ''};
	for (const [y, undo] of [['y', "y'"], ['y2', 'y2'], ["y'", 'y']]) {
		const P = T.applyAlg(y);
		if (JSON.stringify(P.patternData.CENTERS.pieces) === CANON_CENTERS) return {pat: P, undo};
	}
	return null;
}
function genScrambles(solved, invAlg, count) {
	// No random AUF: the case is delivered at the SAME orientation as its diagram, so the physical
	// cube visually matches the card. Variety comes from the leftover EPLL (edges), not from rotation.
	const combos = [];
	for (const e of EPLL) combos.push({a: '', e});
	shuffle(combos);
	const out = [], seen = new Set();
	for (const {a, e} of combos) {
		let T = e ? solved.applyAlg(e) : solved;
		T = T.applyAlg(invAlg);
		if (a) T = T.applyAlg(a);
		const c = canonicalizeY(T);
		if (!c) continue;
		const facelets = patternToFacelets(c.pat);
		if (seen.has(facelets)) continue;
		seen.add(facelets);
		try {
			let scramble = invSolutionClean(Cube.fromString(facelets).solve());
			if (c.undo) scramble += ' ' + c.undo;
			out.push(scramble);
		} catch { /* skip unsolvable facelet edge-cases */ }
		if (out.length >= count) break;
	}
	return out;
}

const PRIO_LABEL = {1: 'Önce', 2: 'Orta', 3: 'Sonra'};
const countMoves = (alg) => cleanAlgorithm(alg).replace(/[()]/g, '').trim().split(/\s+/).filter(Boolean).length;

async function main() {
	const kpuzzle = await cube3x3x3.kpuzzle();
	const solved = kpuzzle.defaultPattern();
	const data = JSON.parse(readFileSync('public/trainer/default-algs.json', 'utf8'));
	const ollcp = data['OLLCP'];

	console.log('Kociemba initSolver...');
	Cube.initSolver();

	// Plain OLL move counts (priority baseline)
	const ollMoves = {};
	for (const sub of (data['OLL'] || [])) {
		for (const a of sub.algorithms) {
			const num = a.name.replace(/\D/g, '');
			const m = Math.min(countMoves(a.algorithm), ...((a.alternatives || []).map(countMoves)));
			if (ollMoves[num] === undefined || m < ollMoves[num]) ollMoves[num] = m;
		}
	}

	const result = {};
	for (const subset of ollcp) {
		const ollNum = subset.subset.replace(/\D/g, '');
		const om = ollMoves[ollNum];

		const variants = subset.algorithms.map(entry => {
			const clean = cleanAlgorithm(entry.algorithm);
			const inv = Alg.fromString(clean).invert();
			const facelets = patternToFacelets(solved.applyAlg(inv));
			return {entry, inv, pattern: LL_FACELET_INDICES.map(i => facelets[i]).join('')};
		});
		const checks = pickDiscriminators(variants.map(v => v.pattern));

		const scrambles = [];
		const outVariants = variants.map(({entry, inv, pattern}, idx) => {
			const cpm = countMoves(entry.algorithm);
			const delta = om !== undefined ? cpm - om : 0;
			const prioTier = delta <= 1 ? 1 : delta <= 4 ? 2 : 3;
			const v = idx + 1;
			for (const s of genScrambles(solved, inv, 8)) scrambles.push({s, v});
			return {
				n: '#' + v,
				algorithm: entry.algorithm,
				pattern,
				moves: cpm,
				prioTier,
				prioLabel: PRIO_LABEL[prioTier],
				checks: checks.map(f => ({text: phraseFeature(f, pattern[f.a] === pattern[f.b]), on: pattern[f.a] === pattern[f.b]})),
			};
		});
		shuffle(scrambles);

		result[ollNum] = {
			shape: variants[0].pattern,
			checkList: checks.map(featureLabel),
			variants: outVariants,
			scrambles,
		};
	}

	const out = 'public/trainer/ollcp-recognition.json';
	writeFileSync(out, JSON.stringify(result));
	const kb = (readFileSync(out).length / 1024).toFixed(1);
	const totalScr = Object.values(result).reduce((n, o) => n + o.scrambles.length, 0);
	console.log(`Wrote ${out} (${kb} KB, ${Object.keys(result).length} OLLs, ${totalScr} scrambles)`);
}
main().catch(err => { console.error(err); process.exit(1); });
