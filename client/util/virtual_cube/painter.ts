import { actualScale, BORDER_COLOR, NUM_SIDES, STICKER_WIDTH } from './constants';
import type { VrcCamera } from './camera';
import { FAR, NEAR } from './camera';
import type { VrcHandMark, VrcSticker } from './types';

/**
 * 2D canvas painter — the replacement for `THREE.CanvasRenderer`.
 *
 * cstimer draws the virtual cube with CanvasRenderer, a software rasteriser that
 * three.js deleted in 2016; on our `three@0.125.0` the class survives only as a
 * stub that logs "has been removed". Rather than carry 1100 lines of abandoned
 * general-purpose renderer, this reproduces the exact output for the one scene
 * class the cube actually is.
 *
 * That scene is unusually simple, which is what makes the narrow version exact
 * rather than approximate:
 *   - every mesh is a single flat quad (a sticker) or a single flat triangle (a
 *     hand mark), so there is no tessellation to match
 *   - `scene.lights.length === 0`, so CanvasRenderer takes its plain
 *     `fillPath`/`strokePath` branch and no shading maths runs at all
 *   - every mesh is `doubleSided`, so the backface test never culls, which is
 *     precisely why the far side of the cube shows through the gaps
 *   - nothing has a texture, gradient or overdraw
 *
 * Everything CanvasRenderer does beyond that is provably unreachable here, so
 * omitting it is not a shortcut. What IS reproduced literally: the projection,
 * the painter's-algorithm sort, the two-pass fill-then-stroke over one path, and
 * the y-up centred canvas transform.
 *
 * Reference: `lib/threemin.js` projectScene (2150-2270), render (2456-2540),
 * renderFace4 (2860-2891), drawQuad, fillPath, strokePath, painterSort (2302).
 */

/**
 * Sticker quad in local space, in the ring order `THREE.Plane(w, w)` produces.
 *
 * Plane emits vertices (-h,+h), (+h,+h), (-h,-h), (+h,-h) and a single
 * Face4(a=0, b=2, c=3, d=1), so the draw order is 0, 2, 3, 1 — which is this.
 * Getting the ring order wrong draws a bow-tie instead of a square.
 */
const HALF = STICKER_WIDTH / 2;
const QUAD: ReadonlyArray<readonly [number, number]> = [
	[-HALF, HALF],
	[-HALF, -HALF],
	[HALF, -HALF],
	[HALF, HALF],
];

/** Left-pad a colour to a six digit hex string. threemin.js `pad`. */
function colorToStyle(hex: number): string {
	let str = hex.toString(16);
	while (str.length < 6) str = `0${str}`;
	return `#${str}`;
}

const BORDER_STYLE = colorToStyle(BORDER_COLOR);

/** One projected polygon, ready to sort and draw. Pooled, never reallocated. */
interface DrawFace {
	x: Float64Array;
	y: Float64Array;
	count: number;
	z: number;
	color: number;
	border: boolean;
	visible: boolean;
}

function makeDrawFace(): DrawFace {
	return {
		x: new Float64Array(4),
		y: new Float64Array(4),
		count: 0,
		z: 0,
		color: 0,
		border: false,
		visible: false,
	};
}

export interface PaintTarget {
	ctx: CanvasRenderingContext2D;
	/** Logical (CSS pixel) side length of the square canvas. */
	cssSize: number;
	/** Device pixel ratio the backing store was sized with. */
	dpr: number;
}

export class VirtualCubePainter {
	private pool: DrawFace[] = [];

	private order: DrawFace[] = [];

