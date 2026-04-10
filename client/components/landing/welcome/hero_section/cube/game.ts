/**
 * Interactive Rubik's Cube game engine.
 * Ported from Dev-tanay/Rubik-Cube, rewritten for Three.js 0.125+ and TypeScript.
 *
 * Features:
 * - 3D Rubik's cube with rounded pieces + colored stickers
 * - Drag on a face to rotate that layer
 * - Drag outside the cube to orbit
 * - Scramble animation
 * - Solved detection
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry';
import { Tween, Easing } from './tween';

// ============================================
// Constants
// ============================================

const CUBE_SIZE = 3;
const PIECE_SIZE = 1 / 3;
const EDGE_SCALE = 0.82;
const EDGE_DEPTH = 0.01;
const EDGE_CORNER_ROUNDNESS = 0.15;
const PIECE_CORNER_RADIUS = 0.02;

const COLORS: Record<string, number> = {
	P: 0x08101a,  // Piece body
	U: 0xffffff,  // Up = White
	D: 0xffd500,  // Down = Yellow
	L: 0xff5800,  // Left = Orange
	R: 0xb71234,  // Right = Red
	F: 0x009b48,  // Front = Green
	B: 0x0046ad,  // Back = Blue
};

const FACE_NAMES = ['L', 'R', 'D', 'U', 'B', 'F'];

enum State {
	STILL,
	PREPARING,
	ROTATING,
	ANIMATING,
}

// ============================================
// Sticker Geometry
// ============================================

function createStickerGeometry(size: number, radius: number, depth: number): THREE.BufferGeometry {
	const x = -size / 2;
	const y = -size / 2;
	const w = size;
	const h = size;
	const r = size * radius;

	const shape = new THREE.Shape();
	shape.moveTo(x, y + r);
	shape.lineTo(x, y + h - r);
	shape.quadraticCurveTo(x, y + h, x + r, y + h);
	shape.lineTo(x + w - r, y + h);
	shape.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
	shape.lineTo(x + w, y + r);
	shape.quadraticCurveTo(x + w, y, x + w - r, y);
	shape.lineTo(x + r, y);
	shape.quadraticCurveTo(x, y, x, y + r);

	return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 3 });
}

// ============================================
// Draggable Helper
// ============================================

class Draggable {
	current = new THREE.Vector2();
	start = new THREE.Vector2();
	delta = new THREE.Vector2();
	drag = new THREE.Vector2();

	onDragStart: (pos: THREE.Vector2) => void = () => {};
	onDragMove: (pos: THREE.Vector2) => void = () => {};
	onDragEnd: (pos: THREE.Vector2) => void = () => {};

	private touch = false;
	private element: HTMLElement;
	private boundStart: (e: MouseEvent | TouchEvent) => void;
	private boundMove: (e: MouseEvent | TouchEvent) => void;
	private boundEnd: (e: MouseEvent | TouchEvent) => void;

	constructor(element: HTMLElement) {
		this.element = element;

		this.boundStart = (e: MouseEvent | TouchEvent) => {
			if (e instanceof MouseEvent && e.button !== 0 && e.button !== 2) return;
			if (e instanceof TouchEvent && e.touches.length > 1) return;

			this.getPosition(e);
			this.start.copy(this.current);
			this.delta.set(0, 0);
			this.drag.set(0, 0);
			this.touch = e instanceof TouchEvent;

			this.onDragStart(this.current);

			const moveEvent = this.touch ? 'touchmove' : 'mousemove';
			const endEvent = this.touch ? 'touchend' : 'mouseup';
			window.addEventListener(moveEvent, this.boundMove, { passive: false } as any);
			window.addEventListener(endEvent, this.boundEnd);
		};

		this.boundMove = (e: MouseEvent | TouchEvent) => {
			const old = this.current.clone();
			this.getPosition(e);
			this.delta.copy(this.current).sub(old);
			this.drag.copy(this.current).sub(this.start);
			this.onDragMove(this.current);
		};

		this.boundEnd = (e: MouseEvent | TouchEvent) => {
			this.getPosition(e);
			this.onDragEnd(this.current);

			const moveEvent = this.touch ? 'touchmove' : 'mousemove';
			const endEvent = this.touch ? 'touchend' : 'mouseup';
			window.removeEventListener(moveEvent, this.boundMove);
			window.removeEventListener(endEvent, this.boundEnd);
		};

		this.enable();
	}

	enable() {
		this.element.addEventListener('touchstart', this.boundStart, { passive: false });
		this.element.addEventListener('mousedown', this.boundStart);
	}

	disable() {
		this.element.removeEventListener('touchstart', this.boundStart);
		this.element.removeEventListener('mousedown', this.boundStart);
	}

	dispose() {
		this.disable();
	}

	private getPosition(e: MouseEvent | TouchEvent) {
		const ev = e instanceof TouchEvent
			? (e.touches[0] || e.changedTouches[0])
			: e;
		if (!ev) return;
		const rect = this.element.getBoundingClientRect();
		this.current.set(
			((ev as any).clientX - rect.left) / rect.width * 2 - 1,
			-(((ev as any).clientY - rect.top) / rect.height * 2 - 1)
		);
	}
}

// ============================================
// Scrambler
// ============================================

interface ConvertedMove {
	position: THREE.Vector3;
	axis: string;
	angle: number;
	name: string;
}

class Scrambler {
	converted: ConvertedMove[] = [];
	moves: string[] = [];

	scramble(length = 20) {
		this.moves = [];
		const faces = 'UDLRFB';
		const modifiers = ['', "'", '2'];

		let count = 0;
		while (count < length) {
			const face = faces[Math.floor(Math.random() * faces.length)];
			const mod = modifiers[Math.floor(Math.random() * 3)];
			const move = face + mod;

			if (count > 0 && move[0] === this.moves[count - 1][0]) continue;
			if (count > 1 && move[0] === this.moves[count - 2][0]) continue;

			this.moves.push(move);
			count++;
		}

		this.convert();
		return this;
	}

	private convert() {
		this.converted = [];
		for (const move of this.moves) {
			const cm = this.convertMove(move);
			this.converted.push(cm);
			if (move[1] === '2') this.converted.push(cm);
		}
	}

	private convertMove(move: string): ConvertedMove {
		const face = move[0];
		const mod = move[1];

		const axisMap: Record<string, string> = { D: 'y', U: 'y', L: 'x', R: 'x', F: 'z', B: 'z' };
		const rowMap: Record<string, number> = { D: -1, U: 1, L: -1, R: 1, F: 1, B: -1 };

		const axis = axisMap[face];
		const row = rowMap[face];

		const position = new THREE.Vector3();
		(position as any)[axis] = row;

		const angle = (Math.PI / 2) * -row * (mod === "'" ? -1 : 1);

		return { position, axis, angle, name: move };
	}
}

// ============================================
// CubeGame — Main Class
// ============================================

export class CubeGame {
	// Three.js scene
	private scene: THREE.Scene;
	private camera: THREE.PerspectiveCamera;
	private renderer: THREE.WebGLRenderer;

	// Cube hierarchy
	private holder: THREE.Object3D;        // idle floating animation
	private cubeObject: THREE.Object3D;    // the actual 3x3
	private controlGroup: THREE.Object3D;  // temp group for layer rotation
	private edges!: THREE.Mesh;            // invisible box: raycasting + orientation tracking

	// Model data
	private pieces: THREE.Object3D[] = [];
	private cubes: THREE.Mesh[] = [];      // body meshes (for raycasting)
	private stickers: THREE.Mesh[] = [];

	// Interaction
	private raycaster = new THREE.Raycaster();
	private helperPlane!: THREE.Mesh;
	private draggable: Draggable;

	// State
	private state = State.STILL;
	private flipType: 'layer' | 'cube' = 'layer';
	private flipAxis = new THREE.Vector3();
	private flipAngle = 0;
	private flipLayer: number[] = [];
	private dragDirection = '';
	private dragNormal = new THREE.Vector3();
	private dragCurrent = new THREE.Vector3();
	private dragTotal = new THREE.Vector3();
	private dragIntersect: THREE.Intersection | null = null;
	private gettingDrag = false;

	// Momentum tracking
	private momentum: { delta: THREE.Vector2; time: number }[] = [];

	// Scramble
	private scrambler = new Scrambler();
	private isScrambling = false;

	// Callbacks
	onSolved: (() => void) | null = null;
	onFirstMove: (() => void) | null = null;
	private firstMoveFired = false;

	// Animation
	private reqId = 0;
	private container: HTMLElement;
	private disposed = false;

	constructor(container: HTMLElement) {
		this.container = container;

		// Scene
		this.scene = new THREE.Scene();

		// Camera
		const fov = 10;
		this.camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 10000);
		this.scene.add(this.camera);

		// Renderer
		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		container.appendChild(this.renderer.domElement);
		this.renderer.domElement.style.width = '100%';
		this.renderer.domElement.style.height = '100%';
		this.renderer.domElement.style.display = 'block';
		this.renderer.domElement.style.touchAction = 'none';

		// Lights
		const lightsHolder = new THREE.Object3D();
		lightsHolder.add(new THREE.AmbientLight(0xffffff, 0.69));
		const front = new THREE.DirectionalLight(0xffffff, 0.36);
		front.position.set(1.5, 5, 3);
		lightsHolder.add(front);
		const back = new THREE.DirectionalLight(0xffffff, 0.19);
		back.position.set(-1.5, -5, -3);
		lightsHolder.add(back);
		this.scene.add(lightsHolder);

		// Cube hierarchy
		this.holder = new THREE.Object3D();
		this.cubeObject = new THREE.Object3D();
		this.controlGroup = new THREE.Object3D();
		this.controlGroup.name = 'controls';
		// Helpers
		const invisibleMat = new THREE.MeshBasicMaterial({
			depthWrite: false, transparent: true, opacity: 0, color: 0x0033ff,
		});

		// Single edges mesh: raycasting target AND orientation tracker (must rotate with cube)
		this.edges = new THREE.Mesh(
			new THREE.BoxGeometry(1, 1, 1),
			invisibleMat.clone()
		);

		this.holder.add(this.cubeObject);
		this.cubeObject.add(this.controlGroup);
		this.scene.add(this.holder);
		this.scene.add(this.edges);

		this.helperPlane = new THREE.Mesh(
			new THREE.PlaneGeometry(200, 200),
			invisibleMat.clone()
		);
		this.helperPlane.rotation.set(0, Math.PI / 4, 0);
		this.scene.add(this.helperPlane);

		// Build cube
		this.buildCube();

		// Setup interaction
		this.draggable = new Draggable(container);
		this.initDrag();

		// Resize & render
		this.resize();
		window.addEventListener('resize', this.resize);
		this.render();
	}

	// ============================================
	// Build 3x3 Cube Model
	// ============================================

	private buildCube() {
		const pieceGeo = new RoundedBoxGeometry(PIECE_SIZE, PIECE_SIZE, PIECE_SIZE, 3, PIECE_CORNER_RADIUS);
		const stickerGeo = createStickerGeometry(PIECE_SIZE, EDGE_CORNER_ROUNDNESS, EDGE_DEPTH);
		const baseMat = new THREE.MeshLambertMaterial();

		const first = -1; // for 3x3: -1, 0, 1

		for (let x = 0; x < CUBE_SIZE; x++) {
			for (let y = 0; y < CUBE_SIZE; y++) {
				for (let z = 0; z < CUBE_SIZE; z++) {
					const gx = first + x;
					const gy = first + y;
					const gz = first + z;

					// Determine which faces are exposed
					const edges: number[] = [];
					if (gx === -1) edges.push(0); // L
					if (gx === 1)  edges.push(1); // R
					if (gy === -1) edges.push(2); // D
					if (gy === 1)  edges.push(3); // U
					if (gz === -1) edges.push(4); // B
					if (gz === 1)  edges.push(5); // F

					const piece = new THREE.Object3D();
					piece.position.set(gx * PIECE_SIZE, gy * PIECE_SIZE, gz * PIECE_SIZE);

					// Body mesh
					const bodyMat = baseMat.clone() as THREE.MeshLambertMaterial;
					bodyMat.color.setHex(COLORS.P);
					const body = new THREE.Mesh(pieceGeo, bodyMat);
					piece.add(body);
					this.cubes.push(body);

					// Stickers
					const pieceEdges: string[] = [];

					for (const edgeIdx of edges) {
						const name = FACE_NAMES[edgeIdx];
						const mat = baseMat.clone() as THREE.MeshLambertMaterial;
						mat.color.setHex(COLORS[name]);
						const sticker = new THREE.Mesh(stickerGeo, mat);

						const dist = PIECE_SIZE / 2;
						const posArr = [[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
						const rotArr = [[0,-1,0],[0,1,0],[1,0,0],[-1,0,0],[0,2,0],[0,0,0]];

						sticker.position.set(
							dist * posArr[edgeIdx][0],
							dist * posArr[edgeIdx][1],
							dist * posArr[edgeIdx][2],
						);
						sticker.rotation.set(
							(Math.PI / 2) * rotArr[edgeIdx][0],
							(Math.PI / 2) * rotArr[edgeIdx][1],
							0,
						);
						sticker.scale.setScalar(EDGE_SCALE);
						sticker.name = name;

						piece.add(sticker);
						pieceEdges.push(name);
						this.stickers.push(sticker);
					}

					piece.userData.edges = pieceEdges;
					piece.userData.cube = body;
					piece.userData.start = {
						position: piece.position.clone(),
						rotation: piece.rotation.clone(),
					};
					piece.name = String(this.pieces.length);
					piece.frustumCulled = false;

					this.pieces.push(piece);
					this.cubeObject.add(piece);
				}
			}
		}
	}

	// ============================================
	// Interaction
	// ============================================

	private initDrag() {
		this.draggable.onDragStart = (pos) => {
			if (this.isScrambling) return;
			if (this.state === State.PREPARING || this.state === State.ROTATING) return;

			this.gettingDrag = this.state === State.ANIMATING;

			const edgeHit = this.intersect(pos, this.edges, false);

			if (edgeHit) {
				this.dragIntersect = this.intersect(pos, this.cubes, true);
			}

			if (edgeHit && this.dragIntersect) {
				this.dragNormal = edgeHit.face!.normal.clone().round();
				this.flipType = 'layer';

				this.attachTo(this.helperPlane, this.edges);
				this.helperPlane.rotation.set(0, 0, 0);
				this.helperPlane.position.set(0, 0, 0);
				// Three.js r125 lookAt works in WORLD space (r95 worked in parent-local space)
				// dragNormal is in edges-local space, so convert to world for lookAt
				const worldNormal = this.dragNormal.clone().applyQuaternion(this.edges.quaternion);
				this.helperPlane.lookAt(worldNormal);
				this.helperPlane.translateZ(0.5);
				this.helperPlane.updateMatrixWorld();
				this.detachFrom(this.helperPlane, this.edges);
			} else {
				this.dragNormal = new THREE.Vector3(0, 0, 1);
				this.flipType = 'cube';
				this.helperPlane.position.set(0, 0, 0);
				this.helperPlane.rotation.set(0, Math.PI / 4, 0);
				this.helperPlane.updateMatrixWorld();
			}

			const planeHit = this.intersect(pos, this.helperPlane, false);
			if (!planeHit) return;

			this.dragCurrent = this.helperPlane.worldToLocal(planeHit.point);
			this.dragTotal = new THREE.Vector3();
			this.state = this.state === State.STILL ? State.PREPARING : this.state;
		};

		this.draggable.onDragMove = (pos) => {
			if (this.isScrambling) return;
			if (this.state === State.STILL) return;
			if (this.state === State.ANIMATING && !this.gettingDrag) return;

			const planeHit = this.intersect(pos, this.helperPlane, false);
			if (!planeHit) return;

			const point = this.helperPlane.worldToLocal(planeHit.point.clone());
			const dragDelta = point.clone().sub(this.dragCurrent).setZ(0);
			this.dragTotal.add(dragDelta);
			this.dragCurrent = point;
			this.addMomentum(new THREE.Vector2(dragDelta.x, dragDelta.y));

			if (this.state === State.PREPARING && this.dragTotal.length() > 0.05) {
				this.dragDirection = this.getMainAxis(this.dragTotal);

				if (this.flipType === 'layer') {
					const dir = new THREE.Vector3();
					(dir as any)[this.dragDirection] = 1;

					const worldDir = this.helperPlane.localToWorld(dir).sub(this.helperPlane.position);
					const objectDir = this.edges.worldToLocal(worldDir).round();

					this.flipAxis = objectDir.cross(this.dragNormal).negate();
					this.selectLayer(this.getLayer());
				} else {
					const axis = this.dragDirection !== 'x'
						? (this.dragDirection === 'y' && this.draggable.current.x > 0 ? 'z' : 'x')
						: 'y';
					this.flipAxis = new THREE.Vector3();
					(this.flipAxis as any)[axis] = axis === 'x' ? -1 : 1;
				}

				this.flipAngle = 0;
				this.state = State.ROTATING;
			} else if (this.state === State.ROTATING) {
				const rotation = (dragDelta as any)[this.dragDirection] as number;

				if (this.flipType === 'layer') {
					this.controlGroup.rotateOnAxis(this.flipAxis, rotation);
					this.flipAngle += rotation;
				} else {
					this.edges.rotateOnWorldAxis(this.flipAxis, rotation);
					this.cubeObject.rotation.copy(this.edges.rotation);
					this.flipAngle += rotation;
				}
			}
		};

		this.draggable.onDragEnd = () => {
			if (this.isScrambling) return;
			if (this.state !== State.ROTATING) {
				this.gettingDrag = false;
				this.state = State.STILL;
				return;
			}

			this.state = State.ANIMATING;

			const mom = this.getMomentum();
			const momVal = this.dragDirection === 'x' ? mom.x : mom.y;
			const shouldFlip = Math.abs(momVal) > 0.05 && Math.abs(this.flipAngle) < Math.PI / 2;

			const targetAngle = shouldFlip
				? this.roundAngle(this.flipAngle + Math.sign(this.flipAngle) * (Math.PI / 4))
				: this.roundAngle(this.flipAngle);

			const deltaAngle = targetAngle - this.flipAngle;

			if (this.flipType === 'layer') {
				if (!this.firstMoveFired && this.onFirstMove) {
					this.firstMoveFired = true;
					this.onFirstMove();
				}
				this.animateLayerRotation(deltaAngle, false, () => {
					this.state = this.gettingDrag ? State.PREPARING : State.STILL;
					this.gettingDrag = false;
					this.checkSolved();
				});
			} else {
				this.animateCubeRotation(deltaAngle, () => {
					this.state = this.gettingDrag ? State.PREPARING : State.STILL;
					this.gettingDrag = false;
				});
			}
		};
	}

	// ============================================
	// Layer Selection & Rotation
	// ============================================

	private selectLayer(layer: number[]) {
		this.controlGroup.rotation.set(0, 0, 0);
		this.movePieces(layer, this.cubeObject, this.controlGroup);
		this.flipLayer = layer;
	}

	private deselectLayer(layer: number[]) {
		this.movePieces(layer, this.controlGroup, this.cubeObject);
		this.flipLayer = [];

		// Snap all piece positions to clean grid values to prevent floating point drift
		for (const piece of this.pieces) {
			piece.position.x = Math.round(piece.position.x * 3) / 3;
			piece.position.y = Math.round(piece.position.y * 3) / 3;
			piece.position.z = Math.round(piece.position.z * 3) / 3;
		}
	}

	private movePieces(layer: number[], from: THREE.Object3D, to: THREE.Object3D) {
		// Update entire scene hierarchy to ensure all matrixWorlds are current
		this.scene.updateMatrixWorld();

		for (const idx of layer) {
			const piece = this.pieces[idx];
			piece.applyMatrix4(from.matrixWorld);
			from.remove(piece);
			piece.applyMatrix4(to.matrixWorld.clone().invert());
			to.add(piece);
		}
	}

	private getLayer(): number[] {
		const scalar = 3;
		const piece = this.dragIntersect!.object.parent!;
		const axis = this.getMainAxis(this.flipAxis);
		const pos = piece.position.clone().multiplyScalar(scalar).round();

		const layer: number[] = [];
		for (const p of this.pieces) {
			const pp = p.position.clone().multiplyScalar(scalar).round();
			if ((pp as any)[axis] === (pos as any)[axis]) {
				layer.push(parseInt(p.name, 10));
			}
		}
		return layer;
	}

	private getLayerByPosition(position: THREE.Vector3): number[] {
		const scalar = 3;
		const axis = this.getMainAxis(position);
		const layer: number[] = [];

		for (const p of this.pieces) {
			const pp = p.position.clone().multiplyScalar(scalar).round();
			if ((pp as any)[axis] === (position as any)[axis]) {
				layer.push(parseInt(p.name, 10));
			}
		}
		return layer;
	}

	private animateLayerRotation(rotation: number, isScramble: boolean, callback: () => void) {
		const easing = isScramble ? Easing.Power.Out(3) : Easing.Sine.Out();
		const duration = isScramble ? 125 : 200;

		new Tween(duration, easing,
			(delta) => {
				this.controlGroup.rotateOnAxis(this.flipAxis, delta * rotation);
			},
			() => {
				this.cubeObject.rotation.setFromVector3(this.snapRotation(this.cubeObject.rotation));
				this.controlGroup.rotation.setFromVector3(this.snapRotation(this.controlGroup.rotation));
				this.deselectLayer(this.flipLayer);
				callback();
			}
		);
	}

	private animateCubeRotation(rotation: number, callback: () => void) {
		new Tween(150, Easing.Sine.Out(),
			(delta) => {
				this.edges.rotateOnWorldAxis(this.flipAxis, delta * rotation);
				this.cubeObject.rotation.copy(this.edges.rotation);
			},
			() => {
				this.edges.rotation.setFromVector3(this.snapRotation(this.edges.rotation));
				this.cubeObject.rotation.copy(this.edges.rotation);
				callback();
			}
		);
	}

	// ============================================
	// Scramble
	// ============================================

	reset() {
		this.firstMoveFired = false;
	}

	scramble(length = 20) {
		if (this.isScrambling) return;
		this.isScrambling = true;
		this.scrambler.scramble(length);
		this.doScrambleStep();
	}

	private doScrambleStep() {
		const moves = this.scrambler.converted;
		if (moves.length === 0) {
			this.isScrambling = false;
			return;
		}

		const move = moves[0];
		const layer = this.getLayerByPosition(move.position);

		this.flipAxis = new THREE.Vector3();
		(this.flipAxis as any)[move.axis] = 1;

		this.selectLayer(layer);
		this.animateLayerRotation(move.angle, true, () => {
			moves.shift();
			if (moves.length > 0) {
				this.doScrambleStep();
			} else {
				this.isScrambling = false;
			}
		});
	}

	// ============================================
	// Solved Check
	// ============================================

	private checkSolved() {
		const sides: Record<string, string[]> = {
			'x-': [], 'x+': [], 'y-': [], 'y+': [], 'z-': [], 'z+': [],
		};

		for (const sticker of this.stickers) {
			const worldPos = sticker.parent!
				.localToWorld(sticker.position.clone())
				.sub(this.cubeObject.position);

			const axis = this.getMainAxis(worldPos);
			const sign = worldPos.clone().multiplyScalar(2).round();
			const s = (sign as any)[axis] < 1 ? '-' : '+';
			sides[axis + s].push(sticker.name);
		}

		let solved = true;
		for (const side of Object.values(sides)) {
			if (side.length > 0 && !side.every((v) => v === side[0])) {
				solved = false;
				break;
			}
		}

		if (solved && this.onSolved) this.onSolved();
	}

	// ============================================
	// Raycasting
	// ============================================

	private intersect(pos: THREE.Vector2, target: THREE.Object3D | THREE.Object3D[], multiple: boolean): THREE.Intersection | null {
		this.raycaster.setFromCamera(pos, this.camera);
		const hits = multiple
			? this.raycaster.intersectObjects(target as THREE.Object3D[])
			: this.raycaster.intersectObject(target as THREE.Object3D);
		return hits.length > 0 ? hits[0] : null;
	}

	// ============================================
	// Helpers
	// ============================================

	private getMainAxis(v: THREE.Vector3 | any): string {
		const abs = { x: Math.abs(v.x || 0), y: Math.abs(v.y || 0), z: Math.abs(v.z || 0) };
		if (abs.x >= abs.y && abs.x >= abs.z) return 'x';
		if (abs.y >= abs.x && abs.y >= abs.z) return 'y';
		return 'z';
	}

	private roundAngle(angle: number): number {
		const step = Math.PI / 2;
		return Math.sign(angle) * Math.round(Math.abs(angle) / step) * step;
	}

	private snapRotation(euler: THREE.Euler): THREE.Vector3 {
		const v = euler.toVector3();
		return new THREE.Vector3(
			this.roundAngle(v.x),
			this.roundAngle(v.y),
			this.roundAngle(v.z)
		);
	}

	private attachTo(child: THREE.Object3D, parent: THREE.Object3D) {
		child.applyMatrix4(parent.matrixWorld.clone().invert());
		this.scene.remove(child);
		parent.add(child);
	}

	private detachFrom(child: THREE.Object3D, parent: THREE.Object3D) {
		child.applyMatrix4(parent.matrixWorld);
		parent.remove(child);
		this.scene.add(child);
	}

	private addMomentum(delta: THREE.Vector2) {
		const now = Date.now();
		this.momentum = this.momentum.filter((m) => now - m.time < 500);
		this.momentum.push({ delta, time: now });
	}

	private getMomentum(): THREE.Vector2 {
		const result = new THREE.Vector2();
		const n = this.momentum.length;
		this.momentum.forEach((p, i) => {
			result.add(p.delta.clone().multiplyScalar(i / n));
		});
		return result;
	}

	// ============================================
	// Resize & Render
	// ============================================

	private resize = () => {
		const w = this.container.clientWidth;
		const h = this.container.clientHeight;
		if (w === 0 || h === 0) return;

		this.renderer.setSize(w, h);
		this.camera.aspect = w / h;

		// Position camera to fit cube
		const fovRad = this.camera.fov * THREE.MathUtils.DEG2RAD;
		const stageH = 3;
		let distance = (stageH / 2) / Math.tan(fovRad / 2);
		distance *= 0.5;

		this.camera.position.set(distance, distance, distance);
		this.camera.lookAt(0, 0, 0);
		this.camera.updateProjectionMatrix();
	};

	private render = () => {
		if (this.disposed) return;
		this.reqId = requestAnimationFrame(this.render);

		// Subtle idle float
		const t = performance.now() * 0.001;
		this.holder.position.y = Math.sin(t * 0.5) * 0.003;
		this.holder.rotation.y = Math.sin(t * 0.3) * 0.01;

		this.renderer.render(this.scene, this.camera);
	};

	// ============================================
	// Dispose
	// ============================================

	dispose() {
		this.disposed = true;
		cancelAnimationFrame(this.reqId);
		window.removeEventListener('resize', this.resize);
		this.draggable.dispose();

		this.renderer.dispose();
		this.scene.traverse((obj: any) => {
			if (obj.geometry) obj.geometry.dispose();
			if (obj.material) {
				if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose());
				else obj.material.dispose();
			}
		});

		if (this.renderer.domElement.parentElement) {
			this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
		}
	}
}
