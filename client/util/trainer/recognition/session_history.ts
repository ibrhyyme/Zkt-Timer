/**
 * Session history (Dexie/IndexedDB) — referans `session_history.js` birebir portu.
 * SSR safe: indexedDB yoksa no-op + bos cevap.
 */
import {getRecognitionDb, isRecognitionDbAvailable, type RecognitionSessionRecord} from '../../../db/recognition_db';
import {allPllKeys} from './pll_cases';
import type {ResultRecord} from './evaluation';

export function computePoolKey(pool: string[] | null | undefined): string {
	const keys = pool ? [...new Set(pool)] : allPllKeys();
	return keys.sort().join(',');
}

export interface SaveSessionInput {
	pool: string[] | null;
	sizeOption: number;
	presetLabel: string;
	results: ResultRecord[];
}

export async function saveSession({pool, sizeOption, presetLabel, results}: SaveSessionInput): Promise<number | null> {
	if (!isRecognitionDbAvailable()) return null;
	const poolKey = computePoolKey(pool);
	const totalCases = results.length;
	const correctCount = results.filter((r) => r.mistake === '').length;
	let totalTimeMs = 0;
	results.forEach((r) => {
		totalTimeMs += new Date(r.finished).getTime() - new Date(r.started).getTime();
	});

	const record: RecognitionSessionRecord = {
		completedAt: new Date(),
		poolKey,
		sizeOption,
		presetLabel,
		caseCount: (pool ? new Set(pool) : new Set(allPllKeys())).size,
		totalCases,
		correctCount,
		totalTimeMs,
		avgTimeMs: totalCases > 0 ? totalTimeMs / totalCases : 0,
	};

	const id = await getRecognitionDb().sessions.add(record);
	return id;
}

async function getSessionsByType(poolKey: string, sizeOption: number): Promise<RecognitionSessionRecord[]> {
	if (!isRecognitionDbAvailable()) return [];
	return getRecognitionDb().sessions.where({poolKey, sizeOption}).sortBy('completedAt');
}

export async function getAllSessions(): Promise<RecognitionSessionRecord[]> {
	if (!isRecognitionDbAvailable()) return [];
	return getRecognitionDb().sessions.orderBy('completedAt').reverse().toArray();
}

export async function clearAllSessions(): Promise<void> {
	if (!isRecognitionDbAvailable()) return;
	await getRecognitionDb().sessions.clear();
}

export async function deleteSession(id: number): Promise<void> {
	if (!isRecognitionDbAvailable()) return;
	await getRecognitionDb().sessions.delete(id);
}

export interface PersonalBest {
	bestAccuracy: number;
	bestAvgTimeMs: number;
	totalSessions: number;
}

export async function getPersonalBests(poolKey: string, sizeOption: number): Promise<PersonalBest | null> {
	const sessions = await getSessionsByType(poolKey, sizeOption);
	if (sessions.length === 0) return null;

	const accuracies = sessions.map((s) => s.correctCount / s.totalCases);
	const bestAccuracy = Math.max(...accuracies);

	// Best avg time among sessions with best accuracy (reward speed only at peak accuracy)
	const perfectSessions = sessions.filter((s) => s.correctCount / s.totalCases === bestAccuracy);
	const bestAvgTimeMs = Math.min(...perfectSessions.map((s) => s.avgTimeMs));

	return {
		bestAccuracy,
		bestAvgTimeMs,
		totalSessions: sessions.length,
	};
}
