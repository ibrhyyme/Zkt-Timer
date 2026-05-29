/**
 * usePresetPBs / useSessionPB — Dexie tabanli PB lookup hook'lari.
 * Referans `composables/usePersonalBests.js` portu.
 */
import {useCallback, useEffect, useMemo, useState} from 'react';
import {presets, presetKeys, type Preset} from '../../../../util/trainer/recognition/session_presets';
import {computePoolKey, getPersonalBests, type PersonalBest} from '../../../../util/trainer/recognition/session_history';
import {useRecognitionContext} from '../RecognitionContext';

export function usePresetPBs(sizeOption: number) {
	const {state} = useRecognitionContext();
	const customPresets = state.presets.customPresets;
	const [presetPBs, setPresetPBs] = useState<Map<string, PersonalBest>>(new Map());

	const load = useCallback(async () => {
		const map = new Map<string, PersonalBest>();
		const allPresets: Preset[] = [...presets, ...customPresets];
		for (const preset of allPresets) {
			const keys = presetKeys(preset);
			const poolKey = computePoolKey(keys);
			const pb = await getPersonalBests(poolKey, sizeOption);
			if (pb) map.set(preset.id, pb);
		}
		setPresetPBs(map);
	}, [customPresets, sizeOption]);

	useEffect(() => {
		load().catch(() => {});
	}, [load]);

	return {presetPBs, reload: load};
}

interface SessionPbResult {
	pb: PersonalBest | null;
	sessionNumber: number;
	isNewBestAccuracy: boolean;
	isNewBestTime: boolean;
}

export function useSessionPB(
	pool: string[] | null,
	sizeOption: number,
	accuracy: number,
	avgTimeMs: number
): SessionPbResult {
	const [pb, setPb] = useState<PersonalBest | null>(null);
	const [sessionNumber, setSessionNumber] = useState(0);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const poolKey = computePoolKey(pool);
			const bests = await getPersonalBests(poolKey, sizeOption);
			if (cancelled) return;
			if (bests) {
				setSessionNumber(bests.totalSessions);
				if (bests.totalSessions > 1) setPb(bests);
				else setPb(null);
			} else {
				setSessionNumber(1);
				setPb(null);
			}
		})().catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [pool, sizeOption]);

	const isNewBestAccuracy = useMemo(() => {
		if (!pb) return false;
		return accuracy >= pb.bestAccuracy;
	}, [pb, accuracy]);

	const isNewBestTime = useMemo(() => {
		if (!pb) return false;
		return accuracy >= pb.bestAccuracy && avgTimeMs <= pb.bestAvgTimeMs;
	}, [pb, accuracy, avgTimeMs]);

	return {pb, sessionNumber, isNewBestAccuracy, isNewBestTime};
}
