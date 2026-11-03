import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './PresetBackgroundPicker.scss';
import block from '../../../../styles/bem';
import { useSettings } from '../../../../util/hooks/useSettings';
import { useMe } from '../../../../util/hooks/useMe';
import { useGeneral } from '../../../../util/hooks/useGeneral';
import { getStorageURL } from '../../../../util/storage';
import { resolveTimerBackground } from '../../../../../shared/timer_background';
import TimerVideoBackground from '../../../timer/timer_background/TimerVideoBackground';
import { markFeatureTipSeen } from '../../../../lib/feature_tips/store';
import { setSetting } from '../../../../db/settings/update';
import {
	isPresetBackgroundId,
	PRESET_BACKGROUND_IDS,
	PRESET_STILL_TIME,
} from '../../../timer/timer_background/presets/preset_shaders';
import { createPresetRenderer } from '../../../timer/timer_background/presets/preset_renderer';
import { readThemePalette, watchThemePalette } from '../../../timer/timer_background/presets/theme_colors';

const b = block('preset-background');

const THUMB_W = 320;
const THUMB_H = 180;

/**
 * The ready-made backgrounds as tiles, each drawn as its still frame in the current theme.
 * One hidden WebGL canvas draws all six and copies them into the tiles, so the page holds a
 * single GPU context. The tiles follow a theme change, a colour being dragged included.
 */
export default function PresetBackgroundPicker() {
	const { t } = useTranslation();
	const current = useSettings('timer_bg_preset');
	const selected = isPresetBackgroundId(current) ? current : null;
	const tiles = useRef<Record<string, HTMLCanvasElement | null>>({});
	// The first tile is what the timer shows without a ready-made one: the user's own upload
	// for this kind of screen when there is one, else the plain theme. Naming it "None" while
	// an upload existed left people unsure where their picture went.
	const me = useMe();
	const mobileMode = useGeneral('mobile_mode');
	const upload = resolveTimerBackground(me?.timer_background, mobileMode ? 'mobile' : 'desktop');
	const uploadUrl = upload ? getStorageURL(upload.storage_path) : '';

	// Reaching the backgrounds is what the feature tip was for.
	useEffect(() => {
		markFeatureTipSeen('preset_backgrounds');
	}, []);

	useEffect(() => {
		const source = document.createElement('canvas');
		source.width = THUMB_W;
		source.height = THUMB_H;
		const renderer = createPresetRenderer(source);
		if (!renderer) return undefined;

		let raf = 0;
		const paint = () => {
			raf = 0;
			const palette = readThemePalette();
			for (const id of PRESET_BACKGROUND_IDS) {
				const tile = tiles.current[id];
				if (!tile || !renderer.draw(id, THUMB_W, THUMB_H, PRESET_STILL_TIME, palette)) continue;
				// Copied in the same task as the draw, while the WebGL frame is still readable.
				tile.getContext('2d')?.drawImage(source, 0, 0, tile.width, tile.height);
			}
		};
		const schedule = () => {
			if (!raf) raf = requestAnimationFrame(paint);
		};

		paint();
		const stopWatching = watchThemePalette(schedule);
		return () => {
			stopWatching();
			if (raf) cancelAnimationFrame(raf);
			renderer.dispose();
		};
	}, []);

	return (
		<div className={b()} role="radiogroup" aria-label={t('appearance.preset_bg')}>
			<button
				type="button"
				role="radio"
				aria-checked={!selected}
				className={b('tile', { selected: !selected })}
				onClick={() => setSetting('timer_bg_preset', null)}
			>
				<span className={b('thumb', { none: true })}>
					{uploadUrl && upload.is_video ? (
						<TimerVideoBackground src={uploadUrl} paused className={b('upload')} />
					) : uploadUrl ? (
						<img src={uploadUrl} alt="" className={b('upload')} />
					) : null}
				</span>
				<span className={b('name')}>
					{uploadUrl ? t('appearance.preset_bg_own') : t('appearance.preset_bg_none')}
				</span>
			</button>
			{PRESET_BACKGROUND_IDS.map((id) => (
				<button
					key={id}
					type="button"
					role="radio"
					aria-checked={selected === id}
					className={b('tile', { selected: selected === id })}
					onClick={() => setSetting('timer_bg_preset', id)}
				>
					<canvas
						ref={(el) => {
							tiles.current[id] = el;
						}}
						width={THUMB_W}
						height={THUMB_H}
						className={b('thumb')}
						aria-hidden="true"
					/>
					<span className={b('name')}>{t(`appearance.preset_bg_${id}`)}</span>
				</button>
			))}
		</div>
	);
}
