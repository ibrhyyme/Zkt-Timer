// Two schematic diagrams for the help page. Deliberately inline SVG rather than
// screenshots: screenshots go stale with every redesign and cannot be translated,
// while these read from `currentColor` and take their labels from i18n, so they
// stay correct in five languages and in both themes.

import React from 'react';
import {useTranslation} from 'react-i18next';
import './LayoutDiagrams.scss';
import block from '../../../styles/bem';

const b = block('landing-help-diagram');

// Shared geometry so both diagrams line up visually.
const R = 6;

function Region(props: {x: number; y: number; w: number; h: number; label: string; dim?: boolean}) {
	const {x, y, w, h, label, dim} = props;
	return (
		<g className={b('region', {dim})}>
			<rect x={x} y={y} width={w} height={h} rx={R} />
			<text x={x + w / 2} y={y + h / 2} dominantBaseline="middle" textAnchor="middle">
				{label}
			</text>
		</g>
	);
}

export function DesktopLayoutDiagram() {
	const {t} = useTranslation();

	return (
		<figure className={b()}>
			<svg viewBox="0 0 360 232" role="img" aria-label={t('help.diagram.desktop_alt')}>
				<rect className={b('frame')} x="1" y="1" width="358" height="230" rx="10" />

				{/* Top row: the three pickers */}
				<Region x={12} y={14} w={100} h={26} label={t('help.diagram.session')} />
				<Region x={120} y={14} w={100} h={26} label={t('help.diagram.cube_type')} />
				<Region x={228} y={14} w={100} h={26} label={t('help.diagram.timer_type')} />

				<Region x={12} y={50} w={336} h={26} label={t('help.diagram.scramble')} />
				<Region x={12} y={84} w={336} h={64} label={t('help.diagram.timer_area')} />

				{/* Bottom modules */}
				<Region x={12} y={156} w={164} h={62} label={t('help.diagram.solve_list')} dim />
				<Region x={184} y={156} w={164} h={62} label={t('help.diagram.modules')} dim />
			</svg>
			<figcaption>{t('help.diagram.desktop_caption')}</figcaption>
		</figure>
	);
}

export function MobileNotchDiagram() {
	const {t} = useTranslation();

	return (
		<figure className={b()}>
			<svg viewBox="0 0 360 232" role="img" aria-label={t('help.diagram.mobile_alt')}>
				<rect className={b('frame')} x="110" y="1" width="140" height="230" rx="16" />

				<Region x={122} y={16} w={116} h={22} label={t('help.diagram.scramble')} />
				<Region x={122} y={48} w={116} h={54} label={t('help.diagram.timer_area')} />
				<Region x={122} y={112} w={116} h={104} label={t('help.diagram.solve_list')} dim />

				{/* The notches themselves, drawn on the frame edges */}
				<rect className={b('notch')} x="106" y="96" width="8" height="42" rx="4" />
				<rect className={b('notch')} x="246" y="96" width="8" height="42" rx="4" />

				{/* Callouts pointing outward from each notch */}
				<line className={b('leader')} x1="104" y1="117" x2="70" y2="117" />
				<text className={b('callout')} x="66" y="117" dominantBaseline="middle" textAnchor="end">
					{t('help.diagram.left_notch')}
				</text>

				<line className={b('leader')} x1="256" y1="117" x2="290" y2="117" />
				<text className={b('callout')} x="294" y="117" dominantBaseline="middle" textAnchor="start">
					{t('help.diagram.right_notch')}
				</text>
			</svg>
			<figcaption>{t('help.diagram.mobile_caption')}</figcaption>
		</figure>
	);
}
