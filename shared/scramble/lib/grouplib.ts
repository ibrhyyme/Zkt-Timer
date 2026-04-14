/**
 * grouplib.ts — Full port of cstimer's grouplib.js
 * Schreier-Sims algorithm, canonical sequence generator, and subgroup solver
 * for permutation groups. Used by scramble generators for subset scrambles
 * (half turns, 2-gen, roux, etc.) and FTO/diamond solvers.
 *
 * Ported from cstimer (GPLv3) — https://github.com/cs0x7f/cstimer
 */

import { rn } from '../lib/mathlib';

// ==================== Permutation Utilities ====================

export function permMult(permA: number[], permB: number[]): number[] {
	const ret: number[] = [];
	for (let i = 0; i < permA.length; i++) {
		ret[i] = permB[permA[i]];
	}
	return ret;
}

export function permInv(perm: number[]): number[] {
	const ret: number[] = [];
	for (let i = 0; i < perm.length; i++) {
		ret[perm[i]] = i;
	}
	return ret;
}

export function permCmp(perm1: number[], perm2: number[]): number {
	if (perm1.length !== perm2.length) {
		return perm1.length - perm2.length;
	}
	for (let i = perm1.length - 1; i >= 0; i--) {
		if (perm1[i] !== perm2[i]) {
			return perm1[i] - perm2[i];
		}
	}
	return 0;
}

// ==================== SchreierSims ====================

export class SchreierSims {
	sgs: (number[] | undefined)[][];
	sgsi: (number[] | undefined)[][];
	t2i: number[][];
	i2t: number[][];
	keyIdx: number[];
	Tk: number[][][];
	e: number[];

	constructor(gen: number[][] | SchreierSims, shuffle?: number[]) {
		if (gen instanceof SchreierSims) {
			this.sgs = [];
			this.sgsi = [];
			this.t2i = [];
			this.i2t = [];
			this.keyIdx = [];
			this.Tk = [];
			this.e = [];
			this.copy(gen);
			return;
		}

		// Check if gen is actually a SchreierSims-like object (duck typing for copy)
		if ((gen as any).sgs) {
			this.sgs = [];
			this.sgsi = [];
			this.t2i = [];
			this.i2t = [];
			this.keyIdx = [];
			this.Tk = [];
			this.e = [];
			this.copy(gen as any as SchreierSims);
			return;
		}

		this.sgs = [];
		this.sgsi = [];
		this.t2i = [];
		this.i2t = [];
		this.keyIdx = [];
		this.Tk = [];
		this.e = [];

		const n = gen[0].length;
		for (let i = 0; i < n; i++) {
			this.e[i] = i;
		}
		for (let i = 0; i < n; i++) {
			this.sgs.push([]);
			this.sgsi.push([]);
			this.t2i.push([]);
			this.i2t.push([i]);
			this.Tk.push([]);
			this.sgs[i][i] = this.e;
			this.sgsi[i][i] = this.e;
			this.t2i[i][i] = 0;
		}
		this.extend(gen, shuffle);
	}

	extend(gen: number[][], shuffle?: number[]): void {
		for (let i = 0; i < gen.length; i++) {
			let g = gen[i];
			if (shuffle) {
				g = permMult(permMult(permInv(shuffle), g), shuffle);
			}
			if (this.isMember(g) < 0) {
				this.knutha(this.e.length - 1, g);
			}
		}
	}

	copy(obj: SchreierSims): void {
		this.sgs = [];
		this.sgsi = [];
		this.t2i = [];
		this.i2t = [];
		this.keyIdx = obj.keyIdx.slice();
		this.Tk = [];
		this.e = obj.e;
		const n = this.e.length;
		for (let i = 0; i < n; i++) {
			this.sgs[i] = obj.sgs[i].slice();
			this.sgsi[i] = obj.sgsi[i].slice();
			this.t2i[i] = obj.t2i[i].slice();
			this.i2t[i] = obj.i2t[i].slice();
			this.Tk[i] = obj.Tk[i].slice();
		}
	}

