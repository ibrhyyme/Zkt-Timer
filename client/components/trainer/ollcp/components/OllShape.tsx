/**
 * OllShape — the OLL orientation mini-diagram (yellow shape only) for the OLL list.
 * Reuses LLPatternView with OLL stickering. topFace='D'/frontFace='F' yields the
 * yellow-top / orange-right scheme (matches the standalone reco reference).
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