	/**
	 * Project, sort and draw one frame.
	 *
	 * Faces are built in creation order — face 0-5, then su, then sv, then hand
	 * marks — because `Array.prototype.sort` is stable, so equal depths resolve
	 * to that order exactly as they do in the reference.
	 */
	render(
		target: PaintTarget,
		pieces: VrcSticker[][],
		handMarks: VrcHandMark[],
		camera: VrcCamera,
		dimension: number
	): void {
		const scale = actualScale(dimension);
		const half = target.cssSize / 2;
		const e = camera.projScreenMatrix.elements;

		this.order.length = 0;
		let poolIndex = 0;

		const takeFace = (): DrawFace => {
			if (poolIndex === this.pool.length) {
				this.pool.push(makeDrawFace());
			}
			return this.pool[poolIndex++];
		};

		/**
		 * Project one polygon.
		 *
		 * Two deliberate asymmetries copied from the reference:
		 *   - vertex screen coords divide x and y by w but leave z alone, and the
		 *     near/far visibility test runs against that undivided z
		 *   - the centroid used for depth sorting DOES divide z by w, because the
		 *     reference projects it with multiplyVector3 rather than multiplyVector4
		 */
		const project = (
			points: ReadonlyArray<readonly [number, number]>,
			matrix: Float64Array | number[],
			color: number,
			border: boolean,
			centroidX: number,
			centroidY: number
		): void => {
			const face = takeFace();
			face.count = points.length;
			face.color = color;
			face.border = border;
			face.visible = true;

			for (let i = 0; i < points.length; i++) {
				// World position. The cube object carries only a uniform scale, so
				// Scale(s) * visual applied to a point is just s * (visual * point);
				// building the product matrix per sticker per frame would be waste.
				const px = points[i][0];
				const py = points[i][1];
				const wx = (matrix[0] * px + matrix[4] * py + matrix[12]) * scale;
				const wy = (matrix[1] * px + matrix[5] * py + matrix[13]) * scale;
				const wz = (matrix[2] * px + matrix[6] * py + matrix[14]) * scale;

				const cw = e[3] * wx + e[7] * wy + e[11] * wz + e[15];
				const cz = e[2] * wx + e[6] * wy + e[10] * wz + e[14];

				if (!(cz > NEAR && cz < FAR)) {
					face.visible = false;
					return;
				}

				face.x[i] = ((e[0] * wx + e[4] * wy + e[8] * wz + e[12]) / cw) * half;
				face.y[i] = ((e[1] * wx + e[5] * wy + e[9] * wz + e[13]) / cw) * half;
			}

			const gx = (matrix[0] * centroidX + matrix[4] * centroidY + matrix[12]) * scale;
			const gy = (matrix[1] * centroidX + matrix[5] * centroidY + matrix[13]) * scale;
			const gz = (matrix[2] * centroidX + matrix[6] * centroidY + matrix[14]) * scale;
			const gw = e[3] * gx + e[7] * gy + e[11] * gz + e[15];
			face.z = (e[2] * gx + e[6] * gy + e[10] * gz + e[14]) / gw;

			this.order.push(face);
		};

		for (let f = 0; f < NUM_SIDES; f++) {
			const faceStickers = pieces[f];
			for (let i = 0; i < faceStickers.length; i++) {
				const sticker = faceStickers[i];
				project(QUAD, sticker.visual.elements, sticker.color, sticker.border, 0, 0);
			}
		}

		for (let i = 0; i < handMarks.length; i++) {
			const mark = handMarks[i];
			let cx = 0;
			let cy = 0;
			for (const p of mark.points) {
				cx += p[0];
				cy += p[1];
			}
			project(mark.points, mark.matrix.elements, mark.color, true, cx / 3, cy / 3);
		}

		// painterSort: descending by depth, so the far faces are laid down first
		// and the near ones paint over them.
		this.order.sort((a, b) => b.z - a.z);

		this.paint(target, this.order);
	}

	private paint(target: PaintTarget, faces: DrawFace[]): void {
		const { ctx, cssSize, dpr } = target;
		const half = cssSize / 2;

		// Origin at the centre with y pointing up, matching the reference's
		// `setTransform(1, 0, 0, -1, W/2, H/2)`. Folding the device pixel ratio into
		// the scale keeps every coordinate below in CSS pixels, so a line width of 1
		// stays one CSS pixel and the picture is identical at dpr 1 and merely
		// sharper above it.
		ctx.setTransform(dpr, 0, 0, -dpr, (cssSize * dpr) / 2, (cssSize * dpr) / 2);

		// The reference clears to full transparency (clearColor 0, opacity 0).
		ctx.clearRect(-half, -half, cssSize, cssSize);

		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.lineWidth = 1;

		let lastFill = '';
		let strokeSet = false;

		for (let i = 0; i < faces.length; i++) {
			const face = faces[i];
			if (!face.visible) continue;

			// One path, two passes. The border is not separate geometry, it is the
			// same polygon stroked, which is what `renderFace4` does by running once
			// per material with the colour material first and the wireframe second.
			ctx.beginPath();
			ctx.moveTo(face.x[0], face.y[0]);
			for (let v = 1; v < face.count; v++) {
				ctx.lineTo(face.x[v], face.y[v]);
			}
			ctx.lineTo(face.x[0], face.y[0]);
			ctx.closePath();

			const fill = colorToStyle(face.color);
			if (fill !== lastFill) {
				ctx.fillStyle = fill;
				lastFill = fill;
			}
			ctx.fill();

			if (face.border) {
				if (!strokeSet) {
					ctx.strokeStyle = BORDER_STYLE;
					strokeSet = true;
				}
				ctx.stroke();
			}
		}
	}
}

/**
 * Size a canvas for the current device pixel ratio.
 * Same shape as the existing 2D scramble renderers (`FtoRenderer.tsx:110-146`).
 */
export function sizeCanvas(canvas: HTMLCanvasElement, cssSize: number, dpr: number): void {
	canvas.width = Math.round(cssSize * dpr);
	canvas.height = Math.round(cssSize * dpr);
	canvas.style.width = `${cssSize}px`;
	canvas.style.height = `${cssSize}px`;
}
