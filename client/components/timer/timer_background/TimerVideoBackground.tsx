/**
 * The Pro live wallpaper: the user's own MP4 playing behind the timer.
 *
 * Three things decide whether it actually plays, and all three matter more than the effect:
 *
 *  - A running solve pauses it. A video decode competing for the main thread is exactly the
 *    kind of jitter that shows up as a dropped frame in the timer display, and the solve is
 *    the one moment the background is not being looked at anyway.
 *  - A backgrounded tab pauses it, so a timer left open in another tab stops costing battery.
 *    Browsers throttle background video unevenly, so this is explicit rather than assumed.
 *  - `prefers-reduced-motion` stops it entirely, showing the first frame as a still. Someone
 *    who asked the system for less motion did not ask for an exception here.
 *
 * `muted` and `playsInline` are not optional: without them autoplay is refused on every
 * mobile browser and iOS takes the video fullscreen on play.
 */

import React, {useEffect, useRef, useState} from 'react';
import {onVisibilityChange} from '../../../util/app-visibility';

interface Props {
	src: string;
	/** True while a solve is running. */
	paused: boolean;
	className?: string;
}

export default function TimerVideoBackground({src, paused, className}: Props) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [visible, setVisible] = useState(true);
	const [reducedMotion, setReducedMotion] = useState(false);

	useEffect(() => {
		const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
		if (!query) return;

		setReducedMotion(query.matches);
		const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
		// Safari below 14 only has the deprecated listener API.
		if (query.addEventListener) {
			query.addEventListener('change', onChange);
			return () => query.removeEventListener('change', onChange);
		}
		query.addListener(onChange);
		return () => query.removeListener(onChange);
	}, []);

	useEffect(() => onVisibilityChange(setVisible), []);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;

		if (paused || !visible || reducedMotion) {
			video.pause();
			return;
		}

		// Autoplay can still be refused (a browser-level media setting, a policy we cannot
		// see). A rejected promise here is not an error worth surfacing: the first frame
		// stays on screen and the timer is unaffected.
		void video.play().catch(() => undefined);
	}, [paused, visible, reducedMotion, src]);

	return (
		<video
			ref={videoRef}
			className={className}
			src={src}
			// Autoplay is left to the effect above so the reduced-motion case never starts
			// playback at all, rather than starting and being paused a frame later.
			loop
			muted
			playsInline
			preload="auto"
			aria-hidden
		/>
	);
}
