import * as THREE from 'three';

import { isNative } from '../../../../../util/platform';

/**
 * Everything around the cube: renderer, camera, light and the shadow under it.
 *
 * Most of the look comes from the environment, not the lamps: a small studio (a dim
 * gradient dome and a few bright softboxes) is baked once into a reflection map, so every
 * glossy bevel picks up a soft highlight the way real plastic does. Three directional
 * lights add the key, fill and rim on top.
 *
 * The canvas is transparent: the page's own background (themes, wallpapers) shows behind.
 */

export type CubeQuality = 'low' | 'medium' | 'high';

interface QualityConfig {
	maxPixelRatio: number;
	/** Pieces shadowing each other (visible inside an open turn). */
	selfShadows: boolean;
	shadowMapSize: number;
	softShadows: boolean;
	/** 'contact' follows the cube's real silhouette; 'blob' is a fixed soft disc. */
	floor: 'contact' | 'blob';
	/** No clear coat on the caps. */
	liteCaps: boolean;
}

const QUALITY: Record<CubeQuality, QualityConfig> = {
	low: { maxPixelRatio: 1.5, selfShadows: false, shadowMapSize: 512, softShadows: false, floor: 'blob', liteCaps: true },
	medium: { maxPixelRatio: 2, selfShadows: true, shadowMapSize: 1024, softShadows: false, floor: 'contact', liteCaps: false },
	high: { maxPixelRatio: 2.5, selfShadows: true, shadowMapSize: 2048, softShadows: true, floor: 'contact', liteCaps: false },
};

/** A first guess from the hardware; frame timing corrects it while the cube moves. */
export function pickQuality(): CubeQuality {
	const nav: any = typeof navigator !== 'undefined' ? navigator : {};
	const cores = nav.hardwareConcurrency || 4;
	const memory = nav.deviceMemory || 4;
	if (cores <= 4 || memory <= 2) return 'low';
	const coarse = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
	return isNative() || coarse ? 'medium' : 'high';
}

/** Narrow lens from far away: the cube keeps its proportions instead of bulging. */
const FOV = 26;
/** The table under the cube, in the tilted frame, this far below the cube's bottom face. */
const FLOOR_GAP = 0.45;
/** How far below the core the camera sits, per unit of the puzzle's half-width. */
const CAMERA_DROP = 0.2;

function studioScene(): THREE.Scene {
	const scene = new THREE.Scene();
	const dome = new THREE.SphereGeometry(30, 32, 16);
	const pos = dome.attributes.position;
	const colors: number[] = [];
	// The top stays moderate: the cube's top face mirrors this part of the dome, and a bright
	// sky there washes the top colour out to pastel.
	const low = new THREE.Color('#202227').convertSRGBToLinear();
	const high = new THREE.Color('#6c7078').convertSRGBToLinear();
	const c = new THREE.Color();
	for (let i = 0; i < pos.count; i++) {
		const t = THREE.MathUtils.smoothstep(pos.getY(i) / 30, -0.35, 0.85);
		c.copy(low).lerp(high, t);
		colors.push(c.r, c.g, c.b);
	}
	dome.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
	scene.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));

	const softbox = (w: number, h: number, intensity: number, at: [number, number, number], tint = '#ffffff') => {
		const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(intensity), side: THREE.DoubleSide });
		const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
		panel.position.set(...at);
		panel.lookAt(0, 0, 0);
		scene.add(panel);
	};
	// Big key box above and to the left, a tall strip on the right, a rim bar behind, a
	// small one overhead and a faint cool bounce from below.
	softbox(11, 7, 5.5, [-8, 11, 9]);
	softbox(3, 11, 2.4, [13, 2, 5], '#eaf0ff');
	softbox(13, 2.2, 1.7, [3, 5, -14]);
	softbox(6, 6, 0.9, [0, 15, 3]);
	softbox(16, 4, 0.6, [0, -11, 6], '#d6ddf5');
	return scene;
}

