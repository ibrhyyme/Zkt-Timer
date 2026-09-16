import React, {useState, useEffect, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import './ThemeOptions.scss';
import block from '../../../../styles/bem';
import SettingRow from '../../setting/row/SettingRow';
import ColorPicker from '../../../common/color_picker/ColorPicker';
import ThemeOption from './theme_option/ThemeOption';
import {useSettings} from '../../../../util/hooks/useSettings';
import {setSetting, setSettings} from '../../../../db/settings/update';
import {AllSettings, getDefaultSetting} from '../../../../db/settings/query';
import {APP_THEME_PRESETS, Preset} from '../../../../util/themes/theme_consts';
import Button from '../../../common/button/Button';
import {getAnyColorStringAsRgbString} from '../../../../util/themes/theme_util';
import {previewThemeColor} from '../../../layout/themes';
import tinycolor from 'tinycolor2';

type BasicColorKey = 'primary_color' | 'secondary_color';

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

	// Primary/secondary have no separate "Apply" button, so unlike tempColors above, these
	// commit when their picker closes instead of on an explicit button click (the drag
	// itself is the whole interaction). Kept in a ref (not state) for the same reason
	// SolveListColors does: a click-away reports its colour and closes in the same tick,
	// before a state update from the first call would be visible to the second.
	const basicDrafts = useRef<Partial<Record<BasicColorKey, string>>>({});
	// Set for the rest of the click that pressed "reset to defaults". An open picker's
	// click-away handler still fires for that same click (its listener is a raw
	// document listener refreshed in a passive effect, so it holds the pre-reset
	// closure) and would otherwise re-apply the pre-reset drag over the just-reset
	// values (see SolveListColors' identical guard).
	const resetting = useRef(false);

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



	function updateTempColor(colorKey: string, value: string) {
		if (resetting.current) return;
		setTempColors(prev => ({
			...prev,
			[colorKey]: value
		}));
	}

	// Colours live in one prefs blob server-side, so they go out as a single write.
	// Writing them key by key raced and could persist a half-applied theme.
	function applyChanges() {
		setActiveColorPicker(null);
		setSettings(tempColors as Partial<AllSettings>);
	}

	// Live preview only: repaints the CSS variable instantly without touching the
	// settings store. Mirrors SolveListColors' `pick`: every drag step used to call
	// setSetting directly, which is a server write per pixel of drag.
	function previewBasicColor(key: BasicColorKey, color: string) {
		if (resetting.current) return;
		basicDrafts.current = {...basicDrafts.current, [key]: color};
		previewThemeColor(key, color);
	}

	// Committed when the picker closes, not on every drag step (see previewBasicColor).
	function commitBasicColor(key: BasicColorKey) {
		if (resetting.current) return;
		const draft = basicDrafts.current[key];
		if (draft === undefined) return;
		const rest = {...basicDrafts.current};
		delete rest[key];
		basicDrafts.current = rest;

		const current = key === 'primary_color' ? primaryColor : secondaryColor;
		// Opening and closing a picker without dragging reports the colour unchanged.
		if (draft !== current) {
			setSetting(key, draft);
		}
	}

	// Single toggle for all six pickers (only one open at a time via activeColorPicker).
	// Switching away from an open primary/secondary picker, to another picker or to
	// nothing, has to commit its draft first, since those two have no Apply button.
	function togglePicker(key: string) {
		if (resetting.current) return;
		if (activeColorPicker === 'primary_color' || activeColorPicker === 'secondary_color') {
			commitBasicColor(activeColorPicker);
		}
		setActiveColorPicker(activeColorPicker === key ? null : key);
	}

	function resetToDefaults() {
		// See the `resetting` ref comment above: swallows a same-click stale handler from
		// an open picker (basic or advanced) for the rest of this tick.
		resetting.current = true;
		setTimeout(() => {
			resetting.current = false;
		}, 0);

		setActiveColorPicker(null);
		basicDrafts.current = {};

		const defaultTheme = APP_THEME_PRESETS.dark.values;
		const resetValues = {
			background_color: defaultTheme.background_color,
			module_color: defaultTheme.module_color,
			text_color: defaultTheme.text_color,
			button_color: defaultTheme.button_color,
		};
		setTempColors(resetValues);
		setSettings(resetValues);
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
						onToggle={() => togglePicker('primary_color')}
						name={t('theme_options.primary_color')}
						selectedColorHex={primaryColor}
						resetToRgb={getDefaultSetting('primary_color')}
						onChange={(color) => previewBasicColor('primary_color', color)}
					/>
					<ColorPicker
						hideReset
						isOpen={activeColorPicker === 'secondary_color'}
						onToggle={() => togglePicker('secondary_color')}
						name={t('theme_options.secondary_color')}
						selectedColorHex={secondaryColor}
						resetToRgb={getDefaultSetting('secondary_color')}
						onChange={(color) => previewBasicColor('secondary_color', color)}
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
						onToggle={() => togglePicker('background_color')}
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
						onToggle={() => togglePicker('module_color')}
						name={t('theme_options.module_color')}
						selectedColorHex={rgbToHex(tempColors.module_color)}
						resetToRgb={getDefaultSetting('module_color')}
						onChange={(color) => updateTempColor('module_color', color)}
					/>
					<ColorPicker
						openUp
						hideReset
						isOpen={activeColorPicker === 'text_color'}
						onToggle={() => togglePicker('text_color')}
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
						onToggle={() => togglePicker('button_color')}
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