	toKeyIdx(perm?: number[]): number[] {
		const ret: number[] = [];
		perm = perm || this.e;
		for (let i = 0; i < this.keyIdx.length; i++) {
			ret[i] = perm[this.keyIdx[i]];
		}
		return ret;
	}

	isMember(p: number[], depth?: number): number {
		depth = depth || 0;
		let idx = 0;
		const ps: number[][] = [];
		for (let i = p.length - 1; i >= depth; i--) {
			let j = p[i];
			for (let k = 0; k < ps.length; k++) {
				j = ps[k][j];
			}
			if (j !== i) {
				if (!this.sgs[i][j]) {
					return -1;
				}
				ps.push(this.sgsi[i][j]!);
			}
			idx = idx * this.i2t[i].length + this.t2i[i][j];
		}
		return idx;
	}

	isSubgroupMemberByKey(permKey: number[], sgsH: SchreierSims): number {
		let idx = 0;
		const ps: number[][] = [];
		for (let ii = 0; ii < this.keyIdx.length; ii++) {
			const i = this.keyIdx[ii];
			let j = permKey[ii];
			for (let k = 0; k < ps.length; k++) {
				j = ps[k][j];
			}
			if (j !== i) {
				if (!sgsH.sgs[i][j]) {
					return -1;
				}
				ps.push(sgsH.sgsi[i][j]!);
			}
			idx = idx * sgsH.i2t[i].length + sgsH.t2i[i][j];
		}
		return idx;
	}

	knutha(k: number, p: number[]): void {
		this.Tk[k].push(p);
		for (let i = 0; i < this.sgs[k].length; i++) {
			if (this.sgs[k][i]) {
				this.knuthb(k, permMult(this.sgs[k][i]!, p));
			}
		}
	}

	knuthb(k: number, p: number[]): void {
		const j = p[k];
		if (!this.sgs[k][j]) {
			this.sgs[k][j] = p;
			this.sgsi[k][j] = permInv(p);
			this.t2i[k][j] = this.i2t[k].length;
			this.i2t[k].push(j);
			if (this.i2t[k].length === 2) {
				this.keyIdx.push(k);
				this.keyIdx.sort((a, b) => b - a);
			}
			for (let i = 0; i < this.Tk[k].length; i++) {
				this.knuthb(k, permMult(p, this.Tk[k][i]));
			}
			return;
		}
		const p2 = permMult(p, this.sgsi[k][j]!);
		if (this.isMember(p2) < 0) {
			this.knutha(k - 1, p2);
		}
	}

	size(accuracy?: boolean): number | bigint {
		const n = this.sgs.length;
		if (accuracy) {
			let size = BigInt(1);
			for (let j = 0; j < n; j++) {
				size *= BigInt(this.i2t[j].length);
			}
			return size;
		}
		let size = 1;
		for (let j = 0; j < n; j++) {
			size *= this.i2t[j].length;
		}
		return size;
	}

	minElem(p: number[]): number[] {
		let inv = permInv(p);
		for (let ii = 0; ii < this.keyIdx.length; ii++) {
			const i = this.keyIdx[ii];
			let maxi = inv[i];
			let j = i;
			for (let k = 1; k < this.i2t[i].length; k++) {
				const m = this.i2t[i][k];
				if (inv[m] > maxi) {
					maxi = inv[m];
					j = m;
				}
			}
			if (j !== i) {
				inv = permMult(this.sgs[i][j]!, inv);
			}
		}
		return permInv(inv);
	}

	listCoset(subH: SchreierSims): number[][] {
		const cosetReps: number[][] = [this.e.slice()];
		let targetSize = 1;
		out: for (let ii = this.keyIdx.length - 1; ii >= 0; ii--) {
			const i = this.keyIdx[ii];
			if (this.i2t[i].length === subH.i2t[i].length) {
				continue;
			}
			targetSize *= this.i2t[i].length;
			targetSize /= subH.i2t[i].length;
			for (let ci = 0, len = cosetReps.length; ci < len; ci++) {
				const coset = cosetReps[ci];
				expand: for (let jj = 1; jj < this.i2t[i].length; jj++) {
					const j = this.i2t[i][jj];
					const newCoset = permMult(coset, this.sgs[i][j]!);
					for (let ss = 1; ss < subH.i2t[i].length; ss++) {
						if (newCoset[subH.i2t[i][ss]] > j) {
							continue expand;
						}
					}
					cosetReps.push(newCoset);
					if (cosetReps.length >= targetSize) {
						continue out;
					}
				}
			}
		}
		return cosetReps;
	}

