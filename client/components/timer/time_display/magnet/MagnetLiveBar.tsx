import React, { useEffect, useRef } from 'react';
import block from '../../../../styles/bem';
import { useMagnetStatus } from '../../../../util/magnet-start/status_store';
import { magnetService, LiveReading } from '../../../../util/magnet-start/service';
import { liveBarScaleUt } from '../../../../util/magnet-start/cube_profile';
import { liveBarFraction, liveBarShowsValue, liveBarTarget, smoothLiveBar } from './guide_state';
import './MagnetGuide.scss';

const b = block('magnet-live-bar');

interface Props {
	/** False while a solve runs: the stream is paused then, the bar keeps its place empty. */
	idle: boolean;
}

/**
 * Live field bar under the digits (design magnet-cubes 5.8): how close the cube sits to where it
 * rests on this phone, with a mark at the detector's own "near" threshold. Pro, like the Magnet
 * Timer itself: it only exists while the status store carries a calibrated cube profile, which
 * useMagnetStart sets only when the Magnet Timer owns the input.
 *
 * Per packet (20 Hz) the value goes straight to the DOM as a transform, coalesced to one write
 * per frame; React renders only when the discrete state changes (status store), so the timer
 * tree is never re-rendered by the stream.
 */
export default function MagnetLiveBar({ idle }: Props) {
	const status = useMagnetStatus();
	const profile = status.profile;
	const fillRef = useRef<HTMLDivElement>(null);

	const ready = !!profile && profile.status === 'ready';
	const scale = ready ? liveBarScaleUt(profile as NonNullable<typeof profile>) : null;
	const target = ready ? liveBarTarget(profile?.nearMin, scale) : null;
	const showValue =
		idle &&
		!!scale &&
		liveBarShowsValue({ profile, active: status.active, stage: status.stage, moving: status.moving });

	useEffect(() => {
		if (!showValue || !scale) return undefined;

		let smoothed: number | null = null;
		let frame: number | null = null;

		const write = () => {
			frame = null;
			const el = fillRef.current;
			if (el && smoothed !== null) el.style.transform = `scaleX(${smoothed})`;
		};

		const unsubscribe = magnetService.subscribeLive((live: LiveReading) => {
			smoothed = smoothLiveBar(smoothed, liveBarFraction(live.delta, scale));
			if (frame === null && typeof requestAnimationFrame === 'function') {
				frame = requestAnimationFrame(write);
			}
		});

		return () => {
			unsubscribe();
			if (frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
			const el = fillRef.current;
			if (el) el.style.transform = 'scaleX(0)';
		};
	}, [showValue, scale]);

	// No calibrated cube: no bar and no reserved space (the guide card is there instead).
	if (!ready || !scale) return null;

	return (
		<div
			className={b({
				idle: !showValue,
				green: showValue && status.green,
				orange: showValue && !status.green && status.orange,
			})}
			aria-hidden="true"
		>
			<div className={b('track')}>
				<div ref={fillRef} className={b('fill')} />
				{target !== null && <div className={b('target')} style={{ left: `${target * 100}%` }} />}
			</div>
		</div>
	);
}
