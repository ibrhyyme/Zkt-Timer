import * as THREE from 'three';

import { DEFAULT_NXN_COLORS } from '../../../../../util/cube_colors/palette';
import { HOME_TILT_DEG, HOME_TURN_DEG } from '../view_defaults';
import type { PuzzleSize } from './cube_model';
import { CubeRenderer, type CapLooks } from './cube_renderer';

/**
 * Still pictures of cubes, all from one WebGL context per puzzle size.
 *
 * A screen with many cubes (the trainer's case cards) cannot give each its own context:
 * browsers allow about sixteen and drop the oldest past that. So the cubes are drawn as
 * pictures instead, one after another, by a single offscreen renderer that is set to each
 * cube's state in turn. It lives while pictures are asked for and gives its context back
 * after a quiet spell.
 *
 * Live views (the timer's cube, the replay) keep a renderer of their own: a page shows one
 * or two of them, and drawing those through a shared context would cost a copy every frame.
 */

export interface CubePictureRequest {
	size: PuzzleSize;
	/** Turns from solved, in the engine's notation (render/notation.ts). */
	turns: string[];
	/** Stickering, as the renderer takes it; null shows every cap in its colour. */
	looks?: CapLooks | null;
	/** Square side of the picture, in pixels. */
	pixels: number;
	/** Face colours U R F D L B; the app's default palette when left out. */
	faceColors?: string[];
	/** The floating hints of the hidden faces (scramble previews). */
	hints?: boolean;
}

/** The renderers go after this long without a picture. */
const RELEASE_AFTER_MS = 20000;

interface Job {
	request: CubePictureRequest;
	resolve: (url: string | null) => void;
}

const queue: Job[] = [];
/** One per puzzle size and hints or not (hints change the framing), each made on first use. */
const renderers = new Map<string, CubeRenderer>();
const rendererKey = (size: PuzzleSize, hints: boolean) => `${size}${hints ? 'h' : ''}`;
let scheduled = false;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * A PNG data URL of the cube, or null when it could not be drawn (no WebGL, a lost context).
 * Pictures are drawn one per animation frame, so a burst of requests never blocks a frame
 * for long.
 */
export function drawCubePicture(request: CubePictureRequest): Promise<string | null> {
	return new Promise((resolve) => {
		queue.push({ request, resolve });
		schedule();
	});
}

function schedule() {
	if (scheduled || !queue.length) return;
	scheduled = true;
	requestAnimationFrame(runNext);
}

function runNext() {
	scheduled = false;
	const job = queue.shift();
	if (job) job.resolve(drawNow(job.request));
	schedule();
	if (releaseTimer) clearTimeout(releaseTimer);
	releaseTimer = setTimeout(releaseAll, RELEASE_AFTER_MS);
}

function drawNow({ size, turns, looks, pixels, faceColors, hints = false }: CubePictureRequest): string | null {
	const key = rendererKey(size, hints);
	try {
		const cube = rendererFor(size, hints);
		cube.setFaceColors(faceColors ?? DEFAULT_NXN_COLORS);
		cube.setMoves(turns);
		cube.setCapLooks(looks ?? null);
		const url = cube.capture(pixels);
		// A lost context hands out a blank picture; the next request builds a new renderer.
		if (!url) dropRenderer(key);
		return url;
	} catch (error) {
		console.error('[cube_pictures] draw failed:', error);
		dropRenderer(key);
		return null;
	}
}

function rendererFor(size: PuzzleSize, hints: boolean): CubeRenderer {
	const key = rendererKey(size, hints);
	let cube = renderers.get(key);
	if (cube) return cube;
	const deg = Math.PI / 180;
	cube = new CubeRenderer({
		size,
		faceColors: DEFAULT_NXN_COLORS,
		tableTilt: HOME_TILT_DEG * deg,
		// The live cube's home view.
		orientation: new THREE.Quaternion().setFromEuler(new THREE.Euler(HOME_TILT_DEG * deg, -HOME_TURN_DEG * deg, 0)),
		// The same look on every device: a picture is drawn once and kept.
		quality: 'medium',
		floor: false,
		logo: false,
		hints,
	});
	// Only capture() draws; nothing is animated.
	cube.setActive(false);
	renderers.set(key, cube);
	return cube;
}

function dropRenderer(key: string) {
	renderers.get(key)?.dispose();
	renderers.delete(key);
}

function releaseAll() {
	releaseTimer = null;
	if (queue.length) return;
	renderers.forEach((cube) => cube.dispose());
	renderers.clear();
}
