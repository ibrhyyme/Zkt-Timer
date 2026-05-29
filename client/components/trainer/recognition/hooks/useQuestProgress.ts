/**
 * useQuestProgress — 13 quest step icin Dexie'den mastery durumunu yukler.
 * Referans `composables/useQuestProgress.js` portu.
 */
import {useCallback, useEffect, useMemo, useState} from 'react';
import {QUEST_STEPS, MASTERY_ACCURACY, poolKeyForStep, type QuestStep} from '../../../../util/trainer/recognition/quest';
import {getPersonalBests} from '../../../../util/trainer/recognition/session_history';
import {SIZE_MEDIUM} from '../../../../util/trainer/recognition/session_sizing';

export interface QuestStepStatus {
	step: QuestStep;
	mastered: boolean;
	bestAccuracy: number | null;
	totalSessions: number;
}

export interface UseQuestProgressResult {
	stepStatuses: QuestStepStatus[];
	currentStepIndex: number;
	currentStep: QuestStep | null;
	masteredCount: number;
	questComplete: boolean;
	progressFraction: number;
	loading: boolean;
	reload: () => Promise<void>;
}

export function useQuestProgress(): UseQuestProgressResult {
	const [stepStatuses, setStepStatuses] = useState<QuestStepStatus[]>([]);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async (isActive: () => boolean = () => true) => {
		setLoading(true);
		const results = await Promise.all(
			QUEST_STEPS.map(async (step) => {
				const poolKey = poolKeyForStep(step);
				const pb = await getPersonalBests(poolKey, SIZE_MEDIUM);
				return {
					step,
					mastered: pb ? pb.bestAccuracy >= MASTERY_ACCURACY : false,
					bestAccuracy: pb ? pb.bestAccuracy : null,
					totalSessions: pb ? pb.totalSessions : 0,
				} as QuestStepStatus;
			})
		);
		// Unmount sonrasi setState'i onle (useSessionPB ile ayni cancelled pattern)
		if (!isActive()) return;
		setStepStatuses(results);
		setLoading(false);
	}, []);

	useEffect(() => {
		let cancelled = false;
		load(() => !cancelled).catch(() => {
			if (!cancelled) setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [load]);

	const currentStepIndex = useMemo(() => {
		const idx = stepStatuses.findIndex((s) => !s.mastered);
		return idx === -1 ? stepStatuses.length : idx;
	}, [stepStatuses]);

	const currentStep = useMemo<QuestStep | null>(() => QUEST_STEPS[currentStepIndex] || null, [currentStepIndex]);
	const masteredCount = useMemo(() => stepStatuses.filter((s) => s.mastered).length, [stepStatuses]);
	const questComplete = masteredCount === QUEST_STEPS.length;
	const progressFraction = QUEST_STEPS.length > 0 ? masteredCount / QUEST_STEPS.length : 0;

	return {stepStatuses, currentStepIndex, currentStep, masteredCount, questComplete, progressFraction, loading, reload: load};
}
