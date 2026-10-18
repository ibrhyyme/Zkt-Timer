import React from 'react';
import block from '../../../styles/bem';

const b = block('magnet-calibrate-art');

export type CalibrationArtScene = 'steady' | 'sweep' | 'rest' | 'away';

/**
 * Step drawings of the calibration page (design 5.7): the phone seen from above lying on the
 * table, its rear camera marked at the top edge, and the cube. Inline SVG drawn in the theme's
 * colours (currentColor and CSS variables), so light, dark and custom themes all read it; the
 * sweep path moves only without prefers-reduced-motion (MagnetCalibrate.scss).
 */
export default function CalibrationArt({ scene }: { scene: CalibrationArtScene }) {
	const cubeAway = scene === 'steady' || scene === 'away';
	return (
		<svg className={b({ scene })} viewBox="0 0 220 140" role="presentation" aria-hidden="true" focusable="false">
			{/* table line */}
			<line className={b('table')} x1="8" y1="132" x2="212" y2="132" />
			{/* phone, top edge toward the top of the drawing */}
			<rect className={b('phone')} x="70" y="34" width="56" height="96" rx="9" />
			<rect className={b('screen')} x="76" y="42" width="44" height="80" rx="4" />
			{/* rear camera, seen through the phone: a ring at the top corner */}
			<circle className={b('camera')} cx="84" cy="30" r="6" />
			{scene === 'sweep' ? (
				<>
					<path className={b('path')} d="M54 30 C 54 8, 114 8, 114 30 C 114 46, 54 46, 54 30" />
					<g className={b('cube', { moving: true })}>
						<rect x="44" y="12" width="20" height="20" rx="3" />
					</g>
				</>
			) : (
				<g className={b('cube')}>
					{cubeAway ? <rect x="168" y="96" width="26" height="26" rx="4" /> : <rect x="71" y="2" width="26" height="26" rx="4" />}
				</g>
			)}
			{scene === 'away' ? <path className={b('arrow')} d="M104 16 L 160 92 M 160 92 l -10 -2 M 160 92 l -1 -10" /> : null}
		</svg>
	);
}
