import * as THREE from 'three';

import { stickerPaletteFromFaceColors } from '../cube_palette';
import { AXES, CubeModel, type Cap, type PuzzleSize } from './cube_model';
import { DIM, buildBodyGeometry, buildCapGeometry, capKindAt, capMatrix, capOutline, capShapeFor, logoHome, logoMatrix, type CapKind } from './geometry';
import { createBodyMaterial, createCapMaterial, createLogoMaterial, linearColor, type BodyUniforms } from './materials';
import { layerTurns } from './notation';
import { Stage, pickQuality, type BackView, type CubeQuality } from './stage';
import { TurnAnimator } from './turn_animator';

/**
 * The smart-cube renderer: our own three.js cube in place of cubing.js's flat diagram.
 *
 * It draws only when something changed (a turn, the gyro, colours, size), so a cube lying
 * still costs nothing. The caller owns the canvas's place on the page and feeds it turns,
 * reported states and the orientation; nothing here decides anything about a solve.
 */

const LOGO_URL = '/public/images/zkt-logo.png';
/** Per frame, how far the drawn orientation moves towards the gyro's. */
const ORIENTATION_EASE = 0.25;
/** How far a turn has to open a gap (radians off a quarter) for its inside to show fully. */
const GAP_FULLY_OPEN = 0.2;
/** Frame times that mean the device cannot keep up. 30 fps throttling (iOS low power) stays under it. */
const SLOW_FRAME_MS = 38;
const FAST_FRAME_MS = 20;
const FRAMES_PER_VERDICT = 45;

export interface CubeRendererOptions {
	size: PuzzleSize;
	/** Face colours, U R F D L B, as #rrggbb. */
	faceColors: string[];
	/** Tilt of the table the cube rests above (the home view's look-down angle), radians. */
	tableTilt: number;
	orientation: THREE.Quaternion;
	quality?: CubeQuality;
	/** No table and shadow, the cube centred (see Stage). Default true. */
	floor?: boolean;
	/** The logo on the U centre. Default true. */
	logo?: boolean;
	/**
	 * Floating hints, as cubing.js's scramble previews have them: a flat copy of every sticker
	 * a little way out from its face, facing the cube, so the faces turned away from the viewer
	 * show beside it (mirrored, as seen through the cube). Meant without the table: the shadow
	 * pass would draw them too.
	 */
	hints?: boolean;
}

/** How far beyond the faces the hints float. */
const HINT_DISTANCE = 0.9;
/** From a cap's frame (+z out of the face) to its hint: out along the normal, turned to face the cube. */
const HINT_OFFSET = new THREE.Matrix4().makeRotationY(Math.PI).setPosition(0, 0, HINT_DISTANCE);

/**
 * How a cap is drawn, as cubing.js stickering masks have it: in its colour, dimmed (half
 * the colour; a light colour stays light, as cubing.js keeps dimmed white light grey), one
 * flat grey ("ignored", as the trainer's 2D patterns draw a sticker that does not matter), or
 * not at all.
 */
export type CapLook = 'regular' | 'dim' | 'ignored' | 'invisible';

/** The look of each cap, by its piece (the cubie's solved position) and its side on that piece (normal in the piece's own frame). */
export type CapLooks = (home: THREE.Vector3, normal: THREE.Vector3) => CapLook;

/**
 * Lighter than cubing.js's flat 0x444444: under the studio light that one drew close to the
 * black body (measured ~#4e4e4e) and the masked layer lost its shape. This one draws about
 * where cubing.js's unlit grey did (~#666).
 */
const IGNORED_HEX = 0x5a5a5a;

interface CapView {
	/** Axis of the cubie's own frame this cap sits on. */
	axis: number;
	kind: CapKind;
	/** Its instance in its kind's batch. */
	slot: number;
	/** Where it sits inside its cubie (capMatrix). */
	local: THREE.Matrix4;
}

interface CubieView {
	group: THREE.Group;
	body: THREE.Mesh;
	uniforms: BodyUniforms;
	caps: CapView[];
}

/**
 * Every cap of one kind in a single draw, and their hints in another: a 7x7 has 294 caps,
 * and one mesh each made dragging it drop to ~13 fps on a 6x slowed CPU. Matrices follow
 * the cubies (syncTransforms), colours are per instance (the material is white).
 */
