import {useTheme} from './useTheme';
import {resourceUri} from '../storage';

// The Zeka Küpü Türkiye federation badge (not the Zkt Timer mark, which is
// /images/zkt-logo*.png). Its lettering sits outside the coloured circle, so it
// ships as two files: white lettering for dark surfaces, dark lettering for light.
export const ZKT_BADGE_ON_DARK = '/images/logos/zkt_logo.png';
export const ZKT_BADGE_ON_LIGHT = '/images/logos/zkt_logo_light.png';

export function zktBadgePath(onDarkSurface: boolean): string {
	return onDarkSurface ? ZKT_BADGE_ON_DARK : ZKT_BADGE_ON_LIGHT;
}

/** Badge URL for the current theme's module surface. */
export function useZktBadge(): string {
	const onDark = useTheme('module_color')?.isDark !== false;
	return resourceUri(zktBadgePath(onDark));
}
