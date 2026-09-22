/**
 * Sticker colours for every puzzle the app draws, in one place.
 *
 * They used to be six separate hard-coded tables, one per renderer, none of them reachable
 * by a user. This section is the only writer; every drawing surface reads the same settings
 * through `useCubePalette`. Each group shows the puzzle it controls in its solved state, so
 * a change is visible in the thing it changes rather than in a row of swatches.
 */

import React, {Suspense, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import ColorPicker from '../../common/color_picker/ColorPicker';
import Button from '../../common/button/Button';
import block from '../../../styles/bem';
import {setSetting, setSettings} from '../../../db/settings/update';
import {AllSettings} from '../../../db/settings/query';
import {getAnyColorStringAsRgb} from '../../../util/themes/theme_util';
import {useCubePalette} from '../../../util/cube_colors/useCubePalette';
import {
	CLOCK_PARTS,
	DEFAULT_CLOCK_COLORS,
	DEFAULT_FTO_COLORS,
	DEFAULT_NXN_COLORS,
	DEFAULT_OUTLINE_COLOR,
	DEFAULT_SQ1_COLORS,
	FTO_FACES,
	NXN_FACES,
	SQ1_FACES,
} from '../../../util/cube_colors/palette';
import {TimerSettingsGroup} from '../timer/TimerSettingsRow';
import './CubeColors.scss';

const NxnRenderer = React.lazy(() => import('../../modules/scramble/NxnRenderer'));
const Sq1Renderer = React.lazy(() => import('../../modules/scramble/Sq1Renderer'));
const ClockRenderer = React.lazy(() => import('../../modules/scramble/ClockRenderer'));
const FtoRenderer = React.lazy(() => import('../../modules/scramble/FtoRenderer'));

const b = block('cube-colors');

/** ColorPicker reports "r, g, b"; everything downstream stores `#rrggbb`. */
function toHex(colorRgb: string): string | null {
	let rgb;
	try {
		rgb = getAnyColorStringAsRgb(colorRgb);
	} catch {
		return null;
	}
	if (!rgb || ![rgb.r, rgb.g, rgb.b].every((c) => Number.isInteger(c) && c >= 0 && c <= 255)) {
		return null;
	}
	return '#' + [rgb.r, rgb.g, rgb.b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

interface SwatchProps {
	id: string;
	label: string;
	color: string;
	openKey: string | null;
	setOpenKey: (key: string | null) => void;
	onPick: (hex: string) => void;
}

function Swatch({id, label, color, openKey, setOpenKey, onPick}: SwatchProps) {
	return (
		<div className={b('swatch')}>
			<ColorPicker
				hideReset
				openUp
				isOpen={openKey === id}
				onToggle={() => setOpenKey(openKey === id ? null : id)}
				name={label}
				selectedColorHex={color}
				onChange={(colorRgb) => {
					const hex = toHex(colorRgb);
					if (hex) onPick(hex);
				}}
			/>
			<span className={b('swatch-label')}>{label}</span>
		</div>
	);
}

export default function CubeColors() {
	const {t} = useTranslation();
	const palette = useCubePalette();
	// One picker open at a time. Two open panels overlap, and the second one's click-away
	// fires through the first.
	const [openKey, setOpenKey] = useState<string | null>(null);
	// The previews are canvases behind React.lazy, and this page is server-rendered.
	// ReactDOMServer on React 17 cannot render Suspense at all, and a canvas has nothing to
	// say on the server anyway, so they are mounted after hydration. The placeholder keeps
	// its box so the layout does not jump when they arrive.
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	function setEntry(key: keyof AllSettings, current: string[], index: number, hex: string) {
		const next = [...current];
		next[index] = hex;
		setSetting(key, next as any);
	}

	function resetAll() {
		// One write, not five: platform settings persist as a whole blob, so separate calls
		// would each serialise and send the entire set.
		setSettings({
			cube_face_colors: DEFAULT_NXN_COLORS,
			sq1_face_colors: DEFAULT_SQ1_COLORS,
			clock_colors: DEFAULT_CLOCK_COLORS,
			fto_face_colors: DEFAULT_FTO_COLORS,
			cube_outline_color: DEFAULT_OUTLINE_COLOR,
		});
		setOpenKey(null);
	}

	const preview = (node: React.ReactNode) => (
		<div className={b('preview')}>
			{mounted ? <Suspense fallback={null}>{node}</Suspense> : null}
		</div>
	);

	return (
		<div className={b()}>
			<TimerSettingsGroup
				label={t('colors.nxn')}
				searchText={NXN_FACES.map((f) => t('colors.face_' + f.toLowerCase()))}
			>
				<div className={b('block')}>
					<p className={b('hint')}>{t('colors.nxn_desc')}</p>
					{preview(<NxnRenderer size={3} scramble="" className={b('preview-canvas')} />)}
					<div className={b('swatches')}>
						{NXN_FACES.map((face, i) => (
							<Swatch
								key={face}
								id={'nxn-' + face}
								label={t('colors.face_' + face.toLowerCase())}
								color={palette.nxn[i]}
								openKey={openKey}
								setOpenKey={setOpenKey}
								onPick={(hex) => setEntry('cube_face_colors', palette.nxn, i, hex)}
							/>
						))}
					</div>
					<Button gray onClick={() => setSetting('cube_face_colors', DEFAULT_NXN_COLORS)}>
						{t('colors.reset_group')}
					</Button>
				</div>
			</TimerSettingsGroup>

			<TimerSettingsGroup label={t('colors.sq1')} searchText={['Square-1', 'sq1']}>
				<div className={b('block')}>
					{preview(<Sq1Renderer scramble="" className={b('preview-canvas')} baseWidth={16} />)}
					<div className={b('swatches')}>
						{SQ1_FACES.map((face, i) => (
							<Swatch
								key={face}
								id={'sq1-' + face}
								label={t('colors.face_' + face.toLowerCase())}
								color={palette.sq1[i]}
								openKey={openKey}
								setOpenKey={setOpenKey}
								onPick={(hex) => setEntry('sq1_face_colors', palette.sq1, i, hex)}
							/>
						))}
					</div>
					<Button gray onClick={() => setSetting('sq1_face_colors', DEFAULT_SQ1_COLORS)}>
						{t('colors.reset_group')}
					</Button>
				</div>
			</TimerSettingsGroup>

			<TimerSettingsGroup label={t('colors.clock')} searchText={['Clock']}>
				<div className={b('block')}>
					{preview(<ClockRenderer scramble="" className={b('preview-canvas', {clock: true})} />)}
					<div className={b('swatches')}>
						{CLOCK_PARTS.map((part, i) => (
							<Swatch
								key={part}
								id={'clock-' + part}
								label={t('colors.clock_' + part)}
								color={palette.clock[i]}
								openKey={openKey}
								setOpenKey={setOpenKey}
								onPick={(hex) => setEntry('clock_colors', palette.clock, i, hex)}
							/>
						))}
					</div>
					<Button gray onClick={() => setSetting('clock_colors', DEFAULT_CLOCK_COLORS)}>
						{t('colors.reset_group')}
					</Button>
				</div>
			</TimerSettingsGroup>

			<TimerSettingsGroup label={t('colors.fto')} searchText={['FTO', 'Octahedron']}>
				<div className={b('block')}>
					{preview(<FtoRenderer scramble="" renderType="fto" className={b('preview-canvas')} />)}
					<div className={b('swatches')}>
						{FTO_FACES.map((face, i) => (
							<Swatch
								key={face}
								id={'fto-' + face}
								label={face}
								color={palette.fto[i]}
								openKey={openKey}
								setOpenKey={setOpenKey}
								onPick={(hex) => setEntry('fto_face_colors', palette.fto, i, hex)}
							/>
						))}
					</div>
					<Button gray onClick={() => setSetting('fto_face_colors', DEFAULT_FTO_COLORS)}>
						{t('colors.reset_group')}
					</Button>
				</div>
			</TimerSettingsGroup>

			<TimerSettingsGroup label={t('colors.outline')} searchText={['Outline']}>
				<div className={b('block')}>
					<p className={b('hint')}>{t('colors.outline_desc')}</p>
					<div className={b('swatches')}>
						<Swatch
							id="outline"
							label={t('colors.outline')}
							color={palette.outline}
							openKey={openKey}
							setOpenKey={setOpenKey}
							onPick={(hex) => setSetting('cube_outline_color', hex)}
						/>
					</div>
					<Button gray onClick={() => setSetting('cube_outline_color', DEFAULT_OUTLINE_COLOR)}>
						{t('colors.reset_group')}
					</Button>
				</div>
			</TimerSettingsGroup>

			<div className={b('footer')}>
				<Button danger onClick={resetAll}>
					{t('colors.reset_all')}
				</Button>
			</div>
		</div>
	);
}
