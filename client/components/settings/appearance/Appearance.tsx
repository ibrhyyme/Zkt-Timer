import React from 'react';
import { useTranslation } from 'react-i18next';
import { getTimeString } from '../../../util/time';
import LayoutSelector from './layout_selector/LayoutSelector';
import TimerBackground from './timer_background/TimerBackground';
import { setSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import ThemeOptions from './theme_options/ThemeOptions';
import { AllSettings, getDefaultSetting } from '../../../db/settings/query';
import { useGeneral } from '../../../util/hooks/useGeneral';
import {
	TimerSettingsGroup,
	TimerSettingsSelect,
	TimerSettingsAction,
	TimerSettingsSlider,
} from '../timer/TimerSettingsRow';

const DEFAULT_FONT_FAMILY = 'Roboto Mono';

const FONT_FAMILIES = [
	DEFAULT_FONT_FAMILY,
	'Fira Sans',
	'Fira Mono',
	'Kiwi Maru',
	'JetBrains Mono',
	'Poppins',
	'Montserrat',
	'Space Mono',
	'Arial',
	'monospace',
];

export default function Appearance() {
	const { t } = useTranslation();
	const timerTimeSize = useSettings('timer_time_size');
	const timerTimeSizeUserDefault = useSettings('timer_time_size_user_default');
	const timerDecimalPoints = useSettings('timer_decimal_points');
	const timerFontFamily = useSettings('timer_font_family');
	const timerModuleCount = useSettings('timer_module_count');
	const mobileMode = useGeneral('mobile_mode');

	function updateSetting(name: keyof AllSettings, value: any) {
		setSetting(name, value);
	}

	// Kullanicinin kayitli default'i varsa onu, yoksa factory/mobile default'i don
	const timeSizeDefault = timerTimeSizeUserDefault ?? getDefaultSetting('timer_time_size');

	return (
		<div className="space-y-2">
			{/* Tema */}
			<TimerSettingsGroup id="appearance-theme" label={t('appearance.category_theme')}>
				<ThemeOptions />
			</TimerSettingsGroup>

			{/* Düzen */}
			<TimerSettingsGroup id="appearance-layout" label={t('appearance.category_layout')}>
				<TimerSettingsSelect
					label={t('appearance.timer_modules')}
					description={t('appearance.timer_modules_desc')}
					hidden={!!mobileMode}
					value={String(timerModuleCount)}
					options={[1, 2, 3, 4, 5, 6].map((c) => ({
						label: c === 3 ? `${c} ${t('appearance.default_suffix')}` : String(c),
						value: String(c),
					}))}
					onChange={(v) => updateSetting('timer_module_count', parseInt(v))}
				/>
				<TimerSettingsAction
					label={t('appearance.timer_layout')}
					description={t('appearance.timer_layout_desc')}
					hidden={!!mobileMode}
				>
					<LayoutSelector />
				</TimerSettingsAction>
				<TimerSettingsAction
					label={t('appearance.timer_background')}
					description={t('appearance.timer_background_desc')}
				>
					<TimerBackground />
				</TimerSettingsAction>
			</TimerSettingsGroup>

			{/* Yazı Tipi */}
			<TimerSettingsGroup id="appearance-typography" label={t('appearance.category_typography')}>
				<TimerSettingsSelect
					label={t('appearance.timer_font')}
					description={t('appearance.timer_font_desc')}
					value={timerFontFamily}
					options={FONT_FAMILIES.map((ff) => ({
						label: ff,
						value: ff,
					}))}
					onChange={(v) => updateSetting('timer_font_family', v)}
				/>
				<TimerSettingsSlider
					label={t('appearance.timer_font_size')}
					description={t('appearance.timer_font_size_desc')}
					hidden={!!mobileMode}
					value={timerTimeSize}
					min={35}
					max={150}
					showReset={timerTimeSize !== timeSizeDefault}
					resetLabel={t('appearance.reset')}
					onReset={() => updateSetting('timer_time_size', timeSizeDefault)}
					restoreDefaultLabel={t('appearance.save_as_default')}
					onRestoreDefault={() => updateSetting('timer_time_size_user_default', timerTimeSize)}
					onChange={(v) => updateSetting('timer_time_size', v)}
				>
					<div className="flex items-center justify-center py-2 rounded-lg bg-module overflow-hidden">
						<span
							style={{
								fontWeight: '500',
								fontFamily: timerFontFamily,
								fontSize: `${Math.min(timerTimeSize, 80)}px`,
							}}
							className="text-text"
						>
							{getTimeString(23.074, timerDecimalPoints)}
						</span>
					</div>
				</TimerSettingsSlider>
			</TimerSettingsGroup>
		</div>
	);
}
