import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { openModal } from '../../../../actions/general';
import { getStore } from '../../../store';
import { getSetting } from '../../../../db/settings/query';
import { useGeneral } from '../../../../util/hooks/useGeneral';
import { isNative } from '../../../../util/platform';
import { legacyMagnetNoticeDue, takeLegacyMagnetEnabled } from '../../../../util/magnet-start/settings';

function LegacyMagnetNoticeBody() {
	const { t } = useTranslation();
	// Phones choose the input in the left drawer, tablets in the header list.
	const mobileLayout = !!useGeneral('mobile_mode');
	return (
		<p className="text-base text-text leading-relaxed">
			{t('time_display.magnet_moved_body')}{' '}
			{t(mobileLayout ? 'time_display.magnet_moved_where_drawer' : 'time_display.magnet_moved_where_list')}
		</p>
	);
}

/**
 * Members who had the old lift-to-start switch on in the touch timer lost it when the
 * feature became its own input (Magnet Timer). They get one short notice on the timer page
 * telling them where it went; their timer type is left alone. The old key is read once and
 * removed either way, so the notice never repeats and the key is retired on every device.
 *
 * @param active the real timer page: not a solve modal, not a match
 */
export function useLegacyMagnetNotice(active: boolean): void {
	const { t } = useTranslation();

	useEffect(() => {
		if (!active) return;
		// The switch only ever existed in the app. On the web the key cannot be set, but if a
		// stale one is there it is retired without a notice that would point to a missing tile.
		if (!isNative()) {
			takeLegacyMagnetEnabled();
			return;
		}
		// Another dialog is up (first launch, an announcement): try again on the next visit
		// instead of stacking on it. The key stays until the notice can be shown.
		if ((getStore()?.getState()?.general?.modals || []).length > 0) return;

		const wasEnabled = takeLegacyMagnetEnabled();
		if (!legacyMagnetNoticeDue(wasEnabled, getSetting('timer_type') as string)) return;

		getStore()?.dispatch(
			openModal(<LegacyMagnetNoticeBody />, {
				compact: true,
				width: 420,
				title: t('time_display.magnet_moved_title'),
				closeButtonText: t('solve_info.done'),
			})
		);
		// Once per mount of the timer page; t is stable for the language in use.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [active]);
}
