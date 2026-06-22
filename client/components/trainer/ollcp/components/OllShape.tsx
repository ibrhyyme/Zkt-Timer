/**
 * OllShape — the OLL orientation mini-diagram for the OLL list. Reuses LLPatternView with OLL
 * stickering, white-on-bottom orientation (topFace='D' → yellow last layer, how the user solves).
 */
import React from 'react';
import LLPatternView from '../../panels/LLPatternView';

interface Props {
	pattern: string;
	size?: number;
}

export default function OllShape({pattern, size = 64}: Props) {
	return <LLPatternView pattern={pattern} topFace="D" frontFace="F" stickering="OLL" size={size} />;
}
