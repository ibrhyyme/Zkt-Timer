import * as THREE from 'three';

import { STICKER_PALETTE, type FaceColor } from '../../../../timer/smart_cube/cube_view/cube_palette';
import { GAP_FULLY_OPEN, LOGO_URL } from '../../../../timer/smart_cube/cube_view/render/cube_renderer';
import {
	DIM,
	buildBodyGeometry,
	buildCapGeometry,
	capKindAt,
	capMatrix,
	capShapeFor,
	logoHome,
	logoMatrix,
	type CapKind,
} from '../../../../timer/smart_cube/cube_view/render/geometry';
import { createBodyMaterial, createCapMaterial, createLogoMaterial, linearColor, type BodyUniforms } from '../../../../timer/smart_cube/cube_view/render/materials';
import { QUALITY, bakeStudio, studioLights, type CubeQuality } from '../../../../timer/smart_cube/cube_view/render/stage';

/**
 * The landing cube's look: the smart-cube view's plastic, caps, ZKT logo and studio light,
 * worn by the landing engine's pieces (game.ts). Only the drawing changes.
 *
 * Every piece keeps its original body and stickers as invisible stand-ins, because the
 * engine's mechanics read them: the drag raycasts the bodies (Cube.cubes) and the solved
 * check reads the stickers' places and names (Cube.edges). three r125 raycasts invisible
 * meshes, so hiding them changes nothing there. The skin is a child of each piece, so it
 * follows every turn without being told.
 *
 * Units: the engine's pieces are 1/3 wide, the smart-cube geometry's cubies 1, so each piece
 * wears its skin in a child group scaled by the piece size.
 */

/** Face letters of the engine's stickers to the app's sticker colours. */
const FACE_COLORS: Record<string, FaceColor> = { U: 'white', R: 'red', F: 'green', D: 'yellow', L: 'orange', B: 'blue' };

/** Outward normal of each face letter, in a piece's own frame. */
const FACE_NORMALS: Record<string, [number, number, number]> = {
	L: [-1, 0, 0],
	R: [1, 0, 0],
	D: [0, -1, 0],
	U: [0, 1, 0],
	B: [0, 0, -1],
	F: [0, 0, 1],
};

/** Cube.init scales the cube to span +-0.5 at every size; the margin covers the idle float. */
const CUBE_REACH = Math.hypot(0.5, 0.5, 0.5) + 0.04;
/** The smart-cube stage's 0.012 per cubie, on pieces a third as wide. */
const NORMAL_BIAS = 0.004;
/** The landing draws every frame, so it never draws finer than it did before this skin. */
const MAX_PIXEL_RATIO = 2;
/** Frame-time verdicts as the smart-cube renderer makes them (CubeRenderer.adaptToFrameTime). */
const SLOW_FRAME_MS = 38;
const FAST_FRAME_MS = 20;
const FRAMES_PER_VERDICT = 45;
/** Frames not judged at the start, while the page around the cube is still loading. */
const WARMUP_FRAMES = 90;

interface PieceSkin {
	uniforms: BodyUniforms;
}

/** What the skin reads from the engine each frame to open the gaps of a turn. Read only. */
export interface TurnState {
	pieces: THREE.Object3D[];
	/** Names (indices) of the pieces in the layer turning now (Controls.flipLayer); empty when none is. */
	turning: number[];
	/** The turning layer's parent: its rotation is the turn so far (Controls.group). */
	group: THREE.Object3D;
	/** The turn's axis, in the cube's frame (Controls.flipAxis). */
	axis: THREE.Vector3;
}

function mainAxis(v: THREE.Vector3): number {
	const ax = Math.abs(v.x);
	const ay = Math.abs(v.y);
	const az = Math.abs(v.z);
	if (ax >= ay && ax >= az) return 0;
	return ay >= az ? 1 : 2;
}

export class CubeSkin {
	quality: CubeQuality;
	private renderer: THREE.WebGLRenderer;
	private scene: THREE.Scene;
	/** The camera's orientation: the studio and its lamps are turned with it. */
	private view: THREE.Quaternion;
	private key: THREE.DirectionalLight;
	private envTarget: THREE.WebGLRenderTarget;
	private capGeometries = new Map<CapKind, THREE.BufferGeometry>();
	/** One per face letter, shared by that face's caps. */
	private capMaterials = new Map<string, THREE.MeshStandardMaterial>();
	private caps: THREE.Mesh[] = [];
	private logoTexture: THREE.Texture | null = null;
	private pieceSize = 1;
	private hi = 1;
	private exposureShown = false;
	private pixelRatio = 0;
	/** Highest pixel ratio known to be too slow; never climbed back to. */
	private ratioCeiling = Infinity;
	private frameEma = 0;
	private frameCount = 0;
	private warmup = WARMUP_FRAMES;
	private disposed = false;

	constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, view: THREE.Quaternion, quality: CubeQuality) {
		this.renderer = renderer;
		this.scene = scene;
		this.view = view.clone();
		this.quality = quality;

		// The renderer setup the smart-cube stage runs with (stage.ts), on this renderer only.
		renderer.outputEncoding = THREE.sRGBEncoding;
		renderer.toneMapping = THREE.NoToneMapping;
		renderer.physicallyCorrectLights = true;
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = QUALITY[quality].softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;

		this.envTarget = this.bakeEnvironment();
		// A lost context takes the baked map with it; three restores geometry and images, not that.
		renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);

		const { rig, key } = studioLights();
		rig.quaternion.copy(this.view);
		const shadowCamera = key.shadow.camera;
		shadowCamera.left = shadowCamera.bottom = -CUBE_REACH;
		shadowCamera.right = shadowCamera.top = CUBE_REACH;
		const keyDistance = key.position.length();
		shadowCamera.near = keyDistance - CUBE_REACH - 0.2;
		shadowCamera.far = keyDistance + CUBE_REACH + 0.2;
		key.shadow.bias = -0.0004;
		key.shadow.normalBias = NORMAL_BIAS;
		this.key = key;
		scene.add(rig);

		this.applyQuality();
	}

	/**
	 * Put the skin on one of the engine's pieces. `home` is its solved place on the engine's
	 * grid (one unit per piece), `faces` the letters of its stickers, `hi` the outer layer's
	 * coordinate, (size - 1) / 2.
	 */
	dress(piece: THREE.Object3D, home: THREE.Vector3, faces: string[], pieceSize: number, hi: number) {
		this.pieceSize = pieceSize;
		this.hi = hi;

		const skin = new THREE.Group();
		skin.scale.setScalar(pieceSize);
		const { material, uniforms } = createBodyMaterial(home);
		const body = new THREE.Mesh(buildBodyGeometry(home, hi), material);
		body.castShadow = body.receiveShadow = true;
		skin.add(body);

		const kind = capKindAt(home, hi);
		const logoAt = logoHome(hi);
		for (const face of faces) {
			const normal = new THREE.Vector3(...FACE_NORMALS[face]);
			const cap = new THREE.Mesh(this.capGeometry(kind), this.capMaterial(face));
			cap.applyMatrix4(capMatrix(home, normal, hi));
			cap.castShadow = cap.receiveShadow = true;
			cap.userData.face = face;
			skin.add(cap);
			this.caps.push(cap);

			// The glass a turn uncovers takes a tint of the caps beside it (materials.ts).
			const axis = mainAxis(normal);
			uniforms.uCap[axis].value.copy(this.faceColor(face));

			// The white centre carries the logo, as on the smart-cube view.
			if (face === 'U' && home.equals(logoAt)) skin.add(this.createLogo());
		}

		piece.add(skin);
		const pieceSkin: PieceSkin = { uniforms };
		piece.userData.skin = pieceSkin;
	}

	/**
	 * Open the glass on the faces a turn uncovers, between the turning layer and its still
	 * neighbours, on both sides of the cut. Mirrors CubeRenderer.updateExposure, reading the
	 * engine's turn instead of the smart-cube model's.
	 */
	update(state: TurnState) {
		const { pieces, turning, group, axis } = state;
		let open = 0;
		if (turning.length > 0) {
			// The layer turns about one axis from rest (selectLayer), so the group's angle is the turn so far.
			const angle = 2 * Math.acos(Math.min(1, Math.abs(group.quaternion.w)));
			const quarter = Math.PI / 2;
			open = Math.min(1, Math.abs(angle - Math.round(angle / quarter) * quarter) / GAP_FULLY_OPEN);
		}
		if (!open && !this.exposureShown) return;
		this.exposureShown = open > 0;

		const k = mainAxis(axis);
		const moving = new Set(turning);
		// A turning piece sits in the group, which turns about this axis, so the coordinate reads the same in both frames.
		const coordinate = (piece: THREE.Object3D) => piece.position.getComponent(k) / this.pieceSize;
		const layer = open ? coordinate(pieces[turning[0]]) : 0;
		const inverse = new THREE.Quaternion();
		const dir = new THREE.Vector3();

		for (const piece of pieces) {
			const skin = piece.userData.skin as PieceSkin | undefined;
			if (!skin) continue;
			const { uExposePos, uExposeNeg } = skin.uniforms;
			uExposePos.value.set(0, 0, 0);
			uExposeNeg.value.set(0, 0, 0);
			if (!open) continue;

			const turns = moving.has(parseInt(piece.name, 10));
			const c = coordinate(piece);
			for (const s of [1, -1]) {
				const neighbour = c + s;
				if (Math.abs(neighbour) > this.hi + 1e-3) continue;
				// Only a cut between the turning layer and a still one opens.
				if ((Math.abs(neighbour - layer) < 1e-3) === turns) continue;
				// That side, in the piece's own frame: the frame its body shader works in.
				dir.set(0, 0, 0).setComponent(k, s).applyQuaternion(inverse.copy(piece.quaternion).invert());
				const j = mainAxis(dir);
				(dir.getComponent(j) > 0 ? uExposePos : uExposeNeg).value.setComponent(j, open);
			}
		}
	}

	/**
	 * Called once per drawn frame with the time since the last one. Too slow lowers the
	 * resolution first and drops to the low tier last; fast enough climbs back, but never to
	 * a ratio already found too slow. Same rules as the smart-cube renderer.
	 */
	adapt(delta: number) {
		if (this.warmup > 0) {
			this.warmup--;
			return;
		}
		// A gap this long is the tab coming back or the hero scrolling into view, not slowness.
		if (delta > 250) return;
		this.frameEma = this.frameEma ? this.frameEma * 0.9 + delta * 0.1 : delta;
		if (++this.frameCount < FRAMES_PER_VERDICT) return;
		this.frameCount = 0;

		const ratio = this.pixelRatio;
		if (this.frameEma > SLOW_FRAME_MS) {
			this.ratioCeiling = ratio - 0.25;
			if (ratio > 1.01) this.setPixelRatio(ratio - 0.25);
			else if (this.quality !== 'low') this.setQuality('low');
			this.frameEma = 0;
		} else if (this.frameEma < FAST_FRAME_MS && ratio + 0.25 <= Math.min(this.maxPixelRatio, this.ratioCeiling)) {
			this.setPixelRatio(ratio + 0.25);
		}
	}

	/** Releases what the scene traversal in CubeGame.dispose does not reach. */
	dispose() {
		this.disposed = true;
		this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
		this.envTarget.dispose();
		this.logoTexture?.dispose();
		// r125 types the map as a bare RenderTarget; at runtime it is a WebGLRenderTarget.
		(this.key.shadow.map as THREE.WebGLRenderTarget | null)?.dispose();
	}

	// ── Building ──

	private faceColor(face: string): THREE.Color {
		const [r, g, b] = STICKER_PALETTE[FACE_COLORS[face]];
		return linearColor((r << 16) | (g << 8) | b);
	}

	private capGeometry(kind: CapKind): THREE.BufferGeometry {
		let geometry = this.capGeometries.get(kind);
		if (!geometry) {
			geometry = buildCapGeometry(capShapeFor(kind));
			this.capGeometries.set(kind, geometry);
		}
		return geometry;
	}

	private capMaterial(face: string): THREE.MeshStandardMaterial {
		let material = this.capMaterials.get(face);
		if (!material) {
			material = createCapMaterial(this.faceColor(face), QUALITY[this.quality].liteCaps);
			this.capMaterials.set(face, material);
		}
		return material;
	}

	private createLogo(): THREE.Mesh {
		const side = DIM.capHalf * 2 * DIM.logoScale;
		let logo: THREE.Mesh | null = null;
		let loaded = false;
		const texture = new THREE.TextureLoader().load(LOGO_URL, () => {
			loaded = true;
			if (logo && !this.disposed) logo.visible = true;
		});
		texture.encoding = THREE.sRGBEncoding;
		texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
		logo = new THREE.Mesh(new THREE.PlaneGeometry(side, side), createLogoMaterial(texture));
		logo.applyMatrix4(logoMatrix());
		logo.renderOrder = 1;
		// Hidden until the image is in, so a blank square never shows first.
		logo.visible = loaded;
		this.logoTexture = texture;
		return logo;
	}

	private bakeEnvironment(): THREE.WebGLRenderTarget {
		const target = bakeStudio(this.renderer, this.view);
		this.scene.environment = target.texture;
		return target;
	}

	private onContextRestored = () => {
		// The old map is not disposed: its GL objects died with the lost context (see Stage).
		this.envTarget = this.bakeEnvironment();
	};

	// ── Quality ──

	private get maxPixelRatio(): number {
		return Math.min(window.devicePixelRatio || 1, QUALITY[this.quality].maxPixelRatio, MAX_PIXEL_RATIO);
	}

	private setPixelRatio(ratio: number) {
		const next = Math.max(0.75, Math.min(ratio, this.maxPixelRatio));
		if (Math.abs(next - this.pixelRatio) < 0.001) return;
		this.pixelRatio = next;
		// r125 resizes the drawing buffer to the current size at the new ratio.
		this.renderer.setPixelRatio(next);
	}

	private setQuality(quality: CubeQuality) {
		if (quality === this.quality) return;
		const swapCaps = QUALITY[quality].liteCaps !== QUALITY[this.quality].liteCaps;
		this.quality = quality;
		if (swapCaps) {
			const old = [...this.capMaterials.values()];
			this.capMaterials.clear();
			for (const cap of this.caps) cap.material = this.capMaterial(cap.userData.face);
			old.forEach((material) => material.dispose());
		}
		this.applyQuality();
	}

	private applyQuality() {
		const c = QUALITY[this.quality];
		this.key.castShadow = c.selfShadows;
		if (this.key.shadow.mapSize.x !== c.shadowMapSize) {
			this.key.shadow.mapSize.set(c.shadowMapSize, c.shadowMapSize);
			(this.key.shadow.map as THREE.WebGLRenderTarget | null)?.dispose();
			(this.key.shadow as any).map = null;
		}
		// Start at the tier's best; a later tier change never raises what timing lowered.
		this.setPixelRatio(this.pixelRatio ? Math.min(this.pixelRatio, this.maxPixelRatio) : this.maxPixelRatio);
	}
}
