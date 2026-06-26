import React from 'react';
import { useTranslation } from 'react-i18next';
import { setSetting, toggleSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import { AllSettings, getDefaultSetting } from '../../../db/settings/query';
import {
	TimerSettingsGroup,
	TimerSettingsToggle,
	TimerSettingsSelect,
	TimerSettingsSlider,
} from '../timer/TimerSettingsRow';

export default function ScrambleSettings() {
	const { t } = useTranslation();
	const use2dScramble = useSettings('use_2d_scramble_visual');
	const scrambleMonospace = useSettings('scramble_monospace');
	const scrambleAlignment = useSettings('scramble_alignment');
	const scrambleClickAction = useSettings('scramble_click_action');
	const scrambleColorNeutral = useSettings('scramble_color_neutral');
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
				<TimerSettingsToggle
					label={t('scramble_settings.monospace')}
					description={t('scramble_settings.monospace_desc')}
					isActive={scrambleMonospace}
					onClick={() => toggleSetting('scramble_monospace')}
				/>
				<TimerSettingsSelect
					label={t('scramble_settings.alignment')}
					description={t('scramble_settings.alignment_desc')}
					value={scrambleAlignment}
					options={[
						{ label: t('scramble_settings.align_left'), value: 'left' },
						{ label: t('scramble_settings.align_center'), value: 'center' },
						{ label: t('scramble_settings.align_right'), value: 'right' },
					]}
					onChange={(v) => updateSetting('scramble_alignment', v)}
				/>
				<TimerSettingsSelect
					label={t('scramble_settings.click_action')}
					description={t('scramble_settings.click_action_desc')}
					value={scrambleClickAction}
					options={[
						{ label: t('scramble_settings.click_none'), value: 'none' },
						{ label: t('scramble_settings.click_copy'), value: 'copy' },
						{ label: t('scramble_settings.click_next'), value: 'next' },
					]}
					onChange={(v) => updateSetting('scramble_click_action', v)}
				/>
				<TimerSettingsSelect
					label={t('scramble_settings.color_neutral')}
					description={t('scramble_settings.color_neutral_desc')}
					value={scrambleColorNeutral}
					options={[
						{ label: t('scramble_settings.cn_none'), value: 'none' },
						{ label: t('scramble_settings.cn_dual'), value: 'dual' },
						{ label: t('scramble_settings.cn_six'), value: 'six' },
					]}
					onChange={(v) => updateSetting('scramble_color_neutral', v)}
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
							style={{
								fontSize: `${Math.min(timerScrambleSize, 24)}px`,
								fontFamily: scrambleMonospace ? "'Roboto Mono', monospace" : undefined,
								textAlign: scrambleAlignment,
								width: '100%',
							}}
							className="text-text leading-relaxed px-2"
						>
							D' R2 B2 R2 U' F2 R2 U' L2 U2 L2 R2 F' D' L D' F' D' F D' R' U
						</span>
					</div>
				</TimerSettingsSlider>
			</TimerSettingsGroup>
		</div>
	);
}
