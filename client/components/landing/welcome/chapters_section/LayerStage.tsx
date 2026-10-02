import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import gsap from 'gsap';
import block from '../../../../styles/bem';
import {landingAsset} from '../../../../util/api-base';
import type {Chapter} from '../landing-data';

const b = block('welcome-stage');

// The stage is the front face of a cube and these are its three horizontal layers.
const ROWS = [0, 1, 2] as const;
const TURN_SECONDS = 0.72;
const LAYER_STAGGER = 0.085;
// A face turned fully away sits in this much shadow.
const MAX_SHADE = 0.7;

// useLayoutEffect warns during server rendering; the effect only matters in a browser.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

interface Props {
	chapters: Chapter[];
	active: number;
	labels: string[];
}

function decode(src: string): Promise<void> {
	const img = new Image();
	img.src = src;
	return img.decode ? img.decode().catch(() => undefined) : Promise.resolve();
}

/**
 * Shows one chapter's screen at a time and changes screens with a layer turn: each of
 * the three layers rotates a quarter turn, top first, bringing the next screen round
 * from the side face, the way a U, E and D turn would bring a side of a real cube to
 * the front.
 *
 * At rest the stage is a plain <img> (lazy, with alt text). The layers only exist
 * visually for the length of a turn. Requests that arrive mid-turn are not queued one
 * by one: when a turn ends the stage turns straight to whatever chapter is active by
 * then, so a fast scroll costs one turn, not six.
 */
export default function LayerStage({chapters, active, labels}: Props) {
	const stageRef = useRef<HTMLDivElement>(null);
	const prismRefs = useRef<(HTMLDivElement | null)[]>([]);
	const videoRef = useRef<HTMLVideoElement>(null);
	const stillRef = useRef<HTMLImageElement>(null);

	const [shown, setShown] = useState(0);
	const [turning, setTurning] = useState(false);
	const [armed, setArmed] = useState(false);
	const [visible, setVisible] = useState(false);

	const shownRef = useRef(0);
	const targetRef = useRef(active);
	const busyRef = useRef(false);
	const timelineRef = useRef<gsap.core.Timeline | null>(null);
	const aliveRef = useRef(true);

	const src = useCallback((index: number) => landingAsset(chapters[index].image), [chapters]);

	// Arm well before the stage scrolls in: decode every still so a turn never reveals
	// a face that is still loading.
	useEffect(() => {
		const stage = stageRef.current;
		if (!stage || !('IntersectionObserver' in window)) {
			setArmed(true);
			return;
		}
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;
				observer.disconnect();
				Promise.all(chapters.map((_, i) => decode(src(i)))).then(() => setArmed(true));
			},
			{rootMargin: '1200px 0px'}
		);
		observer.observe(stage);
		return () => observer.disconnect();
	}, [chapters, src]);

	// Only the chapter video needs to know whether the stage is on screen.
	useEffect(() => {
		const stage = stageRef.current;
		if (!stage || !('IntersectionObserver' in window)) return;
		const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
			threshold: 0.25,
		});
		observer.observe(stage);
		return () => observer.disconnect();
	}, []);

	const applyTurn = (prism: HTMLDivElement, progress: number, dir: number, half: number) => {
		const theta = (Math.PI / 2) * progress;
		// Shrink the layer in the plane it turns in so its silhouette never grows past
		// the frame: a square turned by theta is (cos + sin) times as wide.
		const s = 1 / (Math.cos(theta) + Math.sin(theta));
		prism.style.transform = `scale3d(${s}, 1, ${s}) translateZ(${-half}px) rotateY(${-dir * progress * 90}deg)`;
		prism.style.setProperty('--shade-front', (MAX_SHADE * Math.sin(theta)).toFixed(3));
		prism.style.setProperty('--shade-side', (MAX_SHADE * Math.cos(theta)).toFixed(3));
	};

	const step = useCallback(() => {
		const from = shownRef.current;
		const to = targetRef.current;
		if (from === to || busyRef.current) return;

		const stage = stageRef.current;
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!stage || !armed || reduced) {
			// No movement: the screen simply changes.
			shownRef.current = to;
			setShown(to);
			return;
		}

		busyRef.current = true;
		const dir = to > from ? 1 : -1;
		const half = stage.getBoundingClientRect().width / 2;
		stage.style.setProperty('--half', `${half}px`);
		stage.style.setProperty('--depth', `${half * 5}px`);

		prismRefs.current.forEach((prism) => {
			if (!prism) return;
			prism.dataset.dir = dir > 0 ? 'right' : 'left';
			// <img> rather than a CSS background: an image that decode() already warmed
			// paints on the next frame, while a background image can be decoded late on
			// its first paint and leave a face blank for part of the turn.
			const [front, side] = Array.from(prism.querySelectorAll('img'));
			front.src = src(from);
			side.src = src(to);
			applyTurn(prism, 0, dir, half);
		});

		videoRef.current?.pause();
		setTurning(true);

		const tl = gsap.timeline({
			onComplete: () => {
				shownRef.current = to;
				setShown(to);
			},
		});
		prismRefs.current.forEach((prism, row) => {
			if (!prism) return;
			const state = {p: 0};
			tl.to(
				state,
				{
					p: 1,
					duration: TURN_SECONDS,
					ease: 'power3.inOut',
					onUpdate: () => applyTurn(prism, state.p, dir, half),
				},
				row * LAYER_STAGGER
			);
		});
		timelineRef.current = tl;
	}, [armed, src]);

	// The <img> now points at the new screen. The layers already show that screen, so
	// they stay up until the <img> has decoded it and then drop out, which makes the
	// hand-over invisible. Dropping them sets off the catch-up turn, if one is due.
	useIsoLayoutEffect(() => {
		if (!busyRef.current) return;
		const still = stillRef.current;
		const finish = () => {
			if (!aliveRef.current) return;
			busyRef.current = false;
			setTurning(false);
		};
		if (still && still.decode) {
			still.decode().then(finish, finish);
		} else {
			finish();
		}
	}, [shown]);

	useEffect(() => {
		if (!turning) step();
	}, [turning, step]);

	useEffect(() => {
		targetRef.current = active;
		step();
	}, [active, step]);

	useEffect(
		() => () => {
			aliveRef.current = false;
			timelineRef.current?.kill();
		},
		[]
	);

	const current = chapters[shown];
	const showVideo = !!current.video && !turning && armed;

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		if (showVideo && visible) {
			video.play().catch(() => undefined);
		} else {
			video.pause();
		}
	}, [showVideo, visible]);

	return (
		<div ref={stageRef} className={b({turning})} role="img" aria-label={labels[shown]}>
			<img
				ref={stillRef}
				className={b('still')}
				src={landingAsset(current.image)}
				alt=""
				loading="lazy"
				decoding="async"
				width={1920}
				height={1080}
			/>

			{current.video && (
				<video
					key={current.id}
					ref={videoRef}
					className={b('video', {on: showVideo})}
					poster={landingAsset(current.image)}
					muted
					loop
					playsInline
					preload="none"
					aria-hidden="true"
				>
					<source src={landingAsset(current.video.mp4)} type="video/mp4" />
				</video>
			)}

			<div className={b('layers')} aria-hidden="true">
				{ROWS.map((row) => (
					<div key={row} className={b('layer', {row: String(row)})}>
						<div
							className={b('prism')}
							ref={(el) => {
								prismRefs.current[row] = el;
							}}
						>
							<div className={b('face', {front: true})}>
								<img className={b('face-img')} alt="" decoding="sync" />
							</div>
							<div className={b('face', {side: true})}>
								<img className={b('face-img')} alt="" decoding="sync" />
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
