/**
 * GuideHint — yanlis cevap sonrasinda gosterilen matching guide karti.
 * lookupGuideHint(case) ile ilgili grup + row index'ini bulur, GuideGroupCard'i highlight ile render eder.
 * Referans `src/components/GuideHint.vue` portu.
 */
import React from 'react';
import GuideGroupCard from './GuideGroupCard';
import {lookupGuideHint, getGuideGroup} from '../../../../util/trainer/recognition/guide_lookup';
import type {PllCase} from '../../../../util/trainer/recognition/scramble';

interface GuideHintProps {
	pllCase: PllCase | null;
}

export default function GuideHint({pllCase}: GuideHintProps) {
	if (!pllCase) return null;
	const hint = lookupGuideHint(pllCase);
	if (!hint) return null;
	const group = getGuideGroup(hint.groupId);
	if (!group) return null;

	return (
		<GuideGroupCard
			group={group}
			highlightRowIndex={hint.rowIndex}
			defaultPatternColumns={6}
		/>
	);
}
