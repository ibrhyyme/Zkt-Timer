import {useState, useCallback, useEffect} from 'react';
import {useTrainerDb} from '../../../util/hooks/useTrainerDb';
import {emitEvent} from '../../../util/event_handler';
import {algToId, expandNotation} from '../../../util/trainer/algorithm_engine';
import type {AlgorithmEntry, AlgorithmSubset, LearnedStatus} from '../types';

const STORAGE_KEY = 'trainer_savedAlgorithms';
const PREFIX = 'trainer_';

// Lazy-loaded default algorithms (fetched from /public/ instead of bundled)
let defaultAlgsCache: Record<string, AlgorithmSubset[]> | null = null;

async function fetchDefaultAlgs(): Promise<Record<string, AlgorithmSubset[]>> {
	if (defaultAlgsCache) return defaultAlgsCache;
	const res = await fetch('/public/trainer/default-algs.json');
	defaultAlgsCache = await res.json();
	return defaultAlgsCache!;
}

function getSavedAlgorithms(): Record<string, AlgorithmSubset[]> {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
	} catch {
		return {};
	}
}

function setSavedAlgorithms(data: Record<string, AlgorithmSubset[]>) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	emitEvent('trainerDbUpdatedEvent');
}

/**
 * Initialize localStorage with default algorithms if empty.
 * Merges any missing categories from defaults into saved data.
 * Fetches default algorithms lazily from /public/ on first call.
 */
export async function initializeDefaultAlgorithms() {
	const defaultAlgs = await fetchDefaultAlgs();
	const existing = localStorage.getItem(STORAGE_KEY);
	if (!existing) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultAlgs));
		return;
	}

	const saved = JSON.parse(existing) as Record<string, AlgorithmSubset[]>;
	let changed = false;

	for (const category of Object.keys(defaultAlgs)) {
		if (!saved[category]) {
			saved[category] = defaultAlgs[category];
			changed = true;
		}
	}

	if (changed) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
	}
}

// --- Per-algorithm localStorage helpers ---

export function getBestTime(algId: string): number | null {
	const val = localStorage.getItem(PREFIX + 'Best-' + algId);
	if (!val) return null;
	const num = Number(val);
	if (num < 100) return null; // Corrupted data (impossible time), ignore
	return num;
}

export function setBestTime(algId: string, time: number) {
	localStorage.setItem(PREFIX + 'Best-' + algId, String(time));
	emitEvent('trainerDbUpdatedEvent');
}

export function getLastTimes(algId: string): number[] {
	const raw = localStorage.getItem(PREFIX + 'LastTimes-' + algId);
	return raw ? raw.split(',').map((n) => Number(n.trim())) : [];
}

export function addTime(algId: string, time: number) {
	const times = getLastTimes(algId);
	times.push(time);
	// Keep last 100 times
	const trimmed = times.slice(-100);
	localStorage.setItem(PREFIX + 'LastTimes-' + algId, trimmed.join(','));

	const best = getBestTime(algId);
	if (best === null || time < best) {
		setBestTime(algId, time);
	} else {
		emitEvent('trainerDbUpdatedEvent');
	}
}

export function getLearnedStatus(algId: string): LearnedStatus {
	const val = localStorage.getItem(PREFIX + 'Learned-' + algId);
	if (!val) return 0;
	return Number(val) as LearnedStatus;
}

export function setLearnedStatus(algId: string, status: LearnedStatus) {
	localStorage.setItem(PREFIX + 'Learned-' + algId, String(status));
	emitEvent('trainerDbUpdatedEvent');
}

/**
 * Rolling Ao5 at position idx in the times array.
 * Trims best and worst, averages middle 3.
 */
export function rollingAo5(times: number[], idx: number): number | null {
	if (idx < 4) return null;
	const slice = times.slice(idx - 4, idx + 1).sort((a, b) => a - b);
	const trimmed = slice.slice(1, 4);
	return trimmed.reduce((sum, t) => sum + t, 0) / 3;
}

/**
 * Rolling Ao12 at position idx in the times array.
 * Trims best and worst, averages middle 10.
 */
export function rollingAo12(times: number[], idx: number): number | null {
	if (idx < 11) return null;
	const slice = times.slice(idx - 11, idx + 1).sort((a, b) => a - b);
	const trimmed = slice.slice(1, 11);
	return trimmed.reduce((sum, t) => sum + t, 0) / 10;
}

export function averageOfFive(algId: string): number | null {
	const times = getLastTimes(algId);
	if (times.length < 5) return null;
	const last5 = times.slice(-5).sort((a, b) => a - b);
	// Trim best and worst, average middle 3
	const trimmed = last5.slice(1, 4);
	return trimmed.reduce((sum, t) => sum + t, 0) / 3;
}