interface CapBatch {
	caps: THREE.InstancedMesh;
	hints: THREE.InstancedMesh | null;
}

const WHITE = new THREE.Color(1, 1, 1);
/** A cap not drawn (look 'invisible'): its instance shrunk to nothing. */
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/** U R F D L B to the palette's colour names, see stickerPaletteFromFaceColors. */
const PALETTE_KEYS = ['white', 'red', 'green', 'yellow', 'orange', 'blue'] as const;

export class CubeRenderer {
	readonly canvas: HTMLCanvasElement;
	private stage: Stage;
	private model: CubeModel;
	private animator: TurnAnimator;
	private views: CubieView[] = [];
	/** Indexed like model.caps. */
	private capViews: CapView[] = [];
	private colors: THREE.Color[] = [];
	private dimColors: THREE.Color[] = [];
	private ignoredColor = linearColor(IGNORED_HEX);
	/** Indexed like model.caps; empty means every cap in its colour. */
	private looks: CapLook[] = [];
	private batches = new Map<CapKind, CapBatch>();
	/** Indexed like model.caps: a cap whose look is 'invisible'. */
	private hidden: boolean[] = [];
	private capGeometries = new Map<CapKind, THREE.BufferGeometry>();
	private hintGeometries = new Map<CapKind, THREE.BufferGeometry>();
	/** By which sides carry caps: a 7x7 has 218 pieces but only 26 body shapes. */
	private bodyGeometries = new Map<string, THREE.BufferGeometry>();
	private logo: THREE.Mesh | null = null;
	private logoCapId = -1;
	private logoReady = false;
	private target = new THREE.Quaternion();
	private back: BackView = 'none';
	private active = true;
	private disposed = false;
	private dirty = true;
	private raf = 0;
	private exposureShown = false;
	private lastFrame = 0;
	private frameEma = 0;
	private frameCount = 0;
	/** Highest pixel ratio known to be too slow; never climbed back to. */
	private ratioCeiling = Infinity;

	constructor(options: CubeRendererOptions) {
		this.canvas = document.createElement('canvas');
		this.canvas.style.display = 'block';
		this.canvas.style.width = '100%';
		this.canvas.style.height = '100%';

		this.model = new CubeModel(options.size);
		this.animator = new TurnAnimator(this.model);
		const tilt = new THREE.Quaternion().setFromAxisAngle(AXES[0], options.tableTilt);
		this.stage = new Stage(this.canvas, options.quality ?? pickQuality(), options.size / 2, tilt, {
			floor: options.floor ?? true,
			margin: options.hints ? HINT_DISTANCE : 0,
		});
		this.target.copy(options.orientation);
		this.stage.cubeRoot.quaternion.copy(options.orientation);

		this.setColorsFrom(options.faceColors);
		this.build(options.logo ?? true, options.hints ?? false);
		this.paint();
		this.syncTransforms();
		// Nothing else would ask for a frame after a restore: the cube only draws on change.
		this.canvas.addEventListener('webglcontextrestored', this.onContextRestored);
	}

	private onContextRestored = () => {
		this.dirty = true;
		this.wake();
	};

	// ── Public API ──

	addMove(move: string) {
		if (!this.animator.push(move)) return;
		if (this.active) {
			this.wake();
			return;
		}
		// Not on screen: apply at once, so the view shows the cube as it is when it comes back
		// instead of playing the last few turns late.
		this.animator.flush();
		this.syncTransforms();
		this.stage.shadowDirty = true;
		this.dirty = true;
	}

	/** Show a reported state at once, dropping any turns still animating. A malformed string changes nothing. */
	setFacelets(facelets: string) {
		if (!this.model.setFacelets(facelets)) return;
		this.animator.clear();
		this.afterJump();
	}

	reset() {
		this.animator.clear();
		this.model.reset();
		this.afterJump();
	}

	/** Show the state these turns reach from solved at once, dropping any turns still animating. Unknown notation is skipped. */
	setMoves(moves: string[]) {
		this.animator.clear();
		this.model.reset();
		for (const move of moves) this.model.applyMove(move);
		this.afterJump();
	}

