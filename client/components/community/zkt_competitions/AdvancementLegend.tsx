import React from 'react';
import {useTranslation} from 'react-i18next';

// Color key for the live results tables: explains what the green / orange / plain
// rows mean, so on-site competitors understand "why am I green" at a glance.
// Matches the row colors in ZktCompetitions.scss / AdminZktCompetitions.scss:
//   green  = clinched (guaranteed to advance)
//   orange = questionable (currently advancing, not yet guaranteed)
//   plain  = currently out.
const DOT: Record<string, React.CSSProperties> = {
	clinched: {background: '#00c853'},
	questionable: {background: '#ffb300'},
	out: {background: 'transparent', border: '1px solid rgba(128, 128, 128, 0.6)'},
};

export default function AdvancementLegend({large}: {large?: boolean}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});

	const dotSize = large ? 14 : 10;
	const item: React.CSSProperties = {
		display: 'inline-flex',
		alignItems: 'center',
		gap: 6,
	};
	const dotBase: React.CSSProperties = {
		width: dotSize,
		height: dotSize,
		borderRadius: 4,
		flexShrink: 0,
	};

	return (
		<div
			style={{
				display: 'flex',
				flexWrap: 'wrap',
				gap: large ? 20 : 14,
				alignItems: 'center',
				fontSize: large ? '1.1rem' : '0.85rem',
				fontWeight: 600,
				margin: large ? '0.25rem 0 0.75rem' : '0.25rem 0 0.5rem',
			}}
		>
			<span style={item}>
				<span style={{...dotBase, ...DOT.clinched}} />
				{t('legend_clinched')}
			</span>
			<span style={item}>
				<span style={{...dotBase, ...DOT.questionable}} />
				{t('legend_questionable')}
			</span>
			<span style={item}>
				<span style={{...dotBase, ...DOT.out}} />
				{t('legend_out')}
			</span>
		</div>
	);
}