	rndElem(): number[] {
		let perm = this.e.slice();
		for (let i = this.e.length - 1; i >= 0; i--) {
			let cnt = 0;
			let p = 0;
			for (let j = 0; j <= i; j++) {
				if (!this.sgs[i][j]) {
					continue;
				}
				if (rn(++cnt) < 1) {
					p = j;
				}
			}
			if (p !== i) {
				perm = permMult(perm, this.sgsi[i][p]!);
			}
		}
		return perm;
	}
}

// ==================== CanonSeqGen ====================

type TrieNode = number[] | null;

export class CanonSeqGen {
	gens: number[][];
	glen: number;
	trieNodes: TrieNode[];
	skipSeqs: number[][];

	constructor(gens: number[][]) {
		this.gens = gens;
		this.glen = gens.length;
		this.trieNodes = [null];
		this.trieNodes.push([]);
		this.skipSeqs = [];
	}

	addSkipSeq(seq: number[]): void {
		this.skipSeqs.push(seq.slice());
		let node = 1;
		for (let i = 0; i < seq.length; i++) {
			let next = ~~(this.trieNodes[node] as number[])[seq[i]];
			if (next === -1) {
				return;
			}
			if (i === seq.length - 1) {
				(this.trieNodes[node] as number[])[seq[i]] = -1;
				break;
			}
			if (next <= 0) {
				next = this.trieNodes.length;
				this.trieNodes.push([]);
				(this.trieNodes[node] as number[])[seq[i]] = next;
				for (let m = 0; m < this.glen; m++) {
					this.updateNext(seq.slice(0, i + 1).concat(m));
				}
			}
			node = next;
		}
	}

	traversalTrie(node: number, seq: number[], callback: (node: number, seq: number[]) => void): void {
		if (node <= 0) {
			return;
		}
		for (let i = 0; i < this.glen; i++) {
			seq.push(i);
			this.traversalTrie(~~(this.trieNodes[node] as number[])[i], seq, callback);
			seq.pop();
		}
		callback(node, seq);
	}

	updateNext(seq: number[]): number {
		let node = 1;
		for (let i = 0; i < seq.length; i++) {
			let next = ~~(this.trieNodes[node] as number[])[seq[i]];
			if (next === 0) {
				next = this.updateNext(seq.slice(1, i + 1));
				next = next > 0 ? ~next : next;
				(this.trieNodes[node] as number[])[seq[i]] = next;
			}
			if (next === -1) {
				return -1;
			} else if (next < 0) {
				next = ~next;
			}
			node = next;
		}
		return node;
	}

	refillNext(): void {
		// clear next nodes
		this.traversalTrie(1, [], (node, seq) => {
			for (let i = 0; i < this.glen; i++) {
				const next = ~~(this.trieNodes[node] as number[])[i];
				if (next !== -1 && next <= node) {
					(this.trieNodes[node] as number[])[i] = 0;
				}
			}
		});
		// calculate next nodes
		this.traversalTrie(1, [], (node, seq) => {
			for (let i = 0; i < this.glen; i++) {
				if ((i & 0x1f) === 0) {
					(this.trieNodes[node] as number[])[this.glen + (i >> 5)] = 0;
				}
				const next = ~~(this.trieNodes[node] as number[])[i];
				if (next !== -1 && next <= node) {
					this.updateNext(seq.concat(i));
				}
				if (~~(this.trieNodes[node] as number[])[i] === -1) {
					(this.trieNodes[node] as number[])[this.glen + (i >> 5)] |= 1 << (i & 0x1f);
				}
			}
		});
	}

