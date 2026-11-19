import React from 'react';
import {useTranslation} from 'react-i18next';
import {toggleSetting} from '../../../db/settings/update';
import {useSettings} from '../../../util/hooks/useSettings';
import {TimerSettingsGroup, TimerSettingsToggle} from '../timer/TimerSettingsRow';

/**
 * Every sound the app makes, each with its own switch, under one that silences them all
 * (lib/sounds.ts). Its own section in the settings nav, next to Timer (owner, 2026-11-19).
 */
export default function SoundSettings() {
	const {t} = useTranslation();
	const soundsEnabled = useSettings('sounds_enabled');
	const shortcutHint = useSettings('shortcut_hint');
	const shortcutHintVoice = useSettings('shortcut_hint_voice');
	const inspection = useSettings('inspection');
	const playInspectionSound = useSettings('play_inspection_sound');
	const smartCubeScrambleSound = useSettings('smart_cube_scramble_sound');

	return (
		<div className="space-y-2">
			<TimerSettingsGroup id="sounds" label={t('timer_settings.category_sounds')}>
				<TimerSettingsToggle
					label={t('timer_settings.sounds_enabled')}
					description={t('timer_settings.sounds_enabled_desc')}
					isActive={soundsEnabled}
					onClick={() => toggleSetting('sounds_enabled')}
				/>
				<TimerSettingsToggle
					label={t('timer_settings.shortcut_hint_voice')}
					description={t('timer_settings.shortcut_hint_voice_desc')}
					hidden={!soundsEnabled || !shortcutHint}
					isActive={shortcutHintVoice}
					onClick={() => toggleSetting('shortcut_hint_voice')}
				/>
				<TimerSettingsToggle
					label={t('timer_settings.play_sound')}
					description={t('timer_settings.play_sound_desc')}
					hidden={!soundsEnabled || !inspection}
					isActive={playInspectionSound}
					onClick={() => toggleSetting('play_inspection_sound')}
				/>
				<TimerSettingsToggle
					label={t('timer_settings.smart_cube_scramble_sound')}
					description={t('timer_settings.smart_cube_scramble_sound_desc')}
					hidden={!soundsEnabled}
					isActive={smartCubeScrambleSound}
					onClick={() => toggleSetting('smart_cube_scramble_sound')}
				/>
			</TimerSettingsGroup>
		</div>
	);
}