export function averageOfTwelve(algId: string): number | null {
	const times = getLastTimes(algId);
	if (times.length < 12) return null;
	const last12 = times.slice(-12).sort((a, b) => a - b);
	// Trim best and worst, average middle 10
	const trimmed = last12.slice(1, 11);
	return trimmed.reduce((sum, t) => sum + t, 0) / 10;
}

// --- Algorithm CRUD ---

export function saveAlgorithm(category: string, subset: string, name: string, algorithm: string) {
	const saved = getSavedAlgorithms();
	if (!saved[category]) {
		saved[category] = [];
	}

	const existing = saved[category].find((s) => s.subset === subset);
	if (existing) {
		const idx = existing.algorithms.findIndex((a) => a.name === name);
		if (idx !== -1) {
			existing.algorithms[idx] = {name, algorithm};
		} else {
			existing.algorithms.push({name, algorithm});
		}
	} else {
		saved[category].push({subset, algorithms: [{name, algorithm}]});
	}

	setSavedAlgorithms(saved);
}

export function deleteAlgorithm(category: string, algorithm: string) {
	const saved = getSavedAlgorithms();
	if (!saved[category]) return;

	saved[category] = saved[category]
		.map((sub) => ({
			subset: sub.subset,
			algorithms: sub.algorithms.filter(
				(a) => expandNotation(a.algorithm) !== expandNotation(algorithm)
			),
		}))
		.filter((sub) => sub.algorithms.length > 0);

	if (saved[category].length === 0) {
		delete saved[category];
	}

	const id = algToId(algorithm);
	localStorage.removeItem(PREFIX + 'Best-' + id);
	localStorage.removeItem(PREFIX + 'LastTimes-' + id);
	localStorage.removeItem(PREFIX + 'Learned-' + id);

	setSavedAlgorithms(saved);
}

export function exportAlgorithms() {
	const saved = getSavedAlgorithms();
	const blob = new Blob([JSON.stringify(saved, null, 2)], {type: 'application/json'});
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = 'trainer_algorithms.json';
	link.click();
	URL.revokeObjectURL(url);
}

export function importAlgorithms(file: File): Promise<boolean> {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = (event) => {
			if (event.target?.result) {
				try {
					const imported = JSON.parse(event.target.result as string);
					setSavedAlgorithms(imported);
					resolve(true);
				} catch {
					resolve(false);
				}
			} else {
				resolve(false);
			}
		};
		reader.readAsText(file);
	});
}

// --- React Hook ---

export function useAlgorithmData() {
	const dbVersion = useTrainerDb();
	const [categories, setCategories] = useState<string[]>([]);

	useEffect(() => {
		initializeDefaultAlgorithms().then(() => {
			const saved = getSavedAlgorithms();
			setCategories(Object.keys(saved));
		});
	}, []);

	useEffect(() => {
		const saved = getSavedAlgorithms();
		setCategories(Object.keys(saved));
	}, [dbVersion]);

	const getSubsets = useCallback(
		(category: string): string[] => {
			const saved = getSavedAlgorithms();
			if (!saved[category]) return [];
			return saved[category].map((s) => s.subset);
		},
		[dbVersion]
	);

	const getAlgorithms = useCallback(
		(category: string, subsets: string[]): AlgorithmEntry[] => {
			const saved = getSavedAlgorithms();
			if (!saved[category]) return [];

			const result: AlgorithmEntry[] = [];
			for (const subset of subsets) {
				const data = saved[category].find((s) => s.subset === subset);
				if (data) {
					result.push(
						...data.algorithms.map((a) => ({
							...a,
							algorithm: expandNotation(a.algorithm),
						}))
					);
				}
			}
			return result;
		},
		[dbVersion]
	);

	const getAlgorithmsWithSubset = useCallback(
		(category: string, subsets: string[]): {subset: string; algorithms: AlgorithmEntry[]}[] => {
			const saved = getSavedAlgorithms();
			if (!saved[category]) return [];

			return subsets
				.map((subset) => {
					const data = saved[category].find((s) => s.subset === subset);
					if (!data) return null;
					return {
						subset,
						algorithms: data.algorithms.map((a) => ({
							...a,
							algorithm: expandNotation(a.algorithm),
						})),
					};
				})
				.filter(Boolean) as {subset: string; algorithms: AlgorithmEntry[]}[];
		},
		[dbVersion]
	);

	return {
		categories,
		getSubsets,
		getAlgorithms,
		getAlgorithmsWithSubset,
		saveAlgorithm,
		deleteAlgorithm,
		exportAlgorithms,
		importAlgorithms,
	};
}