	/**
	 * Ease towards this orientation (the gyro's, or home). `immediate` puts the cube there on
	 * the next frame, for a caller that eases on its own clock (the replay).
	 */
	setOrientation(q: THREE.Quaternion, immediate = false) {
		this.target.copy(q);
		if (immediate) {
			const root = this.stage.cubeRoot.quaternion;
			if (root.equals(q)) return;
			root.copy(q);
			this.stage.shadowDirty = true;
			this.dirty = true;
		}
		this.wake();
	}

	setFaceColors(hexes: string[]) {
		this.setColorsFrom(hexes);
		this.paint();
		this.dirty = true;
		this.wake();
	}

	/** The cube from behind as well, in the same canvas (see Stage.render). */
	setBackView(back: BackView) {
		if (back === this.back) return;
		this.back = back;
		this.stage.shadowDirty = true;
		this.dirty = true;
		this.wake();
	}

	/** Draw caps as a stickering mask says (see CapLook); null draws every cap in its colour. The looks travel with the pieces. */
	setCapLooks(looks: CapLooks | null) {
		this.looks = [];
		if (looks) {
			for (const cubie of this.model.cubies) {
				for (const cap of cubie.caps) this.looks[cap.id] = looks(cubie.home, cap.normal);
			}
		}
		this.paint();
		this.dirty = true;
		this.wake();
	}

	/**
	 * The cube as it stands now, `pixels` square, as a PNG data URL: turns still animating and
	 * the orientation's easing are finished first. Draws at once, on or off screen; null when
	 * the context cannot hand the picture out.
	 */
	capture(pixels: number): string | null {
		if (this.stage.renderer.getContext().isContextLost()) return null;
		if (this.animator.busy) {
			this.animator.flush();
			this.syncTransforms();
			this.updateExposure();
		}
		this.stage.cubeRoot.quaternion.copy(this.target);
		this.stage.setPixels(pixels);
		this.stage.shadowDirty = true;
		this.stage.render(this.back);
		try {
			// Read in the same task as the draw: the drawing buffer is not preserved past it.
			return this.canvas.toDataURL('image/png');
		} catch {
			return null;
		}
	}

	resize(cssSize: number) {
		this.stage.resize(cssSize);
		this.dirty = true;
		this.wake();
	}

	/** Pause drawing (hidden, backgrounded). State keeps updating; the next frame catches up. */
	setActive(active: boolean) {
		this.active = active;
		if (!active) {
			if (this.raf) cancelAnimationFrame(this.raf);
			this.raf = 0;
			// Whatever was mid-air lands now; see addMove.
			if (this.animator.busy) {
				this.animator.flush();
				this.syncTransforms();
				this.updateExposure();
				this.stage.shadowDirty = true;
			}
		}
		if (active) {
			this.dirty = true;
			this.wake();
		}
	}

	dispose() {
		this.disposed = true;
		this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
		if (this.raf) cancelAnimationFrame(this.raf);
		this.raf = 0;
		this.bodyGeometries.forEach((g) => g.dispose());
		for (const view of this.views) (view.body.material as THREE.Material).dispose();
		this.batches.forEach(({ caps, hints }) => {
			(caps.material as THREE.Material).dispose();
			(hints?.material as THREE.Material | undefined)?.dispose();
		});
		this.capGeometries.forEach((g) => g.dispose());
		this.hintGeometries.forEach((g) => g.dispose());
		if (this.logo) {
			this.logo.geometry.dispose();
			const material = this.logo.material as THREE.MeshPhysicalMaterial;
			material.map?.dispose();
			material.dispose();
		}
		this.stage.dispose();
		this.canvas.remove();
	}

	// ── Building ──

	private setColorsFrom(hexes: string[]) {
		const palette = stickerPaletteFromFaceColors(hexes || []);
		const rgbs = PALETTE_KEYS.map((name) => palette[name]);
		this.colors = rgbs.map(([r, g, b]) => linearColor((r << 16) | (g << 8) | b));
		// Halved in sRGB as cubing.js does; a near-white keeps 0xDD of 0xFF, else it would read as grey.
		this.dimColors = rgbs.map((rgb) => {
			const k = rgb.every((c) => c > 0xe0) ? 0xdd / 0xff : 0.5;
			const [r, g, b] = rgb.map((c) => Math.round(c * k));
			return linearColor((r << 16) | (g << 8) | b);
		});
	}

