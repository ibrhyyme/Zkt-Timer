import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './SlamSensitivitySlider.scss';
import { startSlamDetector, stopSlamDetector } from '../../../util/slam-stop/plugin';
import {
	useSlamStop,
	sensitivityToThreshold,
	sensitivityZone,
} from '../../../util/slam-stop/settings';

// Wait for the user to settle on a value before re-arming the native
// detector — restarting the sensor on every drag tick is wasteful.
const REARM_DEBOUNCE_MS = 300;
const FLASH_MS = 250;

/**
 * Sensitivity slider with a live test indicator. While this component is
 * mounted (extras view open + feature enabled), the native detector runs in
 * test mode: the user slams the table and the dot flashes green when the
 * current threshold would have stopped the timer — calibration by feel.
 * Owner tokens in the plugin wrapper keep this test instance from killing
 * a solve-mode detector (and vice versa).
 */
export default function SlamSensitivitySlider() {
	const { t } = useTranslation();
	const { sensitivity, setSensitivity } = useSlamStop();
	const [flash, setFlash] = useState(false);
	const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	const zone = sensitivityZone(sensitivity);
	const zoneLabels: Record<string, string> = {
		low: t('quick_controls.slam_low'),
		medium: t('quick_controls.slam_medium'),
		high: t('quick_controls.slam_high'),
		ultra: t('quick_controls.slam_ultra'),
	};

	useEffect(() => {
		let owner: symbol | null = null;
		let cancelled = false;

		const timeout = setTimeout(() => {
			startSlamDetector(sensitivityToThreshold(sensitivity), () => {
				if (flashTimeout.current) clearTimeout(flashTimeout.current);
				setFlash(true);
				flashTimeout.current = setTimeout(() => setFlash(false), FLASH_MS);
			}).then((result) => {
				owner = result;
				if (cancelled) stopSlamDetector(owner);
			});
		}, REARM_DEBOUNCE_MS);

		return () => {
			cancelled = true;
			clearTimeout(timeout);
			stopSlamDetector(owner);
		};
	}, [sensitivity]);

	useEffect(() => {
		return () => {
			if (flashTimeout.current) clearTimeout(flashTimeout.current);
		};
	}, []);

	return (
		<div className="py-4 px-4 rounded-xl bg-module border border-text/[0.08] transition-all duration-200">
			<div className="flex items-center justify-between mb-3">
				<span className="font-medium text-text">{t('quick_controls.slam_sensitivity')}</span>
				<span className="text-sm font-semibold text-primary">{zoneLabels[zone]}</span>
			</div>
			<div className="flex items-center space-x-3">
				<div className="relative flex-1 flex items-center">
					{/* Zone boundary ticks at 25/50/75 */}
					<div className="absolute inset-x-0 flex justify-between px-[25%] pointer-events-none">
						<div className="w-px h-2 bg-text/40" />
						<div className="w-px h-2 bg-text/40" />
					</div>
					<div className="absolute left-1/2 w-px h-2 bg-text/40 pointer-events-none" />
					<input
						className="slam-sensitivity-slider w-full"
						style={{ '--slam-progress': `${sensitivity}%` } as React.CSSProperties}
						type="range"
						min={0}
						max={100}
						step={1}
						value={sensitivity}
						onChange={(e) => setSensitivity(Number(e.target.value))}
					/>
				</div>
				<div
					className={`h-7 w-7 rounded-full border transition-colors duration-150 ${
						flash
							? 'bg-green-500 border-green-400 shadow-lg shadow-green-500/50'
							: 'bg-button border-text/[0.15]'
					}`}
				/>
			</div>
		</div>
	);
}
