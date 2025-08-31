import React from 'react';
import './ThemeOptions.scss';
import block from '../../../../styles/bem';
import SettingRow from '../../setting/row/SettingRow';
import ColorPicker from '../../../common/color_picker/ColorPicker';
import {useSettings} from '../../../../util/hooks/useSettings';
import {setSetting} from '../../../../db/settings/update';
import ThemeOption from './theme_option/ThemeOption';
import {AllSettings, getDefaultSetting} from '../../../../db/settings/query';
import {APP_THEME_PRESETS} from '../../../../util/themes/theme_consts';

const b = block('settings-theme-options');

export default function ThemeOptions() {
	const primaryColor = useSettings('primary_color');
	const secondaryColor = useSettings('secondary_color');
	const backgroundColor = useSettings('background_color');
	const moduleColor = useSettings('module_color');
	const textColor = useSettings('text_color');
	const buttonColor = useSettings('button_color');

	function updateSetting(name: keyof AllSettings, value: any) {
		setSetting(name, value);
	}

	return (
		<>
			<SettingRow vertical title="Temel tema özelleştirmesi">
				<div className={b('customize')}>
											<ColorPicker
							hideReset
							name="Ana renk"
							selectedColorHex={primaryColor}
							resetToRgb={getDefaultSetting('primary_color')}
							onChange={(color) => updateSetting('primary_color', color)}
						/>
											<ColorPicker
							hideReset
							name="İkincil renk"
							selectedColorHex={secondaryColor}
							resetToRgb={getDefaultSetting('secondary_color')}
							onChange={(color) => updateSetting('secondary_color', color)}
						/>
				</div>
			</SettingRow>
			<SettingRow
				vertical
							title="Temalar"
			description="Önceden tanımlanmış tema listesinden seçin veya aşağıdaki bölümde kendinizinkini özelleştirin. *Uyarı*: Bu temalardan birini seçmek, belirlemiş olabileceğiniz özel tema ayarlarını sıfırlayacaktır."
			>
				<div className={b('presets')}>
					{Object.keys(APP_THEME_PRESETS).map((themeKey) => (
						<ThemeOption key={themeKey} theme={themeKey as keyof typeof APP_THEME_PRESETS} />
					))}
				</div>
			</SettingRow>
			<SettingRow proOnly vertical title="Gelişmiş tema özelleştirmesi">
				<div className={b('customize')}>
											<ColorPicker
							openUp
							hideReset
							name="Arkaplan rengi"
							selectedColorHex={backgroundColor}
							resetToRgb={getDefaultSetting('background_color')}
							onChange={(color) => updateSetting('background_color', color)}
						/>
											<ColorPicker
							openUp
							hideReset
							name="Modül rengi"
							selectedColorHex={moduleColor}
							resetToRgb={getDefaultSetting('module_color')}
							onChange={(color) => updateSetting('module_color', color)}
						/>
											<ColorPicker
							openUp
							hideReset
							name="Metin rengi"
							selectedColorHex={textColor}
							resetToRgb={getDefaultSetting('text_color')}
							onChange={(color) => updateSetting('text_color', color)}
						/>
											<ColorPicker
							openUp
							hideReset
							name="Buton rengi"
							selectedColorHex={buttonColor}
							resetToRgb={getDefaultSetting('button_color')}
							onChange={(color) => updateSetting('button_color', color)}
						/>
				</div>
			</SettingRow>
		</>
	);
}