	countSeq(depth: number, accuracy?: boolean): (number | bigint)[] {
		const ZERO = accuracy ? BigInt(0) : 0;
		let counts: (number | bigint)[] = accuracy ? [BigInt(0), BigInt(1)] : [0, 1];
		const ret: (number | bigint)[] = accuracy ? [BigInt(0), BigInt(1)] : [1];
		for (let d = 0; d < depth; d++) {
			const newCounts: (number | bigint)[] = [];
			let depthCnt: number | bigint = ZERO;
			for (let node = 1; node < this.trieNodes.length; node++) {
				const curCount = counts[node] || ZERO;
				if (curCount === ZERO) {
					continue;
				}
				for (let i = 0; i < this.glen; i++) {
					const next = ~~(this.trieNodes[node] as number[])[i];
					if (next !== -1) {
						const resolved = next < 0 ? ~next : next;
						newCounts[resolved] = ((newCounts[resolved] || ZERO) as any) + (curCount as any);
						depthCnt = (depthCnt as any) + (curCount as any);
					}
				}
			}
			counts = newCounts;
			ret.push(depthCnt);
		}
		return ret;
	}

	countSeqMove(depth: number, moveTable: number[][], initState: number): (number | number[])[] {
		let counts: number[] = [];
		counts[initState * this.trieNodes.length + 1 - 1] = 1;
		const ret: (number | number[])[] = [];
		for (let d = 0; d < depth; d++) {
			const newCounts: number[] = [];
			const depthCnts: number[] = [];
			let depthCnt = 0;
			for (let state = 0; state < moveTable[0].length; state++) {
				for (let node = 1; node < this.trieNodes.length; node++) {
					const curCount = counts[state * this.trieNodes.length + node - 1] || 0;
					if (curCount === 0) {
						continue;
					}
					for (let i = 0; i < this.glen; i++) {
						const next = ~~(this.trieNodes[node] as number[])[i];
						if (next !== -1) {
							const resolved = next < 0 ? ~next : next;
							const newState = moveTable[i][state];
							const idx = newState * this.trieNodes.length + resolved - 1;
							newCounts[idx] = (newCounts[idx] || 0) + curCount;
							depthCnts[newState] = (depthCnts[newState] || 0) + curCount;
							depthCnt += curCount;
						}
					}
				}
			}
			counts = newCounts;
			ret.push(depthCnts, depthCnt);
		}
		return ret;
	}

	initTrie(depth: number): void {
		this.trieNodes = [null];
		this.trieNodes.push([]);
		this.refillNext();
		const e: number[] = [];
		for (let i = 0; i < this.gens[0].length; i++) {
			e[i] = i;
		}
		const visited = new Map<string, number[]>();
		for (let seqlen = 0; seqlen <= depth; seqlen++) {
			this.searchSkip(e, seqlen, [], 1, visited);
			this.refillNext();
		}
	}

	searchSkip(perm: number[], maxl: number, seq: number[], node: number, visited: Map<string, number[]>): void {
		if (maxl === 0) {
			const key = String.fromCharCode.apply(null, perm);
			if (visited.has(key)) {
				this.addSkipSeq(seq);
			} else {
				visited.set(key, seq.slice());
			}
			return;
		}
		for (let i = 0; i < this.glen; i++) {
			const next = (this.trieNodes[node] as number[])[i];
			if (next === -1) {
				continue;
			}
			const resolvedNext = next < 0 ? ~next : next;
			const gen = this.gens[i];
			const permNew = permMult(gen, perm);
			seq.push(i);
			this.searchSkip(permNew, maxl - 1, seq, resolvedNext, visited);
			seq.pop();
		}
	}
}

// ==================== SubgroupSolver ====================

type PrunTable = [number[], number[], number[], number[], number];

export type SolutionMove = number[] | number;

export interface PermContext {
	mask?: number;
	prunTable?: PrunTable;
}

export class SubgroupSolver {
	static readonly ONLY_IDA = 0x1;
	static readonly ALLOW_PRE = 0x2;

	genG: number[][];
	genH: number[][];
	genM: number[][] | undefined;

	sgsH!: SchreierSims;
	sgsG!: SchreierSims;
	sgsM: SchreierSims | null | undefined;
	sgsMdepth!: number;