	/** A cap's colour under its look; null for one not drawn. */
	private capColor(cap: Cap): THREE.Color | null {
		switch (this.looks[cap.id] ?? 'regular') {
			case 'invisible':
				return null;
			case 'ignored':
				return this.ignoredColor;
			case 'dim':
				return this.dimColors[cap.color];
			default:
				return this.colors[cap.color];
		}
	}

	private build(withLogo: boolean, withHints: boolean) {
		const { model, stage } = this;
		const logoAt = logoHome(model.hi);
		const counts = new Map<CapKind, number>();
		for (const cubie of model.cubies) {
			const group = new THREE.Group();
			const { material, uniforms } = createBodyMaterial(cubie.home);
			const body = new THREE.Mesh(this.bodyGeometry(cubie.home), material);
			body.castShadow = body.receiveShadow = true;
			group.add(body);

			const kind = capKindAt(cubie.home, model.hi);
			const view: CubieView = { group, body, uniforms, caps: [] };
			for (const cap of cubie.caps) {
				const slot = counts.get(kind) ?? 0;
				counts.set(kind, slot + 1);
				const axis = Math.abs(cap.normal.x) > 0.5 ? 0 : Math.abs(cap.normal.y) > 0.5 ? 1 : 2;
				const capView: CapView = { axis, kind, slot, local: capMatrix(cubie.home, cap.normal, model.hi) };
				view.caps.push(capView);
				this.capViews[cap.id] = capView;

				// The logo goes on a U piece: white in the standard scheme, whatever the user's palette.
				if (withLogo && cap.normal.y > 0.5 && cubie.home.equals(logoAt)) this.addLogo(group, cap.id);
			}
			this.views.push(view);
			stage.cubeRoot.add(group);
		}

		counts.forEach((count, kind) => {
			let geometry = this.capGeometries.get(kind);
			if (!geometry) {
				geometry = buildCapGeometry(capShapeFor(kind));
				this.capGeometries.set(kind, geometry);
			}
			const caps = this.instanced(geometry, createCapMaterial(WHITE, stage.liteCaps), count);
			caps.castShadow = caps.receiveShadow = true;
			// One-sided and facing the cube: a hint shows only from the far side, so only the
			// hidden faces' hints are seen.
			const hints = withHints ? this.instanced(this.hintGeometry(kind), new THREE.MeshBasicMaterial(), count) : null;
			this.batches.set(kind, { caps, hints });
		});
	}

	private instanced(geometry: THREE.BufferGeometry, material: THREE.Material, count: number): THREE.InstancedMesh {
		const mesh = new THREE.InstancedMesh(geometry, material, count);
		mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
		// Colours set before the first draw, so the shader is built with instance colours.
		for (let i = 0; i < count; i++) mesh.setColorAt(i, WHITE);
		// Its bounds are the one cap's at the origin; culling by them would drop the whole batch.
		mesh.frustumCulled = false;
		this.stage.cubeRoot.add(mesh);
		return mesh;
	}

	/** The body of the piece at `home`, shared with every piece whose caps sit on the same sides. */
	private bodyGeometry(home: THREE.Vector3): THREE.BufferGeometry {
		const { hi } = this.model;
		const side = (v: number) => (v > hi - 1e-6 ? 1 : v < -hi + 1e-6 ? -1 : 0);
		const key = `${side(home.x)},${side(home.y)},${side(home.z)}`;
		let geometry = this.bodyGeometries.get(key);
		if (!geometry) {
			// buildBodyGeometry reads only which sides are outer, so any piece of the kind will do.
			geometry = buildBodyGeometry(home, hi);
			this.bodyGeometries.set(key, geometry);
		}
		return geometry;
	}

	/** A flat cap outline, front facing +z, for the floating hints. */
	private hintGeometry(kind: CapKind): THREE.BufferGeometry {
		let geometry = this.hintGeometries.get(kind);
		if (!geometry) {
			const { x, y } = capOutline(capShapeFor(kind), DIM.capHalf, 0);
			const shape = new THREE.Shape(x.map((px, i) => new THREE.Vector2(px, y[i])));
			geometry = new THREE.ShapeGeometry(shape);
			this.hintGeometries.set(kind, geometry);
		}
		return geometry;
	}

