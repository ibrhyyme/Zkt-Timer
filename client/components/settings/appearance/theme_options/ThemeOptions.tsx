import React, {useState, useEffect} from 'react';
import {useTranslation} from 'react-i18next';
import './ThemeOptions.scss';
import block from '../../../../styles/bem';
import SettingRow from '../../setting/row/SettingRow';
import ColorPicker from '../../../common/color_picker/ColorPicker';
import ThemeOption from './theme_option/ThemeOption';
import {useSettings} from '../../../../util/hooks/useSettings';
import {setSetting} from '../../../../db/settings/update';
import {AllSettings, getDefaultSetting} from '../../../../db/settings/query';
import {APP_THEME_PRESETS, Preset} from '../../../../util/themes/theme_consts';
import Button from '../../../common/button/Button';
import {getAnyColorStringAsRgbString} from '../../../../util/themes/theme_util';
import tinycolor from 'tinycolor2';

const b = block('settings-theme-options');

// RGB string'i HEX'e çevir (ColorPicker için)
function rgbToHex(rgbString: string): string {
	const rgbStringFormatted = getAnyColorStringAsRgbString(rgbString);
	return tinycolor(rgbStringFormatted).toHexString();
}

export default function ThemeOptions() {
	const {t} = useTranslation();
	const primaryColor = useSettings('primary_color');
	const secondaryColor = useSettings('secondary_color');
	const backgroundColor = useSettings('background_color');
	const moduleColor = useSettings('module_color');
	const textColor = useSettings('text_color');
	const buttonColor = useSettings('button_color');

	// Geçici renk değerleri (henüz uygulanmamış)
	const [tempColors, setTempColors] = useState({
		background_color: backgroundColor,
		module_color: moduleColor,
		text_color: textColor,
		button_color: buttonColor,
	});

	const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);

	// Settings değiştiğinde tempColors'ı güncelle
	useEffect(() => {
		setTempColors({
			background_color: backgroundColor,
			module_color: moduleColor,
			text_color: textColor,
			button_color: buttonColor,
		});
	}, [backgroundColor, moduleColor, textColor, buttonColor]);


	// Değişiklik var mı kontrolü
	const hasChanges = 
		tempColors.background_color !== backgroundColor ||
		tempColors.module_color !== moduleColor ||
		tempColors.text_color !== textColor ||
		tempColors.button_color !== buttonColor;



	function updateSetting(name: keyof AllSettings, value: any) {
		setSetting(name, value);
	}

	function updateTempColor(colorKey: string, value: string) {
		setTempColors(prev => ({
			...prev,
			[colorKey]: value
		}));
	}

	function applyChanges() {
		setActiveColorPicker(null);
		Object.keys(tempColors).forEach(key => {
			setSetting(key as keyof AllSettings, tempColors[key]);
		});
	}

	function resetToDefaults() {
		setActiveColorPicker(null);
		const defaultTheme = APP_THEME_PRESETS.dark.values;
		const resetValues = {
			background_color: defaultTheme.background_color,
			module_color: defaultTheme.module_color,
			text_color: defaultTheme.text_color,
			button_color: defaultTheme.button_color,
		};
		setTempColors(resetValues);
		Object.keys(resetValues).forEach(key => {
			setSetting(key as keyof AllSettings, resetValues[key]);
		});
	}

	return (
		<>
			<SettingRow
				vertical
				title={t('theme_options.themes_title')}
				description={t('theme_options.themes_desc')}
			>
				<div className={b('presets')}>
					{Preset.map((key) => (
						<ThemeOption key={key} theme={key} />
					))}
				</div>
			</SettingRow>
			<SettingRow vertical title={t('theme_options.basic_customization')}>
				<div className={b('customize')}>
					<ColorPicker
						openLeft
						hideReset
						isOpen={activeColorPicker === 'primary_color'}
						onToggle={() => setActiveColorPicker(activeColorPicker === 'primary_color' ? null : 'primary_color')}
						name={t('theme_options.primary_color')}
						selectedColorHex={primaryColor}
						resetToRgb={getDefaultSetting('primary_color')}
						onChange={(color) => updateSetting('primary_color', color)}
					/>
					<ColorPicker
						hideReset
						isOpen={activeColorPicker === 'secondary_color'}
						onToggle={() => setActiveColorPicker(activeColorPicker === 'secondary_color' ? null : 'secondary_color')}
						name={t('theme_options.secondary_color')}
						selectedColorHex={secondaryColor}
						resetToRgb={getDefaultSetting('secondary_color')}
						onChange={(color) => updateSetting('secondary_color', color)}
					/>
				</div>
			</SettingRow>
			<SettingRow vertical title={t('theme_options.advanced_customization')}
				description={t('theme_options.advanced_desc')}>
				<div className={b('customize')}>
					<ColorPicker
						openUp
						openLeft
						hideReset
						isOpen={activeColorPicker === 'background_color'}
						onToggle={() => setActiveColorPicker(activeColorPicker === 'background_color' ? null : 'background_color')}
						name={t('theme_options.background_color')}
						selectedColorHex={rgbToHex(tempColors.background_color)}
						resetToRgb={getDefaultSetting('background_color')}
						onChange={(color) => updateTempColor('background_color', color)}
					/>
					<ColorPicker
						openUp
						openLeft
						hideReset
						isOpen={activeColorPicker === 'module_color'}
						onToggle={() => setActiveColorPicker(activeColorPicker === 'module_color' ? null : 'module_color')}
						name={t('theme_options.module_color')}
						selectedColorHex={rgbToHex(tempColors.module_color)}
						resetToRgb={getDefaultSetting('module_color')}
						onChange={(color) => updateTempColor('module_color', color)}
					/>
					<ColorPicker
						openUp
						hideReset
						isOpen={activeColorPicker === 'text_color'}
						onToggle={() => setActiveColorPicker(activeColorPicker === 'text_color' ? null : 'text_color')}
						name={t('theme_options.text_color')}
						selectedColorHex={rgbToHex(tempColors.text_color)}
						resetToRgb={getDefaultSetting('text_color')}
						onChange={(color) => updateTempColor('text_color', color)}
					/>
					<ColorPicker
						openUp
						openLeft
						hideReset
						isOpen={activeColorPicker === 'button_color'}
						onToggle={() => setActiveColorPicker(activeColorPicker === 'button_color' ? null : 'button_color')}
						name={t('theme_options.button_color')}
						selectedColorHex={rgbToHex(tempColors.button_color)}
						resetToRgb={getDefaultSetting('button_color')}
						onChange={(color) => updateTempColor('button_color', color)}
					/>
				</div>
				<div className={b('actions')}>
					<Button 
						primary
						text={t('theme_options.apply_changes')}
						disabled={!hasChanges}
						onClick={applyChanges}
					/>
					<Button 
						warning
						text={t('theme_options.reset_to_defaults')}
						onClick={resetToDefaults}
					/>
				</div>
			</SettingRow>

		{/* Portal artık gerekli değil - Redux modal sistemi kullanıyoruz */}
		</>
	);
}
