import React from 'react';
import type {IconWeight} from 'phosphor-react';

// A wired timer plugs into the audio input. Phosphor has no jack, and its microphone read as
// "records sound". Drawn on Phosphor's 256 grid with its stroke widths, so it sits among them.

const STROKE: Record<IconWeight, number> = {
	thin: 8,
	light: 12,
	regular: 16,
	bold: 24,
	fill: 24,
	duotone: 16,
};

interface Props {
	size?: number;
	weight?: IconWeight;
}

export default function AudioJackIcon({size = 24, weight = 'regular'}: Props) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 256 256"
			fill="none"
			stroke="currentColor"
			strokeWidth={STROKE[weight]}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M108 100V44a20 20 0 0 1 40 0v56" />
			<path d="M108 66h40" />
			<rect x="80" y="100" width="96" height="76" rx="8" />
			<path d="M128 176v24a32 32 0 0 0 32 32h40" />
		</svg>
	);
}