	isCosetSearch!: boolean;
	clen!: number;

	genEx!: number[][];
	genExi!: number[][];
	genExMap!: number[][];
	glen!: number;

	canon!: CanonSeqGen;
	canoni!: CanonSeqGen;

	moveTable!: number[];
	idx2coset!: number[][];
	coset2idx!: Record<string, number>;
	prunTable!: PrunTable;

	constructor(genG: number[][], genH?: number[][], genM?: number[][]) {
		this.genG = genG;
		this.genH = genH || [];
		this.genM = genM;
		if (!genH) {
			const e: number[] = [];
			for (let i = 0; i < genG[0].length; i++) {
				e[i] = i;
			}
			this.genH = [e];
		}
	}

	permHash(perm: number[]): string {
		return String.fromCharCode.apply(null, perm);
	}

	midCosetHash(perm: number[]): string {
		return this.sgsM == null
			? this.sgsG.isMember(permInv(perm), this.sgsMdepth).toString()
			: this.permHash(this.sgsM.minElem(perm));
	}

	initTables(maxCosetSize?: number): void {
		if (this.coset2idx) {
			return;
		}
		maxCosetSize = maxCosetSize || 100000;

		this.sgsH = new SchreierSims(this.genH);
		this.sgsG = new SchreierSims(this.sgsH);
		this.sgsG.extend(this.genG);
		const cosetSize = (this.sgsG.size() as number) / (this.sgsH.size() as number);
		this.isCosetSearch = (this.sgsH.size() as number) > 1;

		let midCosetSize = 1;
		if (this.genM) {
			this.sgsM = new SchreierSims(this.genM);
			midCosetSize = (this.sgsG.size() as number) / (this.sgsM.size() as number);
		} else if ((this.sgsH.size() as number) === 1) {
			this.sgsM = null;
			this.sgsMdepth = 0;
			for (let i = this.sgsG.e.length - 1; i >= 0; i--) {
				if (midCosetSize * this.sgsG.i2t[i].length > maxCosetSize) {
					break;
				}
				this.sgsMdepth = i;
				midCosetSize *= this.sgsG.i2t[i].length;
			}
		} else if (cosetSize <= maxCosetSize) {
			this.sgsM = new SchreierSims(this.genH);
			midCosetSize = cosetSize;
		} else {
			this.sgsM = null;
			this.sgsMdepth = this.sgsG.e.length;
		}
		this.clen = midCosetSize;

		this.genEx = [];
		this.genExi = [];
		this.genExMap = [];
		const genExSet = new Map<string, number>();
		genExSet.set(this.permHash(this.sgsG.e), -1);
		for (let i = 0; i < this.genG.length; i++) {
			let perm = this.genG[i];
			let pow = 1;
			while (true) {
				const key = this.permHash(perm);
				if (genExSet.has(key)) {
					break;
				}
				genExSet.set(key, this.genEx.length);
				this.genEx.push(perm);
				this.genExi.push(permInv(perm));
				this.genExMap.push([i, pow]);
				perm = permMult(this.genG[i], perm);
				pow++;
			}
		}
		this.glen = this.genEx.length;
		for (let i = 0; i < this.glen; i++) {
			const genInv = permInv(this.genEx[i]);
			this.genExMap[i][2] = genExSet.get(this.permHash(genInv))!;
		}

		this.canon = new CanonSeqGen(this.genEx);
		this.canon.initTrie(2);
		this.canoni = new CanonSeqGen(this.genEx);
		for (let i = 0; i < this.canon.skipSeqs.length; i++) {
			const seq = this.canon.skipSeqs[i].slice();
			seq.reverse();
			for (let j = 0; j < seq.length; j++) {
				seq[j] = this.genExMap[seq[j]][2];
			}
			this.canoni.addSkipSeq(seq);
		}
		this.canoni.refillNext();

		// move table, {coset <=> representative} for G/M
		this.moveTable = [];
		this.idx2coset = [this.sgsG.e];
		this.coset2idx = {};
		this.coset2idx[this.midCosetHash(this.sgsG.e)] = 0;
		for (let i = 0; i < this.idx2coset.length; i++) {
			if (i >= midCosetSize) {
				break;
			}
			const perm = this.idx2coset[i];
			for (let j = 0; j < this.glen; j++) {
				if (this.genExMap[j][1] !== 1) {
					continue;
				}
				const newp = permMult(this.genEx[j], perm);
				const key = this.midCosetHash(newp);
				if (!(key in this.coset2idx)) {
					this.coset2idx[key] = this.idx2coset.length;
					this.idx2coset.push(newp);
				}
				this.moveTable[i * this.glen + j] = this.coset2idx[key];
			}
		}
		let stdMove: number | null = null;
		for (let j = 0; j < this.glen; j++) {
			if (this.genExMap[j][1] === 1) {
				stdMove = j;
				continue;
			}
			for (let i = 0; i < this.clen; i++) {
				this.moveTable[i * this.glen + j] = this.moveTable[this.moveTable[i * this.glen + j - 1] * this.glen + stdMove!];
			}
		}
		this.prunTable = this.initPrunTable(this.sgsG.e);
	}

