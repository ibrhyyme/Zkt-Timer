import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMagnetStatus } from '../../../../util/magnet-start/status_store';
import { magnetService } from '../../../../util/magnet-start/service';
import { useMagnetStartSettings } from '../../../../util/magnet-start/settings';
import type { MagnetStage } from '../../../../util/magnet-start/controller';

const STAGE_KEYS: Partial<Record<MagnetStage, string>> = {
	unsupported: 'time_display.magnet_unsupported',
	unknown: 'time_display.magnet_unknown',
	far: 'time_display.magnet_far',
	closer: 'time_display.magnet_closer',
	not_armed: 'time_display.magnet_not_armed',
	dwelling: 'time_display.magnet_dwelling',
	ready_inspection: 'time_display.magnet_ready_inspection',
	ready_solve: 'time_display.magnet_ready_solve',
	inspection_waiting: 'time_display.magnet_inspection_waiting',
};

/**
 * One line under the digits telling the user what the cube should do next. While the
 * baseline is unknown it carries the re-learn button: a <button> never starts the timer
 * (touch_target.ts), so tapping it is safe on the start surface.
 *
 * "Cube away, put it at the camera" only speaks until the first solve started by lifting
 * the cube: after that the user knows where it goes, and repeating it after every solve is
 * noise. 'resting' (cube left at the hot spot through a stop) has no line at all.
 */
export default function MagnetHint() {
	const { t } = useTranslation();
	const status = useMagnetStatus();
	const { introDone } = useMagnetStartSettings();
	const [relearnFailed, setRelearnFailed] = useState(false);

	const key = STAGE_KEYS[status.stage];
	if (!status.active || !key) return null;
	if (status.stage === 'far' && introDone) return null;

	function relearn() {
		setRelearnFailed(!magnetService.relearnFar());
	}

	return (
		<div className="w-full text-center text-sm font-medium text-text leading-snug px-4">
			<span>{t(key)}</span>
			{status.stage === 'unknown' && (
				<>
					{' '}
					<button
						type="button"
						onClick={relearn}
						className="font-semibold text-primary underline underline-offset-2"
					>
						{t('time_display.magnet_relearn')}
					</button>
					{relearnFailed && <div className="mt-1">{t('quick_controls.magnet_relearn_failed')}</div>}
				</>
			)}
		</div>
	);
}