const blurVertex = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }
`;
const blurFragment = `
uniform sampler2D tMap;
uniform vec2 uStep;
varying vec2 vUv;
void main() {
	vec4 sum = texture2D( tMap, vUv ) * 0.2270;
	sum += texture2D( tMap, vUv + uStep * 1.3846 ) * 0.3162;
	sum += texture2D( tMap, vUv - uStep * 1.3846 ) * 0.3162;
	sum += texture2D( tMap, vUv + uStep * 3.2308 ) * 0.0703;
	sum += texture2D( tMap, vUv - uStep * 3.2308 ) * 0.0703;
	gl_FragColor = sum;
}
`;

/**
 * Soft shadow on an invisible table. The cube is rendered from below, straight up, into a
 * small target with nearness to the table as opacity, then blurred. Redrawn only when the
 * cube has moved.
 */
class ContactShadow {
	readonly group = new THREE.Group();
	private target: THREE.WebGLRenderTarget;
	private scratch: THREE.WebGLRenderTarget;
	private camera: THREE.OrthographicCamera;
	private depth: THREE.ShaderMaterial;
	private blur: THREE.ShaderMaterial;
	private quad: THREE.Mesh;
	private quadScene = new THREE.Scene();
	private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	readonly plane: THREE.Mesh;

	constructor(width: number, height: number, resolution = 256) {
		const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
		this.target = new THREE.WebGLRenderTarget(resolution, resolution, opts);
		this.scratch = new THREE.WebGLRenderTarget(resolution, resolution, opts);

		// Looks straight up from the table.
		this.camera = new THREE.OrthographicCamera(-width / 2, width / 2, width / 2, -width / 2, 0, height);
		this.camera.rotation.x = Math.PI / 2;
		this.group.add(this.camera);

		this.depth = new THREE.ShaderMaterial({
			uniforms: { uFar: { value: height } },
			vertexShader: `
				varying float vHeight;
				void main() {
					vec4 mv = modelViewMatrix * vec4( position, 1.0 );
					vHeight = -mv.z;
					gl_Position = projectionMatrix * mv;
				}`,
			fragmentShader: `
				uniform float uFar;
				varying float vHeight;
				void main() {
					float k = 1.0 - clamp( vHeight / uFar, 0.0, 1.0 );
					gl_FragColor = vec4( 0.0, 0.0, 0.0, k * k );
				}`,
		});

		this.blur = new THREE.ShaderMaterial({
			uniforms: { tMap: { value: null }, uStep: { value: new THREE.Vector2() } },
			vertexShader: blurVertex,
			fragmentShader: blurFragment,
			depthTest: false,
			depthWrite: false,
		});
		this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blur);
		this.quadScene.add(this.quad);

		// Fades out towards its rim so the shadow never ends in a visible edge.
		const planeMaterial = new THREE.ShaderMaterial({
			uniforms: { tMap: { value: this.target.texture }, uOpacity: { value: 0.6 } },
			vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
			fragmentShader: `
				uniform sampler2D tMap;
				uniform float uOpacity;
				varying vec2 vUv;
				void main() {
					float a = texture2D( tMap, vUv ).a;
					float rim = 1.0 - smoothstep( 0.3, 0.5, length( vUv - 0.5 ) );
					gl_FragColor = vec4( 0.0, 0.0, 0.0, a * rim * uOpacity );
				}`,
			transparent: true,
			depthWrite: false,
		});
		this.plane = new THREE.Mesh(new THREE.PlaneGeometry(width, width), planeMaterial);
		// Seen from below by the shadow camera, so the texture has to be flipped back.
		this.plane.rotation.x = -Math.PI / 2;
		this.plane.scale.y = -1;
		this.plane.renderOrder = -1;
		this.group.add(this.plane);
	}

	render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, hide: THREE.Object3D[]) {
		const previousTarget = renderer.getRenderTarget();
		const clearColor = renderer.getClearColor(new THREE.Color());
		const clearAlpha = renderer.getClearAlpha();
		const shadowAutoUpdate = renderer.shadowMap.autoUpdate;
		const visible = hide.map((o) => o.visible);
		hide.forEach((o) => (o.visible = false));
		this.plane.visible = false;
		renderer.shadowMap.autoUpdate = false;

		scene.overrideMaterial = this.depth;
		renderer.setClearColor(0x000000, 0);
		renderer.setRenderTarget(this.target);
		renderer.clear();
		renderer.render(scene, this.camera);
		scene.overrideMaterial = null;

		const texel = 1 / this.target.width;
		this.blurPass(renderer, 3.2 * texel);
		this.blurPass(renderer, 1.4 * texel);

		hide.forEach((o, i) => (o.visible = visible[i]));
		this.plane.visible = true;
		renderer.shadowMap.autoUpdate = shadowAutoUpdate;
		renderer.setRenderTarget(previousTarget);
		renderer.setClearColor(clearColor, clearAlpha);
	}

	private blurPass(renderer: THREE.WebGLRenderer, step: number) {
		this.blur.uniforms.tMap.value = this.target.texture;
		this.blur.uniforms.uStep.value.set(step, 0);
		renderer.setRenderTarget(this.scratch);
		renderer.render(this.quadScene, this.quadCamera);
		this.blur.uniforms.tMap.value = this.scratch.texture;
		this.blur.uniforms.uStep.value.set(0, step);
		renderer.setRenderTarget(this.target);
		renderer.render(this.quadScene, this.quadCamera);
	}

	dispose() {
		this.target.dispose();
		this.scratch.dispose();
		this.depth.dispose();
		this.blur.dispose();
		this.quad.geometry.dispose();
		this.plane.geometry.dispose();
		(this.plane.material as THREE.Material).dispose();
	}
}

/** Fixed soft disc for weak devices: no extra render, one textured quad. */
function blobShadow(width: number): THREE.Mesh {
	const material = new THREE.ShaderMaterial({
		vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
		fragmentShader: `
			varying vec2 vUv;
			void main() {
				float d = length( vUv - 0.5 ) * 2.0;
				float a = 1.0 - smoothstep( 0.0, 1.0, d );
				gl_FragColor = vec4( 0.0, 0.0, 0.0, a * a * 0.5 );
			}`,
		transparent: true,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width), material);
	mesh.rotation.x = -Math.PI / 2;
	mesh.renderOrder = -1;
	return mesh;
}

export class Stage {
	readonly renderer: THREE.WebGLRenderer;
	readonly scene = new THREE.Scene();
	readonly camera: THREE.PerspectiveCamera;
	/** Holds the cube; its rotation is the viewing angle plus the gyro. */
	readonly cubeRoot = new THREE.Group();
	quality: CubeQuality;
	private config: QualityConfig;
	private key: THREE.DirectionalLight;
	private floor = new THREE.Group();
	private contact: ContactShadow | null = null;
	private blob: THREE.Mesh | null = null;
	private envTarget: THREE.WebGLRenderTarget;
	private cssSize = 1;
	/** 0 until the first quality is applied. */
	private pixelRatio = 0;
	/** Radius of a sphere the cube never leaves, whatever its orientation. */
	private reach: number;
	shadowDirty = true;

	/**
	 * `floor: false` leaves out the table and its shadow and centres the camera on the cube: a
	 * still picture (trainer case images) is the cube alone, as large as the frame allows.
	 */
	constructor(canvas: HTMLCanvasElement, quality: CubeQuality, puzzleHalf: number, tableTilt: THREE.Quaternion, {floor = true} = {}) {
		this.quality = quality;
		this.config = QUALITY[quality];
		this.reach = puzzleHalf * Math.sqrt(3) + 0.02;

		const renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			alpha: true,
			powerPreference: quality === 'low' ? 'low-power' : 'default',
		});
		renderer.setClearColor(0x000000, 0);
		renderer.outputEncoding = THREE.sRGBEncoding;
		// Tone mapping happens in the materials, see materials.ts.
		renderer.toneMapping = THREE.NoToneMapping;
		// r125's legacy mode multiplies every lamp by pi, which washed the colours towards white.
		// Per renderer, so the landing cube on the same three copy keeps its own lighting.
		renderer.physicallyCorrectLights = true;
		renderer.shadowMap.enabled = true;
		this.renderer = renderer;

		this.envTarget = this.bakeEnvironment();
		// A lost context takes the baked reflection map with it (three re-uploads geometry and
		// image textures on its own, not render-target contents), so it is baked again. three's
		// own restore listener was added first, so the context is usable by the time this runs.
		canvas.addEventListener('webglcontextrestored', this.onContextRestored);

		// The camera sits a little below the core so the shadow in front of the cube stays in
		// frame, and far enough that the cube's whole reach still fits from there.
		this.camera = new THREE.PerspectiveCamera(FOV, 1, 1, 100);
		const halfFov = THREE.MathUtils.degToRad(FOV / 2);
		const drop = floor ? puzzleHalf * CAMERA_DROP : 0;
		let distance = this.reach / Math.sin(halfFov);
		while (Math.atan(drop / distance) + Math.asin(this.reach / distance) > halfFov) distance += 0.05;
		this.camera.position.set(0, -drop, distance);

		this.key = new THREE.DirectionalLight(0xffffff, 2.6);
		this.key.position.set(-4.5, 7.5, 6);
		const shadowCamera = this.key.shadow.camera;
		shadowCamera.left = shadowCamera.bottom = -this.reach;
		shadowCamera.right = shadowCamera.top = this.reach;
		const keyDistance = this.key.position.length();
		shadowCamera.near = keyDistance - this.reach - 0.5;
		shadowCamera.far = keyDistance + this.reach + 0.5;
		this.key.shadow.bias = -0.0004;
		this.key.shadow.normalBias = 0.012;
		this.scene.add(this.key);
		const fill = new THREE.DirectionalLight(0xe4ebff, 1.4);
		fill.position.set(7, 1.5, 4);
		this.scene.add(fill);
		const rim = new THREE.DirectionalLight(0xffffff, 1.0);
		rim.position.set(2.5, 5, -8);
		this.scene.add(rim);

		this.scene.add(this.cubeRoot);

		// The table is level in the tilted frame the cube rests in, so the camera sees it from
		// above even though the camera itself looks straight ahead.
		if (floor) {
			this.floor.quaternion.copy(tableTilt);
			const floorHeight = -(puzzleHalf + FLOOR_GAP);
			const floorWidth = this.reach * 2.6;
			this.contact = new ContactShadow(floorWidth, puzzleHalf * 3.2);
			this.contact.group.position.y = floorHeight;
			this.floor.add(this.contact.group);
			this.blob = blobShadow(puzzleHalf * 3.4);
			this.blob.position.y = floorHeight;
			this.floor.add(this.blob);
			this.scene.add(this.floor);
		}

		this.applyQuality();
	}

	get liteCaps(): boolean {
		return this.config.liteCaps;
	}

	private bakeEnvironment(): THREE.WebGLRenderTarget {
		const pmrem = new THREE.PMREMGenerator(this.renderer);
		const studio = studioScene();
		const target = pmrem.fromScene(studio, 0.03);
		pmrem.dispose();
		// Only needed for the bake; left alive, its buffers sit on the GPU for the view's life.
		studio.traverse((o) => {
			const mesh = o as THREE.Mesh;
			if (!mesh.isMesh) return;
			mesh.geometry.dispose();
			(mesh.material as THREE.Material).dispose();
		});
		this.scene.environment = target.texture;
		return target;
	}

	private onContextRestored = () => {
		// The old map is not disposed: its GL objects died with the lost context, and deleting
		// them on the new one only raises INVALID_OPERATION warnings.
		this.envTarget = this.bakeEnvironment();
		this.shadowDirty = true;
	};

	setQuality(quality: CubeQuality) {
		if (quality === this.quality) return;
		this.quality = quality;
		this.config = QUALITY[quality];
		this.applyQuality();
	}

	private applyQuality() {
		const c = this.config;
		this.key.castShadow = c.selfShadows;
		this.renderer.shadowMap.type = c.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
		if (this.key.shadow.mapSize.x !== c.shadowMapSize) {
			this.key.shadow.mapSize.set(c.shadowMapSize, c.shadowMapSize);
			// r125 types the map as a bare RenderTarget; at runtime it is a WebGLRenderTarget.
			(this.key.shadow.map as THREE.WebGLRenderTarget | null)?.dispose();
			(this.key.shadow as any).map = null;
		}
		if (this.contact) this.contact.group.visible = c.floor === 'contact';
		if (this.blob) this.blob.visible = c.floor === 'blob';
		// Start at the tier's best; a later tier change never raises what timing lowered.
		this.setPixelRatio(this.pixelRatio ? Math.min(this.pixelRatio, c.maxPixelRatio) : c.maxPixelRatio);
		this.shadowDirty = true;
	}

	get maxPixelRatio(): number {
		return Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, this.config.maxPixelRatio);
	}

	get currentPixelRatio(): number {
		return this.pixelRatio;
	}

	setPixelRatio(ratio: number) {
		const next = Math.max(0.75, Math.min(ratio, this.maxPixelRatio));
		if (Math.abs(next - this.pixelRatio) < 0.001) return;
		this.pixelRatio = next;
		this.renderer.setPixelRatio(next);
		this.renderer.setSize(this.cssSize, this.cssSize, false);
	}

	resize(cssSize: number) {
		this.cssSize = Math.max(1, Math.round(cssSize));
		this.renderer.setPixelRatio(this.pixelRatio);
		this.renderer.setSize(this.cssSize, this.cssSize, false);
	}

	/** Exactly this many pixels a side, whatever the screen: for a picture, not a view. */
	setPixels(pixels: number) {
		this.pixelRatio = 1;
		this.resize(pixels);
	}

	render() {
		if (this.contact && this.config.floor === 'contact' && this.shadowDirty) {
			this.contact.render(this.renderer, this.scene, [this.blob as THREE.Object3D]);
		}
		this.shadowDirty = false;
		this.renderer.render(this.scene, this.camera);
	}

	dispose() {
		this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
		this.contact?.dispose();
		if (this.blob) {
			this.blob.geometry.dispose();
			(this.blob.material as THREE.Material).dispose();
		}
		this.envTarget.dispose();
		(this.key.shadow.map as THREE.WebGLRenderTarget | null)?.dispose();
		this.renderer.dispose();
		this.renderer.forceContextLoss();
	}
}