	idaMidSearch(
		pidx: number,
		maxl: number,
		lm: number,
		trieNodes: TrieNode[],
		moves: number[],
		curPerm: number[],
		insertPerm: number[] | null,
		prunTable: PrunTable,
		callback: (moves: number[], permKey: number[]) => any
	): any {
		const nodePrun = prunTable[0][pidx];
		if (nodePrun > maxl) {
			return false;
		}
		if (maxl === 0) {
			if (pidx >= this.clen) {
				moves.push(-1);
				const newPerm = permMult(curPerm, insertPerm!);
				const ret = callback(moves, newPerm);
				moves.pop();
				return ret;
			}
			return callback(moves, curPerm);
		}

		if (pidx >= this.clen && lm !== 0) {
			const newpidx = prunTable[3][pidx - this.clen];
			moves.push(-1);
			const newPerm = permMult(curPerm, insertPerm!);
			const ret = this.idaMidSearch(newpidx, maxl, 1, trieNodes, moves, newPerm, insertPerm, prunTable, callback);
			moves.pop();
			if (ret) {
				return ret;
			}
		}

		const node = trieNodes[(lm || 1)] as number[];
		const glenBase = pidx * ((this.glen + 31) >> 5);

		for (let mbase = 0; mbase < this.glen; mbase += 32) {
			let mask = node[this.glen + (mbase >> 5)];
			mask |= (nodePrun >= maxl - 1) ? (prunTable[nodePrun - maxl + 2] as number[])[glenBase + (mbase >> 5)] : 0;
			mask = ~mask & (this.glen - mbase >= 32 ? -1 : ((1 << (this.glen - mbase)) - 1));
			while (mask !== 0) {
				let midx = 31 - Math.clz32(mask);
				mask -= 1 << midx;
				midx += mbase;

				const cidx = pidx % this.clen;
				const newpidx = this.moveTable[cidx * this.glen + midx] + pidx - cidx;
				const nextCanon = node[midx];
				moves.push(midx);
				const newPerm = permMult(curPerm, this.genExi[midx]);
				const ret = this.idaMidSearch(newpidx, maxl - 1, nextCanon ^ (nextCanon >> 31), trieNodes, moves, newPerm, insertPerm, prunTable, callback);
				moves.pop();
				if (ret) {
					return ret;
				}
			}
		}
		return false;
	}

