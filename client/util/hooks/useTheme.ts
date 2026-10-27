import tinycolor from 'tinycolor2';
import {useLocation} from 'react-router-dom';
import {useSettings} from './useSettings';
import {useMe} from './useMe';
import {isThemeColorKey, isThemeLocked, lockedThemeColors} from '../themes/theme_lock';
import {getAnyColorStringAsRgbString} from '../themes/theme_util';
import colorPalette, {ColorName} from '../../../shared/colors';

export interface AppTheme {
	isDark: boolean;
	hex: string;
	hexMid: string;
	themeHex: string;
	themeHexOpposite: string;
}

type AppThemeOptions =
	| 'background_color'
	| 'text_color'
	| 'primary_color'
	| 'secondary_color'
	| 'module_color'
	| 'button_color';

export function useTheme(val: AppThemeOptions): AppTheme {
	if (!val) {
		return null;
	}

	const setting = useSettings(val);
	// Same rule as the CSS variables (layout/themes.ts): where the theme is locked, the
	// colour on screen is the fixed one, not the user's setting (E-106).
	const pathname = useLocation().pathname;
	const locked = isThemeLocked(pathname, !!useMe());
	const color = locked && isThemeColorKey(val) ? lockedThemeColors(pathname)[val] : setting;
	const rgbString = getAnyColorStringAsRgbString(color);
	const tc = tinycolor(rgbString);
	const isDark = tc.isDark();

	const themeHex = isDark ? '#000000' : '#FFFFFF';
	const themeHexOpposite = isDark ? '#FFFFFF' : '#000000';

	return {
		isDark,
		themeHex,
		themeHexOpposite,
		hex: tc.toHexString(),
		hexMid: tc.toHexString(),
	};
}

export function useColor(colorName: ColorName, backgroundColor?: AppThemeOptions): AppTheme {
	const theme = useTheme(backgroundColor);

	if (!colorName || !colorPalette[colorName]) {
		return null;
	}

	const colorMap = colorPalette[colorName];
	const hexMid = colorMap[600];
	let color = hexMid;

	if (backgroundColor && theme) {
		if (theme.isDark) {
			color = colorMap[500];
		} else {
			color = colorMap[400];
		}
	}

	const tc = tinycolor(color);
	const isDark = tc.isDark();

	const themeHex = isDark ? '#000000' : '#FFFFFF';
	const themeHexOpposite = isDark ? '#FFFFFF' : '#000000';

	return {
		isDark,
		themeHex,
		themeHexOpposite,
		hex: color,
		hexMid,
	};
}
