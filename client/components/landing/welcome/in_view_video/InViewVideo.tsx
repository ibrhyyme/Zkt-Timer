import React, {useEffect, useRef, useState} from 'react';

interface Props {
	mp4: string;
	poster: string;
	className?: string;
	label?: string;
	width?: number;
	height?: number;
}

/**
 * A silent loop that plays only while it is on screen and downloads nothing until it
 * gets there (preload="none" plus a poster).
 *
 * With reduced motion it never starts on its own; the viewer gets the poster and the
 * native controls, so the film is still there for anyone who wants it.
 */
export default function InViewVideo({mp4, poster, className, label, width, height}: Props) {
	const ref = useRef<HTMLVideoElement>(null);
	const [manual, setManual] = useState(false);

	useEffect(() => {
		const video = ref.current;
		if (!video) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			setManual(true);
			return;
		}
		if (!('IntersectionObserver' in window)) {
			video.play().catch(() => undefined);
			return;
		}
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) video.play().catch(() => undefined);
				else video.pause();
			},
			{threshold: 0.35}
		);
		observer.observe(video);
		return () => observer.disconnect();
	}, []);

	return (
		<video
			ref={ref}
			className={className}
			poster={poster}
			muted
			loop
			playsInline
			preload="none"
			controls={manual}
			aria-label={label}
			width={width}
			height={height}
		>
			<source src={mp4} type="video/mp4" />
		</video>
	);
}
