import * as THREE from 'three';

import { stickerPaletteFromFaceColors } from '../cube_palette';
import { AXES, CubeModel, type PuzzleSize } from './cube_model';
import { DIM, buildBodyGeometry, buildCapGeometry, capKindAt, capMatrix, capShapeFor, logoHome, logoMatrix, type CapKind } from './geometry';
import { createBodyMaterial, createCapMaterial, createLogoMaterial, linearColor, type BodyUniforms } from './materials';
import { layerTurns } from './notation';
import { Stage, pickQuality, type CubeQuality } from './stage';
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
}

interface CapView {
	mesh: THREE.Mesh;
	/** Axis of the cubie's own frame this cap sits on. */
	axis: number;
}

interface CubieView {
	group: THREE.Group;
	body: THREE.Mesh;
	uniforms: BodyUniforms;
	caps: CapView[];
}

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
	private capGeometries = new Map<CapKind, THREE.BufferGeometry>();
	private logo: THREE.Mesh | null = null;
	private logoCapId = -1;
	private logoReady = false;
	private target = new THREE.Quaternion();
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
		this.stage = new Stage(this.canvas, options.quality ?? pickQuality(), options.size / 2, tilt);
		this.target.copy(options.orientation);
		this.stage.cubeRoot.quaternion.copy(options.orientation);

		this.setColorsFrom(options.faceColors);
		this.build();
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
		for (const view of this.views) {
			view.body.geometry.dispose();
			(view.body.material as THREE.Material).dispose();
			for (const cap of view.caps) (cap.mesh.material as THREE.Material).dispose();
		}
		this.capGeometries.forEach((g) => g.dispose());
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
		this.colors = PALETTE_KEYS.map((name) => {
			const [r, g, b] = palette[name];
			return linearColor((r << 16) | (g << 8) | b);
		});
	}

	private build() {
		const { model, stage } = this;
		const lite = stage.liteCaps;
		const logoAt = logoHome(model.hi);
		for (const cubie of model.cubies) {
			const group = new THREE.Group();
			const { material, uniforms } = createBodyMaterial(cubie.home);
			const body = new THREE.Mesh(buildBodyGeometry(cubie.home, model.hi), material);
			body.castShadow = body.receiveShadow = true;
			group.add(body);

			const kind = capKindAt(cubie.home, model.hi);
			const view: CubieView = { group, body, uniforms, caps: [] };
			for (const cap of cubie.caps) {
				let geometry = this.capGeometries.get(kind);
				if (!geometry) {
					geometry = buildCapGeometry(capShapeFor(kind));
					this.capGeometries.set(kind, geometry);
				}
				const mesh = new THREE.Mesh(geometry, createCapMaterial(this.colors[cap.color], lite));
				mesh.applyMatrix4(capMatrix(cubie.home, cap.normal, model.hi));
				mesh.castShadow = mesh.receiveShadow = true;
				group.add(mesh);
				const axis = Math.abs(cap.normal.x) > 0.5 ? 0 : Math.abs(cap.normal.y) > 0.5 ? 1 : 2;
				const capView: CapView = { mesh, axis };
				view.caps.push(capView);
				this.capViews[cap.id] = capView;

				// The logo goes on a U piece: white in the standard scheme, whatever the user's palette.
				if (cap.normal.y > 0.5 && cubie.home.equals(logoAt)) this.addLogo(group, cap.id);
			}
			this.views.push(view);
			stage.cubeRoot.add(group);
		}
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
		for (const cap of this.model.caps) {
			const color = this.colors[cap.color];
			(this.capViews[cap.id].mesh.material as THREE.MeshStandardMaterial).color.copy(color);
		}
		this.model.cubies.forEach((cubie, i) => {
			const view = this.views[i];
			for (const u of view.uniforms.uCap) u.value.setRGB(0, 0, 0);
			cubie.caps.forEach((cap, j) => view.uniforms.uCap[view.caps[j].axis].value.copy(this.colors[cap.color]));
		});
		if (this.logo) {
			// Only while the logo's piece shows U's colour: a state painted from facelets could
			// put another colour there, and a logo on it would be a lie.
			const cap = this.model.caps[this.logoCapId];
			this.logo.visible = this.logoReady && !!cap && cap.color === 0;
		}
	}

	private swapCapMaterials(lite: boolean) {
		for (const cap of this.model.caps) {
			const mesh = this.capViews[cap.id].mesh;
			(mesh.material as THREE.Material).dispose();
			mesh.material = createCapMaterial(this.colors[cap.color], lite);
		}
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
		this.model.cubies.forEach((cubie, i) => {
			const group = this.views[i].group;
			group.position.copy(cubie.pos);
			group.quaternion.copy(cubie.quat);
			if (turn && moving?.has(cubie)) {
				group.position.applyQuaternion(turn);
				group.quaternion.premultiply(turn);
			}
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
				if (layerTurns(a.move.layers, neighbour, model.lo, model.hi) === moving.has(cubie)) continue;
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
			this.stage.render();
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
