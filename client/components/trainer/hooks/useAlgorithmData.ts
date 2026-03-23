import {useState, useCallback, useEffect} from 'react';
import {useTrainerDb} from '../../../util/hooks/useTrainerDb';
import {emitEvent} from '../../../util/event_handler';
import {algToId, expandNotation} from '../../../util/trainer/algorithm_engine';
import type {AlgorithmEntry, AlgorithmSubset, LearnedStatus, TrainerSolveRecord} from '../types';

const STORAGE_KEY = 'trainer_savedAlgorithms';
const PREFIX = 'trainer_';

// Lazy-loaded default algorithms (fetched from /public/ instead of bundled)
let defaultAlgsCache: Record<string, AlgorithmSubset[]> | null = null;

export async function fetchDefaultAlgs(): Promise<Record<string, AlgorithmSubset[]>> {
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

	// Yeni kategorileri ekle
	for (const category of Object.keys(defaultAlgs)) {
		if (!saved[category]) {
			saved[category] = defaultAlgs[category];
			changed = true;
		}
	}

	// Defaults'tan kaldirilan kategorileri temizle
	for (const category of Object.keys(saved)) {
		if (!defaultAlgs[category]) {
			delete saved[category];
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

export function getLastTimes(algId: string): TrainerSolveRecord[] {
	const raw = localStorage.getItem(PREFIX + 'LastTimes-' + algId);
	if (!raw) return [];
	// Eski format: "338,293,338" — auto-migrate
	if (!raw.startsWith('[')) {
		const records: TrainerSolveRecord[] = raw.split(',').map((n) => ({t: Number(n.trim())}));
		localStorage.setItem(PREFIX + 'LastTimes-' + algId, JSON.stringify(records));
		return records;
	}
	return JSON.parse(raw);
}

function saveRecords(algId: string, records: TrainerSolveRecord[]) {
	localStorage.setItem(PREFIX + 'LastTimes-' + algId, JSON.stringify(records));
}

export function getEffectiveTime(record: TrainerSolveRecord): number | null {
	if (record.dnf) return null;
	return record.t + (record.p2 ? 2000 : 0);
}

function recalculateBest(algId: string) {
	const records = getLastTimes(algId);
	const validTimes = records.filter((r) => !r.dnf).map((r) => r.t + (r.p2 ? 2000 : 0));
	if (validTimes.length === 0) {
		localStorage.removeItem(PREFIX + 'Best-' + algId);
		emitEvent('trainerDbUpdatedEvent');
	} else {
		setBestTime(algId, Math.min(...validTimes));
	}
}

export function addTime(algId: string, time: number) {
	const records = getLastTimes(algId);
	records.push({t: time, ts: Date.now()});
	const trimmed = records.slice(-100);
	saveRecords(algId, trimmed);
	recalculateBest(algId);
}

export function deleteTrainerSolve(algId: string, index: number) {
	const records = getLastTimes(algId);
	if (index < 0 || index >= records.length) return;
	records.splice(index, 1);
	saveRecords(algId, records);
	recalculateBest(algId);
}

export function toggleTrainerPlusTwo(algId: string, index: number) {
	const records = getLastTimes(algId);
	if (index < 0 || index >= records.length) return;
	records[index].p2 = !records[index].p2;
	if (!records[index].p2) delete records[index].p2;
	saveRecords(algId, records);
	recalculateBest(algId);
}

export function toggleTrainerDnf(algId: string, index: number) {
	const records = getLastTimes(algId);
	if (index < 0 || index >= records.length) return;
	records[index].dnf = !records[index].dnf;
	if (!records[index].dnf) delete records[index].dnf;
	saveRecords(algId, records);
	recalculateBest(algId);
}

export function resetTrainerSeason(algId: string) {
	localStorage.removeItem(PREFIX + 'LastTimes-' + algId);
	localStorage.removeItem(PREFIX + 'Best-' + algId);
	emitEvent('trainerDbUpdatedEvent');
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
 * Rolling Ao5 at position idx in the records array.
 * Trims best and worst, averages middle 3.
 * DNF iceren average null dondurur.
 */
export function rollingAo5(records: TrainerSolveRecord[], idx: number): number | null {
	if (idx < 4) return null;
	const slice = records.slice(idx - 4, idx + 1);
	const effTimes = slice.map((r) => getEffectiveTime(r));
	// 1+ DNF varsa average null
	if (effTimes.some((t) => t === null)) return null;
	const sorted = (effTimes as number[]).sort((a, b) => a - b);
	const trimmed = sorted.slice(1, 4);
	return trimmed.reduce((sum, t) => sum + t, 0) / 3;
}

/**
 * Rolling Ao12 at position idx in the records array.
 * Trims best and worst, averages middle 10.
 * 2+ DNF varsa average null.
 */
export function rollingAo12(records: TrainerSolveRecord[], idx: number): number | null {
	if (idx < 11) return null;
	const slice = records.slice(idx - 11, idx + 1);
	const effTimes = slice.map((r) => getEffectiveTime(r));
	const dnfCount = effTimes.filter((t) => t === null).length;
	if (dnfCount > 1) return null;
	// DNF'yi Infinity olarak say (trim'de en kotu olarak cikar)
	const sorted = effTimes.map((t) => t ?? Infinity).sort((a, b) => a - b);
	const trimmed = sorted.slice(1, 11);
	if (trimmed.some((t) => t === Infinity)) return null;
	return trimmed.reduce((sum, t) => sum + t, 0) / 10;
}

export function averageOfFive(algId: string): number | null {
	const records = getLastTimes(algId);
	if (records.length < 5) return null;
	return rollingAo5(records, records.length - 1);
}

export function averageOfTwelve(algId: string): number | null {
	const records = getLastTimes(algId);
	if (records.length < 12) return null;
	return rollingAo12(records, records.length - 1);
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

// --- Custom Alternatives ---

const CUSTOM_ALTS_KEY = 'trainer_customAlternatives';

function makeCustomAltKey(category: string, subset: string, name: string): string {
	return `${category}::${subset}::${name}`;
}

export function getCustomAlternatives(category: string, subset: string, name: string): string[] {
	try {
		const data = JSON.parse(localStorage.getItem(CUSTOM_ALTS_KEY) || '{}');
		return data[makeCustomAltKey(category, subset, name)] || [];
	} catch {
		return [];
	}
}

export function addCustomAlternative(category: string, subset: string, name: string, algorithm: string) {
	const data = JSON.parse(localStorage.getItem(CUSTOM_ALTS_KEY) || '{}');
	const altKey = makeCustomAltKey(category, subset, name);
	if (!data[altKey]) data[altKey] = [];

	const expanded = expandNotation(algorithm);
	if (data[altKey].some((a: string) => expandNotation(a) === expanded)) return;

	data[altKey].push(algorithm);
	localStorage.setItem(CUSTOM_ALTS_KEY, JSON.stringify(data));
	emitEvent('trainerDbUpdatedEvent');
}

export function deleteCustomAlternative(category: string, subset: string, name: string, algorithm: string) {
	const data = JSON.parse(localStorage.getItem(CUSTOM_ALTS_KEY) || '{}');
	const altKey = makeCustomAltKey(category, subset, name);
	if (!data[altKey]) return;

	const expanded = expandNotation(algorithm);
	data[altKey] = data[altKey].filter((a: string) => expandNotation(a) !== expanded);
	if (data[altKey].length === 0) delete data[altKey];

	localStorage.setItem(CUSTOM_ALTS_KEY, JSON.stringify(data));
	emitEvent('trainerDbUpdatedEvent');
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