	initPrunTable(perm: number[], tryNISS?: boolean): PrunTable {
		const pidx = this.coset2idx[this.midCosetHash(perm)];
		const prunTable: number[] = [];
		const fartherMask: number[] = [];
		const nocloserMask: number[] = [];
		const maskBase = (this.glen + 31) >> 5;
		for (let i = 0; i < this.clen; i++) {
			prunTable[i] = -1;
		}
		const permMove: number[] = [];
		if (tryNISS) {
			for (let i = 0; i < this.clen; i++) {
				prunTable.push(-1, -1);
				permMove[i] = this.coset2idx[this.midCosetHash(permMult(perm, this.idx2coset[i]))];
				permMove[permMove[i] + this.clen] = i;
			}
			prunTable[0] = 0;
		} else {
			prunTable[pidx] = 0;
		}
		let fill = 1;
		let lastfill = 0;
		let curDepth = 0;
		while (fill !== lastfill) {
			lastfill = fill;
			for (let idx = 0; idx < prunTable.length; idx++) {
				if (prunTable[idx] !== curDepth) {
					continue;
				}
				const cidx = idx % this.clen;
				const midx = idx - cidx;
				for (let m = 0; m < this.glen; m++) {
					const newIdx = this.moveTable[cidx * this.glen + m] + midx;
					let newPrun = prunTable[newIdx];
					if (prunTable[newIdx] === -1) {
						prunTable[newIdx] = curDepth + 1;
						newPrun = curDepth + 1;
						fill++;
					}
					if (newPrun > curDepth) {
						fartherMask[idx * maskBase + (m >> 5)] |= 1 << (m & 0x1f);
					}
					if (newPrun >= curDepth) {
						nocloserMask[idx * maskBase + (m >> 5)] |= 1 << (m & 0x1f);
					}
				}
				if (!tryNISS || midx !== 0) {
					continue;
				}
				// insert perm/permi
				for (let m = 0; m < 2; m++) {
					const newIdx = permMove[cidx + (1 - m) * this.clen] + (m + 1) * this.clen;
					if (prunTable[newIdx] === -1) {
						prunTable[newIdx] = curDepth;
						fill++;
					}
				}
			}
			curDepth++;
		}
		return [prunTable, fartherMask, nocloserMask, permMove, curDepth];
	}

	// 0 - normal, 1 - solved, 2 - unsolvable
	checkPerm(perm: number[]): number {
		this.initTables();
		if (this.sgsH.isMember(perm) >= 0) {
			return 1;
		} else if (this.sgsG.isMember(perm) < 0) {
			return 2;
		} else {
			return 0;
		}
	}

