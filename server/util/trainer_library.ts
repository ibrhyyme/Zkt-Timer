import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {Library} from './alg_catalog';
import {logger} from '../services/logger';

/**
 * The trainer library the server serves.
 *
 * The full library (every alternative) is private data: it lives outside git, uploaded to the
 * server by hand and mounted into the container at data/trainer/library.json (docker-compose
 * volume). Without it (a fresh checkout, tests) the public default-algs.json stands in, so the
 * trainer and the catalog keep working with the old library.
 *
 * Clients never get the file itself: the main algorithm of every case goes to anyone
 * (trainerLibrary, with how many alternatives the case has), the alternatives only to signed-in
 * users, one category per request (trainerLibraryAlternatives).
 */

export type MainEntry = {name: string; algorithm: string; setup?: string; alternativeCount: number};
export type MainSubset = {subset: string; algorithms: MainEntry[]};
export type MainCategory = {category: string; subsets: MainSubset[]};
export type CaseAlternatives = {name: string; alternatives: string[]};

export type TrainerLibrary = {
	version: string;
	/** True when the private file was found; false on the public fallback. */
	private: boolean;
	full: Library;
	mains: MainCategory[];
	alternatives: Map<string, CaseAlternatives[]>;
};

// server/util -> repo root. Same relative layout in the compiled image (node server/app.js).
const ROOT = path.join(__dirname, '..', '..');

export function privateLibraryPath(): string {
	return process.env.TRAINER_LIBRARY_PATH || path.join(ROOT, 'data', 'trainer', 'library.json');
}

export function publicLibraryPath(): string {
	return path.join(ROOT, 'public', 'trainer', 'default-algs.json');
}

export function buildTrainerLibrary(raw: string, isPrivate: boolean): TrainerLibrary {
	const full: Library = JSON.parse(raw);
	const mains: MainCategory[] = [];
	const alternatives = new Map<string, CaseAlternatives[]>();

	for (const category of Object.keys(full)) {
		const subsets: MainSubset[] = [];
		const alts: CaseAlternatives[] = [];
		for (const sub of full[category] || []) {
			const algorithms: MainEntry[] = [];
			for (const entry of sub?.algorithms || []) {
				if (!entry?.name || !entry.algorithm) continue;
				const setup = (entry as {setup?: string}).setup;
				const alternativeCount = entry.alternatives?.length || 0;
				algorithms.push(setup ? {name: entry.name, algorithm: entry.algorithm, setup, alternativeCount} : {name: entry.name, algorithm: entry.algorithm, alternativeCount});
				if (entry.alternatives?.length) alts.push({name: entry.name, alternatives: entry.alternatives});
			}
			subsets.push({subset: sub.subset, algorithms});
		}
		mains.push({category, subsets});
		alternatives.set(category, alts);
	}

	const version = crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16);
	return {version, private: isPrivate, full, mains, alternatives};
}

let cached: TrainerLibrary | null = null;

/** Read once per process: a new file needs a container restart, like every deploy does. */
export function getTrainerLibrary(): TrainerLibrary {
	if (!cached) {
		const privatePath = privateLibraryPath();
		if (fs.existsSync(privatePath)) {
			cached = buildTrainerLibrary(fs.readFileSync(privatePath, 'utf8'), true);
		} else {
			if (process.env.NODE_ENV === 'production') {
				logger.warn('Trainer library: private file missing, serving the public library', {path: privatePath});
			}
			cached = buildTrainerLibrary(fs.readFileSync(publicLibraryPath(), 'utf8'), false);
		}
	}
	return cached;
}

/** Test hook: replace (or with null, drop) the cached library. */
export function setTrainerLibraryForTests(library: TrainerLibrary | null): void {
	cached = library;
}