	private addLogo(group: THREE.Group, capId: number) {
		const side = DIM.capHalf * 2 * DIM.logoScale;
		const texture = new THREE.TextureLoader().load(LOGO_URL, () => {
			if (this.disposed) return;
			this.logoReady = true;
			this.paint();
			this.dirty = true;
			this.wake();
		});
		texture.encoding = THREE.sRGBEncoding;
		texture.anisotropy = this.stage.renderer.capabilities.getMaxAnisotropy();
		const logo = new THREE.Mesh(new THREE.PlaneGeometry(side, side), createLogoMaterial(texture));
		logo.applyMatrix4(logoMatrix());
		logo.renderOrder = 1;
		logo.visible = false;
		group.add(logo);
		this.logo = logo;
		this.logoCapId = capId;
	}

	/** Push cap colours into their materials, and into the bodies for the glass tint. */
	private paint() {
		let visibilityChanged = false;
		for (const cap of this.model.caps) {
			const color = this.capColor(cap);
			const { kind, slot } = this.capViews[cap.id];
			const { caps, hints } = this.batches.get(kind) as CapBatch;
			if (this.hidden[cap.id] !== !color) visibilityChanged = true;
			this.hidden[cap.id] = !color;
			if (!color) continue;
			caps.setColorAt(slot, color);
			hints?.setColorAt(slot, color);
		}
		this.batches.forEach(({ caps, hints }) => {
			if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
			if (hints?.instanceColor) hints.instanceColor.needsUpdate = true;
		});
		// Hiding is done in the instance matrices.
		if (visibilityChanged) this.syncTransforms();
		this.model.cubies.forEach((cubie, i) => {
			const view = this.views[i];
			for (const u of view.uniforms.uCap) u.value.setRGB(0, 0, 0);
			cubie.caps.forEach((cap, j) => {
				const color = this.capColor(cap);
				if (color) view.uniforms.uCap[view.caps[j].axis].value.copy(color);
			});
		});
		if (this.logo) {
			// Only while the logo's piece shows U's colour: a state painted from facelets could
			// put another colour there, and a logo on it would be a lie. Not on a masked cap either.
			const cap = this.model.caps[this.logoCapId];
			this.logo.visible = this.logoReady && !!cap && cap.color === 0 && (this.looks[cap.id] ?? 'regular') === 'regular';
		}
	}

	private swapCapMaterials(lite: boolean) {
		this.batches.forEach(({ caps }) => {
			(caps.material as THREE.Material).dispose();
			caps.material = createCapMaterial(WHITE, lite);
		});
	}

	private afterJump() {
		this.syncTransforms();
		this.updateExposure();
		this.paint();
		this.stage.shadowDirty = true;
		this.dirty = true;
		this.wake();
	}

	// ── Per frame ──

	private syncTransforms() {
		const a = this.animator.active;
		const turn = a ? new THREE.Quaternion().setFromAxisAngle(AXES[a.move.axis], a.angle) : null;
		const moving = a ? new Set(a.cubies) : null;
		const piece = new THREE.Matrix4();
		const m = new THREE.Matrix4();
		this.model.cubies.forEach((cubie, i) => {
			const view = this.views[i];
			const group = view.group;
			group.position.copy(cubie.pos);
			group.quaternion.copy(cubie.quat);
			if (turn && moving?.has(cubie)) {
				group.position.applyQuaternion(turn);
				group.quaternion.premultiply(turn);
			}
			// The caps' instances follow their piece.
			piece.compose(group.position, group.quaternion, group.scale);
			cubie.caps.forEach((cap, j) => {
				const { kind, slot, local } = view.caps[j];
				const { caps, hints } = this.batches.get(kind) as CapBatch;
				if (this.hidden[cap.id]) {
					caps.setMatrixAt(slot, HIDDEN);
					hints?.setMatrixAt(slot, HIDDEN);
					return;
				}
				caps.setMatrixAt(slot, m.multiplyMatrices(piece, local));
				hints?.setMatrixAt(slot, m.multiply(HINT_OFFSET));
			});
		});
		this.batches.forEach(({ caps, hints }) => {
			caps.instanceMatrix.needsUpdate = true;
			if (hints) hints.instanceMatrix.needsUpdate = true;
		});
	}