	DissectionSolve(
		perm: number[],
		minl: number,
		maxl: number,
		permCtx?: PermContext,
		solCallback?: (solution: SolutionMove[]) => any
	): SolutionMove[] | null | undefined {
		permCtx = permCtx || {};
		this.initTables();
		if (this.sgsG.isMember(perm) < 0) {
			return undefined;
		}
		let pidx: number = this.coset2idx[this.midCosetHash(perm)];
		if (!pidx && pidx !== 0) {
			return undefined;
		}
		const onlyIDA = ((permCtx.mask || 0) & SubgroupSolver.ONLY_IDA) !== 0;
		const tryNISS = ((permCtx.mask || 0) & SubgroupSolver.ALLOW_PRE) !== 0 && this.isCosetSearch;
		let ret: SolutionMove[] | null = null;
		let prunTable1: PrunTable = this.prunTable;
		let prunTable2: PrunTable | null = null;
		if (tryNISS) {
			permCtx.prunTable = permCtx.prunTable || this.initPrunTable(perm, tryNISS);
			prunTable2 = permCtx.prunTable;
			prunTable1 = prunTable2;
			pidx = this.clen;
		}
		for (let depth = Math.max(minl, prunTable1[0][pidx]); depth <= maxl; depth++) {
			const permi = permInv(perm);
			if (onlyIDA || depth <= this.prunTable[4]) {
				ret = this.idaMidSearch(
					tryNISS ? this.clen : pidx,
					depth,
					1,
					this.canon.trieNodes,
					[],
					this.sgsG.toKeyIdx(tryNISS ? undefined : permi),
					permi,
					prunTable1,
					(moves: number[], permKey: number[]) => {
						if (this.sgsG.isSubgroupMemberByKey(permKey, this.sgsH) < 0) {
							return;
						}
						const solution: SolutionMove[] = [];
						for (let i = 0; i < moves.length; i++) {
							solution.push(moves[i] === -1 ? -1 : this.genExMap[moves[i]].slice(0, 2));
						}
						return solCallback ? solCallback(solution) : solution;
					}
				);
				if (ret) {
					return ret;
				}
				continue;
			}
			const mid = ~~(depth / 2);
			if (!prunTable2) {
				prunTable2 = this.initPrunTable(perm, tryNISS);
			}
			const preSize = tryNISS ? 2 : 1;
			for (let mpidx = 0; mpidx < this.clen * preSize; mpidx++) {
				const mpidx1 = mpidx;
				const mpidx2 = mpidx + (tryNISS ? (mpidx >= this.clen ? -this.clen : this.clen * 2) : 0);
				if (prunTable1[0][mpidx1] > mid || prunTable2[0][mpidx2] > depth - mid) {
					continue;
				}

				// search from mpidx to 0
				const visited = new Map<string, number[][]>();
				const perm0 = this.isCosetSearch ? this.sgsG.e : this.sgsG.toKeyIdx();
				this.idaMidSearch(
					mpidx1,
					mid,
					0,
					this.canon.trieNodes,
					[],
					perm0,
					permi,
					prunTable1,
					(moves: number[], permKey: number[]) => {
						let key: string;
						if (this.isCosetSearch) {
							const permRep = this.sgsH.minElem(permKey);
							key = this.permHash(permRep);
						} else {
							key = this.permHash(permKey);
						}
						const sols1h = visited.get(key) || [];
						sols1h.push(moves.slice());
						visited.set(key, sols1h);
					}
				);

				// search from mpidx to pidx
				ret = this.idaMidSearch(
					mpidx2,
					depth - mid,
					1,
					this.canoni.trieNodes,
					[],
					perm0,
					perm,
					prunTable2,
					(moves: number[], permKey: number[]) => {
						const finalPermKey = tryNISS ? permKey : permMult(permKey, perm);
						let key: string;
						if (this.isCosetSearch) {
							const permRep = this.sgsH.minElem(finalPermKey);
							key = this.permHash(permRep);
						} else {
							key = this.permHash(finalPermKey);
						}

						if (visited.has(key)) {
							const sols2h: SolutionMove[] = [];
							let node = 1;
							for (let i = 0; i < moves.length; i++) {
								let move: number = moves[moves.length - 1 - i];
								move = move === -1 ? -1 : this.genExMap[move][2];
								node = move === -1 ? 1 : (this.canon.trieNodes[node] as number[])[move];
								node ^= node >> 31;
								sols2h.push(move === -1 ? -1 : this.genExMap[move].slice(0, 2));
							}
							const sols1h = visited.get(key)!;
							for (let i = 0; i < sols1h.length; i++) {
								const solution: SolutionMove[] = sols2h.slice();
								let node2 = node;
								for (let j = 0; j < sols1h[i].length; j++) {
									const move = sols1h[i][j];
									node2 = move === -1 ? 1 : (this.canon.trieNodes[node2] as number[])[move];
									if (node2 === -1) {
										break;
									}
									node2 ^= node2 >> 31;
									solution.push(move === -1 ? -1 : this.genExMap[move].slice(0, 2));
								}
								if (node2 === -1) {
									continue;
								}
								const chk = solCallback ? solCallback(solution) : solution;
								if (chk) {
									return chk;
								}
							}
						}
					}
				);
				if (ret) {
					break;
				}
			}
			if (ret) {
				break;
			}
		}
		return ret;
	}

	godsAlgo(depth: number): number {
		this.initTables();
		let stateCnt = 0;
		for (let i = 0; i < this.clen; i++) {
			const visited = new Set<string>();
			for (let maxl = 0; maxl <= depth; maxl++) {
				const perm0 = this.isCosetSearch ? this.sgsG.e : this.sgsG.toKeyIdx();
				this.idaMidSearch(
					i,
					maxl,
					1,
					this.canon.trieNodes,
					[],
					perm0,
					null,
					this.prunTable,
					(moves: number[], permKey: number[]) => {
						let key: string;
						if (this.isCosetSearch) {
							const permRep = this.sgsH.minElem(permKey);
							key = this.permHash(permRep);
						} else {
							key = this.permHash(permKey);
						}
						if (!visited.has(key)) {
							stateCnt++;
							visited.add(key);
						}
					}
				);
			}
		}
		return stateCnt;
	}
}
