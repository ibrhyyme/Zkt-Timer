import { useMemo } from 'react';
import { useSettings } from '../hooks/useSettings';
import {
	CubePalette,
	DEFAULT_NXN_COLORS,
	DEFAULT_SQ1_COLORS,
	DEFAULT_CLOCK_COLORS,
	DEFAULT_FTO_COLORS,
	DEFAULT_OUTLINE_COLOR,
	migrateLegacyNxnColors,
	sanitizeColor,
	sanitizeColors,
} from './palette';

/**
 * The user's sticker colours, repaired against the defaults on every read.
 *
 * Renderers must never draw with a raw settings value: the array can arrive short, long, or
 * holding something that is not a colour at all, from an older build or another device's
 * prefs blob, and canvas silently skips an invalid `fillStyle` — leaving stickers drawn in
 * whatever colour happened to be set last rather than failing visibly.
 */
export function useCubePalette(): CubePalette {
	const nxn = useSettings('cube_face_colors');
	const sq1 = useSettings('sq1_face_colors');
	const clock = useSettings('clock_colors');
	const fto = useSettings('fto_face_colors');
	const outline = useSettings('cube_outline_color');

	return useMemo(
		() => ({
			nxn: migrateLegacyNxnColors(sanitizeColors(nxn, DEFAULT_NXN_COLORS)),
			sq1: sanitizeColors(sq1, DEFAULT_SQ1_COLORS),
			clock: sanitizeColors(clock, DEFAULT_CLOCK_COLORS),
			fto: sanitizeColors(fto, DEFAULT_FTO_COLORS),
			outline: sanitizeColor(outline, DEFAULT_OUTLINE_COLOR),
		}),
		[nxn, sq1, clock, fto, outline]
	);
}
