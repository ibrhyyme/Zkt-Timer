import React from 'react';
import Timer from './Timer';
import {useSettings} from '../../util/hooks/useSettings';
import {useSolveDb} from '../../util/hooks/useSolveDb';

export default function DefaultTimer() {
	const cubeType = useSettings('cube_type');
	const scrambleSubset = useSettings('scramble_subset');
	const sessionId = useSettings('session_id');

	useSolveDb();

	const timerSolveData: Record<string, any> = {
		session_id: sessionId,
		from_timer: true,
		cube_type: cubeType,
	};

	// cube_type='wca' subset'siz duremez — kullanici WCA secip subset seciyor, her zaman filtrele
	// Diger cube_type'larda subset opsiyonel — sadece secilmisse filtrele
	if (cubeType === 'wca' || scrambleSubset) {
		timerSolveData.scramble_subset = scrambleSubset || null;
	}

	return <Timer solvesFilter={timerSolveData} />;
}
