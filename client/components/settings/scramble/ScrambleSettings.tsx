import React from 'react';
import { useTranslation } from 'react-i18next';
import { setSetting, toggleSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import { AllSettings, getDefaultSetting } from '../../../db/settings/query';
import {
	TimerSettingsGroup,
	TimerSettingsToggle,
	TimerSettingsSlider,
} from '../timer/TimerSettingsRow';

export default function ScrambleSettings() {
	const { t } = useTranslation();
	const use2dScramble = useSettings('use_2d_scramble_visual');
	const timerScrambleSize = useSettings('timer_scramble_size');
	const timerScrambleSizeUserDefault = useSettings('timer_scramble_size_user_default');

	// Kullanicinin kayitli default'i varsa onu, yoksa factory/mobile default'i don
	const scrambleSizeDefault = timerScrambleSizeUserDefault ?? getDefaultSetting('timer_scramble_size');

	function updateSetting(name: keyof AllSettings, value: any) {
		setSetting(name, value);
	}

	return (
		<div className="space-y-2">
			<TimerSettingsGroup id="scramble-general" label={t('scramble_settings.category_general')}>
				<TimerSettingsToggle
					label={t('timer_settings.use_3d_scramble_visual')}
					description={t('timer_settings.use_3d_scramble_visual_desc')}
					isActive={!use2dScramble}
					onClick={() => toggleSetting('use_2d_scramble_visual')}
				/>
				<TimerSettingsSlider
					label={t('appearance.scramble_font_size')}
					description={t('appearance.scramble_font_size_desc')}
					value={timerScrambleSize}
					min={10}
					max={40}
					showReset={timerScrambleSize !== scrambleSizeDefault}
					resetLabel={t('appearance.reset')}
					onReset={() => updateSetting('timer_scramble_size', scrambleSizeDefault)}
					restoreDefaultLabel={t('appearance.save_as_default')}
					onRestoreDefault={() => updateSetting('timer_scramble_size_user_default', timerScrambleSize)}
					onChange={(v) => updateSetting('timer_scramble_size', v)}
				>
					<div className="flex items-center justify-center py-2 rounded-lg bg-module overflow-hidden">
						<span
							style={{ fontSize: `${Math.min(timerScrambleSize, 24)}px` }}
							className="text-text text-center leading-relaxed px-2"
						>
							D' R2 B2 R2 U' F2 R2 U' L2 U2 L2 R2 F' D' L D' F' D' F D' R' U
						</span>
					</div>
				</TimerSettingsSlider>
			</TimerSettingsGroup>
		</div>
	);
}