	/**
	 * Open the glass on the faces a turn uncovers: between a turning layer and its still
	 * neighbour, on both sides of the cut. Written in each cubie's own frame, which is the
	 * frame its body shader works in.
	 */
	private updateExposure() {
		const a = this.animator.active;
		let open = 0;
		if (a && a.move.layers !== 'all') {
			const quarter = Math.PI / 2;
			open = Math.min(1, Math.abs(a.angle - Math.round(a.angle / quarter) * quarter) / GAP_FULLY_OPEN);
		}
		if (!open && !this.exposureShown) return;
		this.exposureShown = open > 0;

		const { model } = this;
		const moving = a ? new Set(a.cubies) : null;
		const inverse = new THREE.Quaternion();
		const dir = new THREE.Vector3();
		model.cubies.forEach((cubie, i) => {
			const { uExposePos, uExposeNeg } = this.views[i].uniforms;
			uExposePos.value.set(0, 0, 0);
			uExposeNeg.value.set(0, 0, 0);
			if (!open || !a || !moving) return;
			const axis = a.move.axis;
			for (const s of [1, -1]) {
				const neighbour = cubie.pos.getComponent(axis) + s;
				if (neighbour < model.lo - 1e-6 || neighbour > model.hi + 1e-6) continue;
				if (layerTurns(a.move, neighbour, model.lo, model.hi) === moving.has(cubie)) continue;
				// That world direction, in the cubie's own frame.
				dir.copy(AXES[axis]).multiplyScalar(s).applyQuaternion(inverse.copy(cubie.quat).invert());
				const k = Math.abs(dir.x) > 0.5 ? 0 : Math.abs(dir.y) > 0.5 ? 1 : 2;
				(dir.getComponent(k) > 0 ? uExposePos : uExposeNeg).value.setComponent(k, open);
			}
		});
	}

	private wake() {
		if (!this.raf && this.active && !this.disposed) this.raf = requestAnimationFrame(this.frame);
	}

	private frame = (now: number) => {
		this.raf = 0;
		if (!this.active || this.disposed) return;
		let changed = this.dirty;
		this.dirty = false;

		const wasTurning = this.animator.busy;
		if (this.animator.update(now) || wasTurning) {
			this.syncTransforms();
			this.updateExposure();
			this.stage.shadowDirty = true;
			changed = true;
		}

		const root = this.stage.cubeRoot.quaternion;
		if (root.angleTo(this.target) > 1e-4) {
			root.slerp(this.target, ORIENTATION_EASE);
			this.stage.shadowDirty = true;
			changed = true;
		} else if (!root.equals(this.target)) {
			root.copy(this.target);
			this.stage.shadowDirty = true;
			changed = true;
		}

		if (changed) {
			this.stage.render(this.back);
			this.adaptToFrameTime(now);
		} else {
			this.lastFrame = 0;
		}
		if (changed || this.animator.busy) this.raf = requestAnimationFrame(this.frame);
	};

	/**
	 * Only consecutive drawn frames count: an idle gap between two turns is not slowness.
	 * Too slow lowers the resolution first and drops to the low tier last; fast enough climbs
	 * back, but never to a ratio already found too slow.
	 */
	private adaptToFrameTime(now: number) {
		const last = this.lastFrame;
		this.lastFrame = now;
		if (!last) return;
		const dt = now - last;
		if (dt > 250) return;
		this.frameEma = this.frameEma ? this.frameEma * 0.9 + dt * 0.1 : dt;
		if (++this.frameCount < FRAMES_PER_VERDICT) return;
		this.frameCount = 0;

		const { stage } = this;
		const ratio = stage.currentPixelRatio;
		if (this.frameEma > SLOW_FRAME_MS) {
			this.ratioCeiling = ratio - 0.25;
			if (ratio > 1.01) {
				stage.setPixelRatio(ratio - 0.25);
			} else if (stage.quality !== 'low') {
				stage.setQuality('low');
				this.swapCapMaterials(true);
			}
			this.frameEma = 0;
			this.dirty = true;
		} else if (this.frameEma < FAST_FRAME_MS && ratio + 0.25 <= Math.min(stage.maxPixelRatio, this.ratioCeiling)) {
			stage.setPixelRatio(ratio + 0.25);
			this.dirty = true;
		}
	}
}
