import React, { useEffect, useRef, useState } from 'react';
import { isAppVisible, onVisibilityChange } from '../../../../util/app-visibility';
import { PresetBackgroundId, PRESET_STILL_TIME } from './preset_shaders';
import { createPresetRenderer } from './preset_renderer';
import { readThemePalette, watchThemePalette } from './theme_colors';

interface Props {
	preset: PresetBackgroundId;
	/** The user's choice. Off, the background is drawn once and left as a still picture. */
	moving: boolean;
	/** A running solve. Motion stops so nothing competes with the timer for the frame. */
	paused: boolean;
	className?: string;
}

// The scenes drift slowly, so 30 frames a second looks the same as 60 for half the work.
const FRAME_MS = 1000 / 30;
// Soft scenes survive a lower internal resolution; this caps the GPU work on big screens.
const MAX_PIXELS_PHONE = 900_000;
const MAX_PIXELS_DESKTOP = 1_600_000;

/**
 * A ready-made background drawn live in the theme's colours. Stops whenever motion is off,
 * a solve is running, the app is in the background or the system asks for reduced motion.
 * A stopped canvas keeps its last frame, so pausing mid-motion freezes the picture in place.
 * Without WebGL2 it renders nothing and the timer keeps the plain theme background.
 */
export default function PresetBackground({ preset, moving, paused, className }: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	// A lost context (a phone reclaiming GPU memory in the background) gets a fresh canvas.
	const [generation, setGeneration] = useState(0);
	const [unsupported, setUnsupported] = useState(false);

	const propsRef = useRef({ preset, moving, paused });
	propsRef.current = { preset, moving, paused };
	const updateRef = useRef<() => void>(() => {});

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return undefined;
		const renderer = createPresetRenderer(canvas);
		if (!renderer) {
			setUnsupported(true);
			return undefined;
		}

		const reducedQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
		let reduced = !!reducedQuery?.matches;
		let visible = isAppVisible();
		let palette = readThemePalette();
		let raf = 0;
		let lastTick = 0;
		let lastFrame = 0;
		let elapsed = 0;

		const running = () => propsRef.current.moving && !propsRef.current.paused && visible && !reduced;
		// Motion off or reduced: the fixed still frame. Paused mid-motion: where it stopped.
		const currentTime = () =>
			propsRef.current.moving && !reduced ? PRESET_STILL_TIME + elapsed / 1000 : PRESET_STILL_TIME;

		function draw() {
			renderer.draw(propsRef.current.preset, canvas.width, canvas.height, currentTime(), palette);
		}

		function tick(now: number) {
			raf = 0;
			if (!running()) {
				lastTick = 0;
				return;
			}
			// Only time spent moving counts, so a pause resumes from the same frame.
			if (lastTick) elapsed += Math.min(now - lastTick, 100);
			lastTick = now;
			if (now - lastFrame >= FRAME_MS - 2) {
				lastFrame = now;
				draw();
			}
			raf = requestAnimationFrame(tick);
		}

		function update() {
			if (running()) {
				if (!raf) raf = requestAnimationFrame(tick);
				return;
			}
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
			lastTick = 0;
			draw();
		}
		updateRef.current = update;

		function resize() {
			const rect = canvas.getBoundingClientRect();
			if (!rect.width || !rect.height) return;
			const cap = window.innerWidth < 768 ? MAX_PIXELS_PHONE : MAX_PIXELS_DESKTOP;
			let scale = Math.min(window.devicePixelRatio || 1, 1.5);
			if (rect.width * rect.height * scale * scale > cap) scale = Math.sqrt(cap / (rect.width * rect.height));
			const width = Math.max(2, Math.round(rect.width * scale));
			const height = Math.max(2, Math.round(rect.height * scale));
			if (canvas.width === width && canvas.height === height) return;
			canvas.width = width;
			canvas.height = height;
			// A resize clears the canvas, so a stopped background has to be drawn again.
			if (!running()) draw();
		}

		const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
		resizeObserver?.observe(canvas);
		if (!resizeObserver) window.addEventListener('resize', resize);

		const stopWatchingTheme = watchThemePalette(() => {
			palette = readThemePalette();
			if (!running()) draw();
		});
		const stopWatchingVisibility = onVisibilityChange((v) => {
			visible = v;
			update();
		});
		const onReducedChange = () => {
			reduced = !!reducedQuery?.matches;
			update();
		};
		reducedQuery?.addEventListener?.('change', onReducedChange);

		const onLost = (e: Event) => {
			e.preventDefault();
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
			setGeneration((g) => g + 1);
		};
		canvas.addEventListener('webglcontextlost', onLost);

		resize();
		update();

		return () => {
			if (raf) cancelAnimationFrame(raf);
			updateRef.current = () => {};
			resizeObserver?.disconnect();
			if (!resizeObserver) window.removeEventListener('resize', resize);
			stopWatchingTheme();
			stopWatchingVisibility();
			reducedQuery?.removeEventListener?.('change', onReducedChange);
			canvas.removeEventListener('webglcontextlost', onLost);
			renderer.dispose();
		};
	}, [generation]);

	useEffect(() => {
		updateRef.current();
	}, [preset, moving, paused]);

	if (unsupported) return null;
	return <canvas key={generation} ref={canvasRef} className={className} aria-hidden="true" />;
}
