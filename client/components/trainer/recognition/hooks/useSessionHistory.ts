/**
 * useSessionHistory — Dexie'den sessions yukler, filter/pagination/PB/trend hesaplar.
 * Referans `composables/useSessionHistory.js` portu.
 */
import {useCallback, useEffect, useMemo, useState} from 'react';
import {getAllSessions, deleteSession as deleteSessionDb} from '../../../../util/trainer/recognition/session_history';
import type {RecognitionSessionRecord} from '../../../../db/recognition_db';
import {sessionTypeKey} from '../../../../util/trainer/recognition/formatters';

const PAGE_SIZE = 10;

export interface SessionTypeEntry {
	label: string;
	totalCases: number;
	key: string;
}

export type TrendDirection = 'up' | 'down';

export function useSessionHistory() {
	const [sessions, setSessions] = useState<RecognitionSessionRecord[]>([]);
	const [selectedType, setSelectedType] = useState<string>('all');
	const [currentPage, setCurrentPage] = useState(1);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		(async () => {
			try {
				const all = await getAllSessions();
				setSessions(all);
			} catch {
				setSessions([]);
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	const sessionTypes = useMemo<SessionTypeEntry[]>(() => {
		const types = new Map<string, SessionTypeEntry>();
		sessions.forEach((s) => {
			const key = sessionTypeKey(s);
			if (!types.has(key)) {
				types.set(key, {label: s.presetLabel, totalCases: s.totalCases, key});
			}
		});
		return [...types.values()];
	}, [sessions]);

	const filteredSessions = useMemo(() => {
		if (selectedType === 'all') return sessions;
		return sessions.filter((s) => sessionTypeKey(s) === selectedType);
	}, [sessions, selectedType]);

	const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));

	const paginatedSessions = useMemo(() => {
		const start = (currentPage - 1) * PAGE_SIZE;
		return filteredSessions.slice(start, start + PAGE_SIZE);
	}, [filteredSessions, currentPage]);

	const showingRange = useMemo(() => {
		const total = filteredSessions.length;
		if (total === 0) return '';
		const start = (currentPage - 1) * PAGE_SIZE + 1;
		const end = Math.min(currentPage * PAGE_SIZE, total);
		return `${start}–${end} of ${total}`;
	}, [filteredSessions.length, currentPage]);

	// type degisirse sayfayi 1'e sifirla
	useEffect(() => {
		setCurrentPage(1);
	}, [selectedType]);

	// PB flag: hangi sessionlar kendi tipinde PB
	const pbMap = useMemo(() => {
		const map = new Map<number, boolean>();
		const byType = new Map<string, RecognitionSessionRecord[]>();
		// sessions reverse → oldest first
		[...sessions].reverse().forEach((s) => {
			const key = sessionTypeKey(s);
			if (!byType.has(key)) byType.set(key, []);
			byType.get(key)!.push(s);
		});
		byType.forEach((typeSessions) => {
			let bestAccuracy = -1;
			let bestAvgTime = Infinity;
			typeSessions.forEach((s) => {
				const acc = s.correctCount / s.totalCases;
				const isPbAccuracy = acc > bestAccuracy;
				const isPbTime = acc >= bestAccuracy && s.avgTimeMs < bestAvgTime;
				if ((isPbAccuracy || isPbTime) && s.id !== undefined) {
					map.set(s.id, true);
				}
				if (acc > bestAccuracy) bestAccuracy = acc;
				if (acc >= bestAccuracy && s.avgTimeMs < bestAvgTime) bestAvgTime = s.avgTimeMs;
			});
		});
		return map;
	}, [sessions]);

	const trendMap = useMemo<Map<string, TrendDirection>>(() => {
		const map = new Map<string, TrendDirection>();
		const byType = new Map<string, RecognitionSessionRecord[]>();
		sessions.forEach((s) => {
			const key = sessionTypeKey(s);
			if (!byType.has(key)) byType.set(key, []);
			byType.get(key)!.push(s);
		});
		byType.forEach((typeSessions, key) => {
			if (typeSessions.length < 4) return;
			const recent3 = typeSessions.slice(0, 3);
			const prev3 = typeSessions.slice(3, 6);
			if (prev3.length === 0) return;
			const avgAcc = (arr: RecognitionSessionRecord[]) =>
				arr.reduce((sum, s) => sum + s.correctCount / s.totalCases, 0) / arr.length;
			const diff = avgAcc(recent3) - avgAcc(prev3);
			if (diff > 0.02) map.set(key, 'up');
			else if (diff < -0.02) map.set(key, 'down');
		});
		return map;
	}, [sessions]);

	const removeSession = useCallback(async (id: number) => {
		await deleteSessionDb(id);
		setSessions((prev) => prev.filter((s) => s.id !== id));
	}, []);

	return {
		sessions,
		sessionTypes,
		selectedType,
		setSelectedType,
		filteredSessions,
		currentPage,
		setCurrentPage,
		totalPages,
		paginatedSessions,
		showingRange,
		pbMap,
		trendMap,
		loading,
		removeSession,
	};
}
