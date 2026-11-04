import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../../common/button/Button';
import { useTiles } from '../../timer/tiles/useTiles';
import TimerBackground, { useTimerBackgroundMobileSame } from './timer_background/TimerBackground';
import PresetBackgroundPicker from './preset_background/PresetBackgroundPicker';
import { isPresetBackgroundId } from '../../timer/timer_background/presets/preset_shaders';
import { setSetting, toggleSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import ThemeOptions from './theme_options/ThemeOptions';
import SettingRow from '../setting/row/SettingRow';
import SolveListColors from './solve_list_colors/SolveListColors';
import { APP_THEME_PRESETS } from '../../../util/themes/theme_consts';
import { canUseStreamerMode } from '../../../lib/streamer-mode';
import { useMe } from '../../../util/hooks/useMe';
import { isPro } from '../../../lib/pro';
import { AllSettings } from '../../../db/settings/query';
import { useGeneral } from '../../../util/hooks/useGeneral';
import {
	TimerSettingsGroup,
	TimerSettingsSelect,
	TimerSettingsAction,
	TimerSettingsToggle,
} from '../timer/TimerSettingsRow';

// Preset names are not translated, so searching "tokyo" or "cyberpunk" has to reach
// the theme block through the group's own searchable text.
const THEME_SEARCH_TEXT = Object.values(APP_THEME_PRESETS).map((preset) => preset.name);

export default function Appearance() {
	const { t } = useTranslation();
	const { resetLayout } = useTiles();
	const highlightPbs = useSettings('highlight_pbs');
	const streamerMode = useSettings('streamer_mode');
	const mobileMode = useGeneral('mobile_mode');
	const me = useMe();
	const [backgroundMobileSame, toggleBackgroundMobileSame] = useTimerBackgroundMobileSame();
	const backgroundPreset = useSettings('timer_bg_preset');
	const backgroundMotion = useSettings('timer_bg_motion');

	function updateSetting(name: keyof AllSettings, value: any) {
		setSetting(name, value);
	}

	return (
		<div className="space-y-2">
			{/* Tema */}
			<TimerSettingsGroup
				id="appearance-theme"
				label={t('appearance.category_theme')}
				// ThemeOptions draws its own rows, so the group filter has no label or
				// description to read off a child. Without this the whole theme block was
				// unreachable from the search box.
				searchText={THEME_SEARCH_TEXT}
			>
				{/* Everything about the timer background opens the theme block, above the themes,
				    in one place (owner, 2026-11-03): ready-made first, your own upload under it.
				    Ready-made backgrounds are free and stored per device kind (a platform setting),
				    so the phone keeps its own pick; visitors get them too. One chosen hides the
				    upload, and the picker's first tile is the upload itself when there is one. */}
				<TimerSettingsAction
					label={t('appearance.preset_bg')}
					description={t('appearance.preset_bg_desc')}
					stackOnMobile
				>
					<PresetBackgroundPicker />
				</TimerSettingsAction>
				<TimerSettingsToggle
					label={t('appearance.preset_bg_motion')}
					description={t('appearance.preset_bg_motion_desc')}
					hidden={!isPresetBackgroundId(backgroundPreset)}
					isActive={backgroundMotion !== false}
					onClick={() => setSetting('timer_bg_motion', backgroundMotion === false)}
				/>
				{/* Desktop and mobile each have an upload slot, stored on the account so every
				    device of a kind shows the same one. The phone follows the desktop slot until
				    "use the same on mobile" is switched off. Pro. */}
				<TimerSettingsAction
					label={t('appearance.timer_background')}
					description={t('appearance.timer_background_desc')}
					stackOnMobile
				>
					<TimerBackground target="desktop" />
				</TimerSettingsAction>
				<TimerSettingsToggle
					label={t('appearance.timer_background_mobile_same')}
					description={t('appearance.timer_background_mobile_same_desc')}
					hidden={!isPro(me)}
					isActive={backgroundMobileSame}
					onClick={toggleBackgroundMobileSame}
				/>
				<TimerSettingsAction
					label={t('appearance.timer_background_mobile')}
					description={t('appearance.timer_background_mobile_desc')}
					hidden={!isPro(me) || backgroundMobileSame}
					stackOnMobile
				>
					<TimerBackground target="mobile" />
				</TimerSettingsAction>
				{/* A visitor wears the fixed theme (util/themes/theme_lock.ts, E-106): the choice
				    belongs to an account. */}
				{me ? (
					<ThemeOptions />
				) : (
					<SettingRow title={t('theme_options.themes_title')} description={t('theme_options.login_to_choose')}>
						<Button text={t('nav.login')} to="/login" />
					</SettingRow>
				)}
			</TimerSettingsGroup>

			{/* Düzen */}
			<TimerSettingsGroup id="appearance-layout" label={t('appearance.category_layout')}>
				{/* How many modules are on screen is no longer a number here: each module is
				    placed (or removed) on the timer itself. These two rows are what is left,
				    a bulk "put everything in one column" and the way back out. */}
				{/* No left/centre/right control any more. A module carries its own place, so
				    a single global alignment would only fight what the user arranged. What
				    is left is the way back to the starting arrangement. */}
				<TimerSettingsAction
					label={t('timer_tiles.reset_layout')}
					description={`${t('timer_tiles.layout_hint')} ${t('timer_tiles.reset_layout_desc')}`}
					hidden={!!mobileMode}
				>
					<Button gray text={t('timer_tiles.reset_layout')} onClick={resetLayout} />
				</TimerSettingsAction>
			</TimerSettingsGroup>

			{/* Listeler */}
			<TimerSettingsGroup id="appearance-lists" label={t('appearance.category_lists')}>
				<TimerSettingsSelect
					label={t('appearance.highlight_pbs')}
					description={t('appearance.highlight_pbs_desc')}
					value={highlightPbs}
					options={[
						{ label: t('appearance.highlight_off'), value: 'off' },
						{ label: t('appearance.highlight_color'), value: 'color' },
						{ label: t('appearance.highlight_bold'), value: 'bold' },
					]}
					onChange={(v) => updateSetting('highlight_pbs', v)}
				/>
				<SolveListColors
					label={t('appearance.solve_colors')}
					description={t('appearance.solve_colors_desc')}
					showPb={highlightPbs === 'color'}
				/>
				<TimerSettingsToggle
					label={t('appearance.streamer_mode')}
					description={t('appearance.streamer_mode_desc')}
					isActive={!!streamerMode}
					// Permission-gated: the mode hides identifying data for people who
					// stream, and is not offered to accounts without that permission.
					hidden={!canUseStreamerMode(me)}
					onClick={() => toggleSetting('streamer_mode')}
				/>
			</TimerSettingsGroup>
		</div>
	);
}
