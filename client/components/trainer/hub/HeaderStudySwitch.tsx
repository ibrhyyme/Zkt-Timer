/**
 * HeaderStudySwitch: the study mode switch as the Algorithm Trainer header draws it
 * (trainer-sets 2.2). Desktop: the full switch on the tabs and in training. Mobile: only a small
 * chip in training; on the Algorithms tab the full switch sits under the tabs instead (Trainer.tsx),
 * and the set page draws its own next to "Study".
 */
import React from 'react';
import {useTrainerContext} from '../TrainerContext';
import {useGeneral} from '../../../util/hooks/useGeneral';
import {studySwitchPlacement} from './hub_rules';
import StudyModeSwitch from './StudyModeSwitch';

export default function HeaderStudySwitch() {
	const {state} = useTrainerContext();
	const mobileMode = useGeneral('mobile_mode');
	const placement = studySwitchPlacement(state.view, mobileMode);

	if (placement === 'header') return <StudyModeSwitch />;
	if (placement === 'chip') return <StudyModeSwitch variant="chip" />;
	return null;
}
