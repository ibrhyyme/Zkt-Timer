/**
 * Interactive Rubik's Cube engine for landing hero.
 * Direct port of Dev-tanay/Rubik-Cube (script.js), adapted to TypeScript + Three.js r125.
 *
 * Class organization mirrors the reference exactly:
 *   - RoundedBoxGeometry / RoundedPlaneGeometry  (geometry helpers)
 *   - Draggable                                  (pointer event handler)
 *   - Cube                                       (hierarchy + piece model)
 *   - Scrambler                                  (move generator)
 *   - Controls                                   (drag → layer/cube rotation)
 *   - World                                      (scene/camera/renderer/lights)
 *   - CubeGame                                   (orchestrator; landing-specific
 *                                                 subset of reference `Game`)
 *
 * Reference line ranges in script.js are noted inline.
 */

import * as THREE from 'three';
import { Animation, Tween, Easing } from './tween';

// ============================================
// Constants
// ============================================

const STILL = 0;
const PREPARING = 1;
const ROTATING = 2;
const ANIMATING = 3;

const COLORS: Record<string, number> = {
	P: 0x08101a,  // Piece body
	U: 0xffffff,  // Up = White
	D: 0xffd500,  // Down = Yellow
	L: 0xff5800,  // Left = Orange
	R: 0xb71234,  // Right = Red
	F: 0x009b48,  // Front = Green
	B: 0x0046ad,  // Back = Blue
};

// ============================================
// RoundedBoxGeometry  (script.js 211-674)
// ============================================

class RoundedBoxGeometry extends THREE.BufferGeometry {
	type = 'RoundedBoxGeometry';
	parameters: any;

	constructor(size: number, radius: number, radiusSegments: number) {
		super();

		radiusSegments = !isNaN(radiusSegments) ? Math.max(1, Math.floor(radiusSegments)) : 1;

		let width: number, height: number, depth: number;
		width = height = depth = size;
		radius = size * radius;

		radius = Math.min(radius, Math.min(width, Math.min(height, depth)) / 2);

		const edgeHalfWidth = width / 2 - radius;
		const edgeHalfHeight = height / 2 - radius;
		const edgeHalfDepth = depth / 2 - radius;

		this.parameters = { width, height, depth, radius, radiusSegments };

		const rs1 = radiusSegments + 1;
		const totalVertexCount = (rs1 * radiusSegments + 1) << 3;

		const positions = new THREE.BufferAttribute(new Float32Array(totalVertexCount * 3), 3);
		const normals = new THREE.BufferAttribute(new Float32Array(totalVertexCount * 3), 3);

		const cornerVerts: THREE.Vector3[][] = [];
		const cornerNormals: THREE.Vector3[][] = [];
		const vertex = new THREE.Vector3();
		const vertexPool: THREE.Vector3[] = [];
		const normalPool: THREE.Vector3[] = [];
		const indices: number[] = [];

		const lastVertex = rs1 * radiusSegments;
		const cornerVertNumber = rs1 * radiusSegments + 1;

		doVertices();
		doFaces();
		doCorners();
		doHeightEdges();
		doWidthEdges();
		doDepthEdges();

		function doVertices() {
			const cornerLayout = [
				new THREE.Vector3(1, 1, 1),
				new THREE.Vector3(1, 1, -1),
				new THREE.Vector3(-1, 1, -1),
				new THREE.Vector3(-1, 1, 1),
				new THREE.Vector3(1, -1, 1),
				new THREE.Vector3(1, -1, -1),
				new THREE.Vector3(-1, -1, -1),
				new THREE.Vector3(-1, -1, 1),
			];

			for (let j = 0; j < 8; j++) {
				cornerVerts.push([]);
				cornerNormals.push([]);
			}

			const PIhalf = Math.PI / 2;
			const cornerOffset = new THREE.Vector3(edgeHalfWidth, edgeHalfHeight, edgeHalfDepth);

			for (let y = 0; y <= radiusSegments; y++) {
				const v = y / radiusSegments;
				const va = v * PIhalf;
				const cosVa = Math.cos(va);
				const sinVa = Math.sin(va);

				if (y === radiusSegments) {
					vertex.set(0, 1, 0);
					const vert = vertex.clone().multiplyScalar(radius).add(cornerOffset);
					cornerVerts[0].push(vert);
					vertexPool.push(vert);
					const norm = vertex.clone();
					cornerNormals[0].push(norm);
					normalPool.push(norm);
					continue;
				}

				for (let x = 0; x <= radiusSegments; x++) {
					const u = x / radiusSegments;
					const ha = u * PIhalf;
					vertex.x = cosVa * Math.cos(ha);
					vertex.y = sinVa;
					vertex.z = cosVa * Math.sin(ha);

					const vert = vertex.clone().multiplyScalar(radius).add(cornerOffset);
					cornerVerts[0].push(vert);
					vertexPool.push(vert);

					const norm = vertex.clone().normalize();
					cornerNormals[0].push(norm);
					normalPool.push(norm);
				}
			}

			for (let i = 1; i < 8; i++) {
				for (let j = 0; j < cornerVerts[0].length; j++) {
					const vert = cornerVerts[0][j].clone().multiply(cornerLayout[i]);
					cornerVerts[i].push(vert);
					vertexPool.push(vert);

					const norm = cornerNormals[0][j].clone().multiply(cornerLayout[i]);
					cornerNormals[i].push(norm);
					normalPool.push(norm);
				}
			}
		}

		function doCorners() {
			const flips = [true, false, true, false, false, true, false, true];
			const lastRowOffset = rs1 * (radiusSegments - 1);

			for (let i = 0; i < 8; i++) {
				const cornerOffset = cornerVertNumber * i;

				for (let v = 0; v < radiusSegments - 1; v++) {
					const r1 = v * rs1;
					const r2 = (v + 1) * rs1;

					for (let u = 0; u < radiusSegments; u++) {
						const u1 = u + 1;
						const a = cornerOffset + r1 + u;
						const b = cornerOffset + r1 + u1;
						const c = cornerOffset + r2 + u;
						const d = cornerOffset + r2 + u1;

						if (!flips[i]) {
							indices.push(a, b, c, b, d, c);
						} else {
							indices.push(a, c, b, b, c, d);
						}
					}
				}

				for (let u = 0; u < radiusSegments; u++) {
					const a = cornerOffset + lastRowOffset + u;
					const b = cornerOffset + lastRowOffset + u + 1;
					const c = cornerOffset + lastVertex;

					if (!flips[i]) {
						indices.push(a, b, c);
					} else {
						indices.push(a, c, b);
					}
				}
			}
		}

		function doFaces() {
			let a = lastVertex;
			let b = lastVertex + cornerVertNumber;
			let c = lastVertex + cornerVertNumber * 2;
			let d = lastVertex + cornerVertNumber * 3;
			indices.push(a, b, c, a, c, d);

			a = lastVertex + cornerVertNumber * 4;
			b = lastVertex + cornerVertNumber * 5;
			c = lastVertex + cornerVertNumber * 6;
			d = lastVertex + cornerVertNumber * 7;
			indices.push(a, c, b, a, d, c);

			a = 0;
			b = cornerVertNumber;
			c = cornerVertNumber * 4;
			d = cornerVertNumber * 5;
			indices.push(a, c, b, b, c, d);

			a = cornerVertNumber * 2;
			b = cornerVertNumber * 3;
			c = cornerVertNumber * 6;
			d = cornerVertNumber * 7;
			indices.push(a, c, b, b, c, d);

			a = radiusSegments;
			b = radiusSegments + cornerVertNumber * 3;
			c = radiusSegments + cornerVertNumber * 4;
			d = radiusSegments + cornerVertNumber * 7;
			indices.push(a, b, c, b, d, c);

			a = radiusSegments + cornerVertNumber;
			b = radiusSegments + cornerVertNumber * 2;
			c = radiusSegments + cornerVertNumber * 5;
			d = radiusSegments + cornerVertNumber * 6;
			indices.push(a, c, b, b, c, d);
		}

		function doHeightEdges() {
			for (let i = 0; i < 4; i++) {
				const cOffset = i * cornerVertNumber;
				const cRowOffset = 4 * cornerVertNumber + cOffset;
				const needsFlip = (i & 1) === 1;

				for (let u = 0; u < radiusSegments; u++) {
					const u1 = u + 1;
					const a = cOffset + u;
					const b = cOffset + u1;
					const c = cRowOffset + u;
					const d = cRowOffset + u1;

					if (!needsFlip) {
						indices.push(a, b, c, b, d, c);
					} else {
						indices.push(a, c, b, b, c, d);
					}
				}
			}
		}

		function doDepthEdges() {
			const cStarts = [0, 2, 4, 6];
			const cEnds = [1, 3, 5, 7];

			for (let i = 0; i < 4; i++) {
				const cStart = cornerVertNumber * cStarts[i];
				const cEnd = cornerVertNumber * cEnds[i];

				const needsFlip = 1 >= i;

				for (let u = 0; u < radiusSegments; u++) {
					const urs1 = u * rs1;
					const u1rs1 = (u + 1) * rs1;

					const a = cStart + urs1;
					const b = cStart + u1rs1;
					const c = cEnd + urs1;
					const d = cEnd + u1rs1;

					if (needsFlip) {
						indices.push(a, c, b, b, c, d);
					} else {
						indices.push(a, b, c, b, d, c);
					}
				}
			}
		}

		function doWidthEdges() {
			const end = radiusSegments - 1;
			const cStarts = [0, 1, 4, 5];
			const cEnds = [3, 2, 7, 6];
			const needsFlip = [0, 1, 1, 0];

			for (let i = 0; i < 4; i++) {
				const cStart = cStarts[i] * cornerVertNumber;
				const cEnd = cEnds[i] * cornerVertNumber;

				for (let u = 0; u <= end; u++) {
					const a = cStart + radiusSegments + u * rs1;
					const b = cStart + (u !== end ? radiusSegments + (u + 1) * rs1 : cornerVertNumber - 1);
					const c = cEnd + radiusSegments + u * rs1;
					const d = cEnd + (u !== end ? radiusSegments + (u + 1) * rs1 : cornerVertNumber - 1);

					if (!needsFlip[i]) {
						indices.push(a, b, c, b, d, c);
					} else {
						indices.push(a, c, b, b, c, d);
					}
				}
			}
		}

		let index = 0;
		for (let i = 0; i < vertexPool.length; i++) {
			positions.setXYZ(index, vertexPool[i].x, vertexPool[i].y, vertexPool[i].z);
			normals.setXYZ(index, normalPool[i].x, normalPool[i].y, normalPool[i].z);
			index++;
		}

		this.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
		this.setAttribute('position', positions);
		this.setAttribute('normal', normals);
	}
}

// ============================================
// RoundedPlaneGeometry  (script.js 676-703)
// ============================================

function RoundedPlaneGeometry(size: number, radius: number, depth: number): THREE.BufferGeometry {
	const x = -size / 2;
	const y = -size / 2;
	const width = size;
	const height = size;
	const r = size * radius;

	const shape = new THREE.Shape();
	shape.moveTo(x, y + r);
	shape.lineTo(x, y + height - r);
	shape.quadraticCurveTo(x, y + height, x + r, y + height);
	shape.lineTo(x + width - r, y + height);
	shape.quadraticCurveTo(x + width, y + height, x + width, y + height - r);
	shape.lineTo(x + width, y + r);
	shape.quadraticCurveTo(x + width, y, x + width - r, y);
	shape.lineTo(x + r, y);
	shape.quadraticCurveTo(x, y, x, y + r);

	return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 3 });
}

// ============================================
// Draggable  (script.js 1121-1247)
// ============================================

interface DragPosition {
	current: THREE.Vector2;
	start: THREE.Vector2;
	delta: THREE.Vector2;
	old: THREE.Vector2;
	drag: THREE.Vector2;
}

interface DraggableOptions {
	calcDelta?: boolean;
}

class Draggable {
	position: DragPosition = {
		current: new THREE.Vector2(),
		start: new THREE.Vector2(),
		delta: new THREE.Vector2(),
		old: new THREE.Vector2(),
		drag: new THREE.Vector2(),
	};

	options: DraggableOptions;
	element: HTMLElement;
	touch: boolean | null = null;

	onDragStart: (pos: DragPosition) => void = () => { /* noop */ };
	onDragMove: (pos: DragPosition) => void = () => { /* noop */ };
	onDragEnd: (pos: DragPosition) => void = () => { /* noop */ };

	private drag = {
		start: (event: MouseEvent | TouchEvent) => {
			if (event.type === 'mousedown' && !((event as MouseEvent).which === 1 || (event as MouseEvent).which === 3)) return;
			if (event.type === 'touchstart' && (event as TouchEvent).touches.length > 1) return;

			this.getPositionCurrent(event);

			if (this.options.calcDelta) {
				this.position.start = this.position.current.clone();
				this.position.delta.set(0, 0);
				this.position.drag.set(0, 0);
			}

			this.touch = event.type === 'touchstart';

			this.onDragStart(this.position);

			window.addEventListener(this.touch ? 'touchmove' : 'mousemove', this.drag.move as any, false);
			window.addEventListener(this.touch ? 'touchend' : 'mouseup', this.drag.end as any, false);
		},

		move: (event: MouseEvent | TouchEvent) => {
			if (this.options.calcDelta) {
				this.position.old = this.position.current.clone();
			}

			this.getPositionCurrent(event);

			if (this.options.calcDelta) {
				this.position.delta = this.position.current.clone().sub(this.position.old);
				this.position.drag = this.position.current.clone().sub(this.position.start);
			}

			this.onDragMove(this.position);
		},

		end: (event: MouseEvent | TouchEvent) => {
			this.getPositionCurrent(event);

			this.onDragEnd(this.position);

			window.removeEventListener(this.touch ? 'touchmove' : 'mousemove', this.drag.move as any, false);
			window.removeEventListener(this.touch ? 'touchend' : 'mouseup', this.drag.end as any, false);
		},
	};

	constructor(element: HTMLElement, options?: DraggableOptions) {
		this.element = element;
		this.options = Object.assign({ calcDelta: false }, options || {});

		this.enable();
	}

	enable() {
		this.element.addEventListener('touchstart', this.drag.start as any, false);
		this.element.addEventListener('mousedown', this.drag.start as any, false);
		return this;
	}

	disable() {
		this.element.removeEventListener('touchstart', this.drag.start as any, false);
		this.element.removeEventListener('mousedown', this.drag.start as any, false);
		return this;
	}

	getPositionCurrent(event: MouseEvent | TouchEvent) {
		const touchEv = (event as TouchEvent).touches;
		const dragEvent: any = touchEv
			? (touchEv[0] || (event as TouchEvent).changedTouches[0])
			: event;

		// Reference uses pageX/Y assuming the game element occupies the document
		// top-left. In our landing the canvas is offset, so we convert clientX/Y
		// to element-relative pixels via getBoundingClientRect.
		const rect = this.element.getBoundingClientRect();
		this.position.current.set(
			dragEvent.clientX - rect.left,
			dragEvent.clientY - rect.top,
		);
	}

	convertPosition(position: THREE.Vector2) {
		position.x = (position.x / this.element.offsetWidth) * 2 - 1;
		position.y = -((position.y / this.element.offsetHeight) * 2 - 1);
		return position;
	}
}

// ============================================
// Cube  (script.js 705-935)
// ============================================

class Cube {
	game: CubeGame;
	size = 3;

	geometryConfig = {
		pieceCornerRadius: 0.12,
		edgeCornerRoundness: 0.15,
		edgeScale: 0.82,
		edgeDepth: 0.01,
	};

	holder: THREE.Object3D;
	object: THREE.Object3D;
	animator: THREE.Object3D;

	cubes: THREE.Object3D[] = [];
	pieces: THREE.Object3D[] = [];
	edges: THREE.Mesh[] = [];

	positions: Array<THREE.Vector3 & { edges: number[] }> = [];
	scale = 1;
	sizeGenerated = 0;

	constructor(game: CubeGame) {
		this.game = game;

		this.holder = new THREE.Object3D();
		this.object = new THREE.Object3D();
		this.animator = new THREE.Object3D();

		this.holder.add(this.animator);
		this.animator.add(this.object);

		this.game.world.scene.add(this.holder);
	}

	init() {
		this.cubes = [];
		this.object.children = [];
		this.object.add(this.game.controls.group);

		if (this.size === 2) this.scale = 1.25;
		else if (this.size === 3) this.scale = 1;
		else if (this.size > 3) this.scale = 3 / this.size;

		this.object.scale.set(this.scale, this.scale, this.scale);

		const controlsScale = this.size === 2 ? 0.825 : 1;
		this.game.controls.edges.scale.set(controlsScale, controlsScale, controlsScale);

		this.generatePositions();
		this.generateModel();

		this.pieces.forEach((piece) => {
			this.cubes.push(piece.userData.cube);
			this.object.add(piece);
		});

		this.holder.traverse((node: any) => {
			if (node.frustumCulled) node.frustumCulled = false;
		});

		this.updateColors(COLORS);

		this.sizeGenerated = this.size;
	}

	reset() {
		this.game.controls.edges.rotation.set(0, 0, 0);
		this.holder.rotation.set(0, 0, 0);
		this.object.rotation.set(0, 0, 0);
		this.animator.rotation.set(0, 0, 0);
	}

	generatePositions() {
		const m = this.size - 1;
		const first = this.size % 2 !== 0
			? 0 - Math.floor(this.size / 2)
			: 0.5 - this.size / 2;

		this.positions = [];

		for (let x = 0; x < this.size; x++) {
			for (let y = 0; y < this.size; y++) {
				for (let z = 0; z < this.size; z++) {
					const position = new THREE.Vector3(first + x, first + y, first + z) as any;
					const edges: number[] = [];

					if (x === 0) edges.push(0);
					if (x === m) edges.push(1);
					if (y === 0) edges.push(2);
					if (y === m) edges.push(3);
					if (z === 0) edges.push(4);
					if (z === m) edges.push(5);

					position.edges = edges;
					this.positions.push(position);
				}
			}
		}
	}

	generateModel() {
		this.pieces = [];
		this.edges = [];

		const pieceSize = 1 / 3;
		const mainMaterial = new THREE.MeshLambertMaterial();

		const pieceMesh = new THREE.Mesh(
			new RoundedBoxGeometry(pieceSize, this.geometryConfig.pieceCornerRadius, 3),
			mainMaterial.clone(),
		);

		const edgeGeometry = RoundedPlaneGeometry(
			pieceSize,
			this.geometryConfig.edgeCornerRoundness,
			this.geometryConfig.edgeDepth,
		);

		this.positions.forEach((position, index) => {
			const piece = new THREE.Object3D();
			const pieceCube = pieceMesh.clone();
			const pieceEdges: string[] = [];

			piece.position.copy(position.clone().divideScalar(3));
			piece.add(pieceCube);
			piece.name = String(index);
			(piece as any).edgesName = '';

			position.edges.forEach((edgePos) => {
				const edge = new THREE.Mesh(edgeGeometry, mainMaterial.clone());
				const name = ['L', 'R', 'D', 'U', 'B', 'F'][edgePos];
				const distance = pieceSize / 2;

				edge.position.set(
					distance * [-1, 1, 0, 0, 0, 0][edgePos],
					distance * [0, 0, -1, 1, 0, 0][edgePos],
					distance * [0, 0, 0, 0, -1, 1][edgePos],
				);

				edge.rotation.set(
					(Math.PI / 2) * [0, 0, 1, -1, 0, 0][edgePos],
					(Math.PI / 2) * [-1, 1, 0, 0, 2, 0][edgePos],
					0,
				);

				edge.scale.set(
					this.geometryConfig.edgeScale,
					this.geometryConfig.edgeScale,
					this.geometryConfig.edgeScale,
				);

				edge.name = name;

				piece.add(edge);
				pieceEdges.push(name);
				this.edges.push(edge);
			});

			piece.userData.edges = pieceEdges;
			piece.userData.cube = pieceCube;

			piece.userData.start = {
				position: piece.position.clone(),
				rotation: piece.rotation.clone(),
			};

			this.pieces.push(piece);
		});
	}

	updateColors(colors: Record<string, number>) {
		if (!this.pieces || !this.edges) return;
		this.pieces.forEach((piece: any) =>
			(piece.userData.cube.material as THREE.MeshLambertMaterial).color.setHex(colors.P),
		);
		this.edges.forEach((edge) =>
			(edge.material as THREE.MeshLambertMaterial).color.setHex(colors[edge.name]),
		);
	}
}

// ============================================
// Scrambler  (script.js 1821-1914)
// ============================================

interface ConvertedMove {
	position: THREE.Vector3;
	axis: 'x' | 'y' | 'z';
	angle: number;
	name: string;
}

class Scrambler {
	game: CubeGame;
	dificulty = 0;
	scrambleLength: Record<number, number[]> = {
		2: [7, 9, 11],
		3: [20, 25, 30],
		4: [30, 40, 50],
		5: [40, 60, 80],
	};

	moves: string[] = [];
	converted: ConvertedMove[] = [];
	print = '';
	callback: () => void = () => { /* noop */ };

	constructor(game: CubeGame) {
		this.game = game;
	}

	scramble(scramble?: string | number) {
		let count = 0;
		this.moves = typeof scramble === 'string' ? scramble.split(' ') : [];

		if (this.moves.length < 1) {
			const scrambleLength = this.scrambleLength[this.game.cube.size][this.dificulty];
			const faces = this.game.cube.size < 4 ? 'UDLRFB' : 'UuDdLlRrFfBb';
			const modifiers = ['', "'", '2'];
			const total = typeof scramble === 'number' ? scramble : scrambleLength;

			while (count < total) {
				const move =
					faces[Math.floor(Math.random() * faces.length)] +
					modifiers[Math.floor(Math.random() * 3)];

				if (count > 0 && move.charAt(0) === this.moves[count - 1].charAt(0)) continue;
				if (count > 1 && move.charAt(0) === this.moves[count - 2].charAt(0)) continue;

				this.moves.push(move);
				count++;
			}
		}

		this.callback = () => { /* noop */ };
		this.convert();
		this.print = this.moves.join(' ');

		return this;
	}

	convert() {
		this.converted = [];

		this.moves.forEach((move) => {
			const convertedMove = this.convertMove(move);
			const modifier = move.charAt(1);

			this.converted.push(convertedMove);
			if (modifier === '2') this.converted.push(convertedMove);
		});
	}

	convertMove(move: string): ConvertedMove {
		const face = move.charAt(0);
		const modifier = move.charAt(1);

		const axisMap: Record<string, 'x' | 'y' | 'z'> = { D: 'y', U: 'y', L: 'x', R: 'x', F: 'z', B: 'z' };
		const rowMap: Record<string, number> = { D: -1, U: 1, L: -1, R: 1, F: 1, B: -1 };

		const upper = face.toUpperCase();
		const axis = axisMap[upper];
		let row = rowMap[upper];

		if (this.game.cube.size > 3 && face !== face.toLowerCase()) row = row * 2;

		const position = new THREE.Vector3();
		(position as any)[axis] = row;

		const angle = (Math.PI / 2) * -row * (modifier === "'" ? -1 : 1);

		return { position, axis, angle, name: move };
	}
}

// ============================================
// Controls  (script.js 1254-1789)
// ============================================

class Controls {
	game: CubeGame;

	flipConfig = 0;
	flipEasings = [Easing.Power.Out(3), Easing.Sine.Out(), Easing.Back.Out(1.5)];
	flipSpeeds = [125, 200, 300];

	raycaster = new THREE.Raycaster();

	group: THREE.Object3D;
	helper: THREE.Mesh;
	edges: THREE.Mesh;

	draggable!: Draggable;
	rotationTween: Tween | null = null;

	onSolved: () => void = () => { /* noop */ };
	onMove: () => void = () => { /* noop */ };

	momentum: Array<{ delta: THREE.Vector2; time: number }> = [];

	scramble: Scrambler | null = null;
	state = STILL;
	enabled = false;

	// Drag state
	gettingDrag = false;
	dragNormal = new THREE.Vector3();
	dragIntersect: THREE.Intersection | false = false;
	flipType: 'layer' | 'cube' = 'layer';
	flipAxis = new THREE.Vector3();
	flipAngle = 0;
	flipLayer: number[] = [];
	dragCurrent = new THREE.Vector3();
	dragTotal = new THREE.Vector3();
	dragDelta = new THREE.Vector3();
	dragDirection: 'x' | 'y' | 'z' = 'x';

	constructor(game: CubeGame) {
		this.game = game;

		const helperMaterial = new THREE.MeshBasicMaterial({
			depthWrite: false,
			transparent: true,
			opacity: 0,
			color: 0x0033ff,
		});

		this.group = new THREE.Object3D();
		this.group.name = 'controls';
		// `group` is added to cube.object inside Cube.init() (reference parity)

		this.helper = new THREE.Mesh(
			new THREE.PlaneGeometry(200, 200),
			helperMaterial.clone(),
		);

		this.helper.rotation.set(0, Math.PI / 4, 0);
		this.game.world.scene.add(this.helper);

		this.edges = new THREE.Mesh(
			new THREE.BoxGeometry(1, 1, 1),
			helperMaterial.clone(),
		);

		this.game.world.scene.add(this.edges);

		this.initDraggable();
	}

	enable() {
		this.draggable.enable();
		this.enabled = true;
	}

	disable() {
		this.draggable.disable();
		this.enabled = false;
	}

	initDraggable() {
		this.draggable = new Draggable(this.game.dom.game);

		this.draggable.onDragStart = (position) => {
			if (this.scramble !== null) return;
			if (this.state === PREPARING || this.state === ROTATING) return;

			this.gettingDrag = this.state === ANIMATING;

			const edgeIntersect = this.getIntersect(position.current, this.edges, false);

			if (edgeIntersect !== false) {
				this.dragIntersect = this.getIntersect(position.current, this.game.cube.cubes, true);
			}

			if (edgeIntersect !== false && this.dragIntersect !== false) {
				this.dragNormal = (edgeIntersect as THREE.Intersection).face!.normal.clone().round();
				this.flipType = 'layer';

				// Manual helper plane orientation. We bypass parented attach/lookAt
				// because Object3D.lookAt in r125 (and r95 too) hits a degenerate
				// fallback when target direction is parallel to helper.up=(0,1,0),
				// which happens whenever the user clicks the world-top or world-bottom
				// face — the resulting helper basis is consistent for the initial
				// orientation but flips signs in non-obvious ways after a cube rotation.
				// Manual basis is deterministic regardless of cube rotation.
				this.edges.updateMatrixWorld();
				const worldNormal = this.dragNormal.clone().applyQuaternion(this.edges.quaternion).normalize();

				// Pick an up vector not parallel to worldNormal
				const up = Math.abs(worldNormal.y) > 0.9
					? new THREE.Vector3(1, 0, 0)
					: new THREE.Vector3(0, 1, 0);

				const xAxis = new THREE.Vector3().crossVectors(up, worldNormal).normalize();
				const yAxis = new THREE.Vector3().crossVectors(worldNormal, xAxis).normalize();

				const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, worldNormal);
				this.helper.quaternion.setFromRotationMatrix(basis);
				this.helper.position.copy(this.edges.position).add(worldNormal.clone().multiplyScalar(0.5));
				this.helper.updateMatrixWorld();
			} else {
				this.dragNormal = new THREE.Vector3(0, 0, 1);
				this.flipType = 'cube';

				this.helper.position.set(0, 0, 0);
				this.helper.rotation.set(0, Math.PI / 4, 0);
				this.helper.updateMatrixWorld();
			}

			const planeIntersect = this.getIntersect(position.current, this.helper, false);
			if (planeIntersect === false) return;

			this.dragCurrent = this.helper.worldToLocal((planeIntersect as THREE.Intersection).point);
			this.dragTotal = new THREE.Vector3();
			this.state = this.state === STILL ? PREPARING : this.state;
		};

		this.draggable.onDragMove = (position) => {
			if (this.scramble !== null) return;
			if (this.state === STILL || (this.state === ANIMATING && this.gettingDrag === false)) return;

			const planeIntersect = this.getIntersect(position.current, this.helper, false);
			if (planeIntersect === false) return;

			const point = this.helper.worldToLocal((planeIntersect as THREE.Intersection).point.clone());

			this.dragDelta = point.clone().sub(this.dragCurrent).setZ(0);
			this.dragTotal.add(this.dragDelta);
			this.dragCurrent = point;
			this.addMomentumPoint(new THREE.Vector2(this.dragDelta.x, this.dragDelta.y));

			if (this.state === PREPARING && this.dragTotal.length() > 0.05) {
				this.dragDirection = this.getMainAxis(this.dragTotal);

				if (this.flipType === 'layer') {
					const direction = new THREE.Vector3();
					(direction as any)[this.dragDirection] = 1;

					const worldDirection = this.helper.localToWorld(direction).sub(this.helper.position);
					const objectDirection = this.edges.worldToLocal(worldDirection).round();

					this.flipAxis = objectDirection.cross(this.dragNormal).negate();

					this.selectLayer(this.getLayer(false));
				} else {
					const w = this.game.world.width;
					const axis = this.dragDirection !== 'x'
						? (this.dragDirection === 'y' && position.current.x > w / 2 ? 'z' : 'x')
						: 'y';

					this.flipAxis = new THREE.Vector3();
					(this.flipAxis as any)[axis] = 1 * (axis === 'x' ? -1 : 1);
				}

				this.flipAngle = 0;
				this.state = ROTATING;
			} else if (this.state === ROTATING) {
				const rotation = (this.dragDelta as any)[this.dragDirection] as number;

				if (this.flipType === 'layer') {
					this.group.rotateOnAxis(this.flipAxis, rotation);
					this.flipAngle += rotation;
				} else {
					this.edges.rotateOnWorldAxis(this.flipAxis, rotation);
					this.game.cube.object.rotation.copy(this.edges.rotation);
					this.flipAngle += rotation;
				}
			}
		};

		this.draggable.onDragEnd = () => {
			if (this.scramble !== null) return;
			if (this.state !== ROTATING) {
				this.gettingDrag = false;
				this.state = STILL;
				return;
			}

			this.state = ANIMATING;

			const momentum = (this.getMomentum() as any)[this.dragDirection] as number;
			const flip = Math.abs(momentum) > 0.05 && Math.abs(this.flipAngle) < Math.PI / 2;

			const angle = flip
				? this.roundAngle(this.flipAngle + Math.sign(this.flipAngle) * (Math.PI / 4))
				: this.roundAngle(this.flipAngle);

			const delta = angle - this.flipAngle;

			if (this.flipType === 'layer') {
				this.rotateLayer(delta, false, () => {
					this.state = this.gettingDrag ? PREPARING : STILL;
					this.gettingDrag = false;

					this.checkIsSolved();
				});
			} else {
				this.rotateCube(delta, () => {
					this.state = this.gettingDrag ? PREPARING : STILL;
					this.gettingDrag = false;
				});
			}
		};
	}

	rotateLayer(rotation: number, scramble: boolean, callback: (layer: number[]) => void) {
		const config = scramble ? 0 : this.flipConfig;

		const easing = this.flipEasings[config];
		const duration = this.flipSpeeds[config];

		this.rotationTween = new Tween({
			easing,
			duration,
			onUpdate: (tween) => {
				const deltaAngle = tween.delta * rotation;
				this.group.rotateOnAxis(this.flipAxis, deltaAngle);
			},
			onComplete: () => {
				if (!scramble) this.onMove();

				const layer = this.flipLayer.slice(0);

				this.game.cube.object.rotation.setFromVector3(
					this.snapRotation(this.game.cube.object.rotation.toVector3()),
				);
				this.group.rotation.setFromVector3(
					this.snapRotation(this.group.rotation.toVector3()),
				);
				this.deselectLayer(this.flipLayer);

				callback(layer);
			},
		});
	}

	rotateCube(rotation: number, callback: () => void) {
		const config = this.flipConfig;
		const easing = [Easing.Power.Out(4), Easing.Sine.Out(), Easing.Back.Out(2)][config];
		const duration = [100, 150, 350][config];

		this.rotationTween = new Tween({
			easing,
			duration,
			onUpdate: (tween) => {
				this.edges.rotateOnWorldAxis(this.flipAxis, tween.delta * rotation);
				this.game.cube.object.rotation.copy(this.edges.rotation);
			},
			onComplete: () => {
				this.edges.rotation.setFromVector3(
					this.snapRotation(this.edges.rotation.toVector3()),
				);
				this.game.cube.object.rotation.copy(this.edges.rotation);
				callback();
			},
		});
	}

	selectLayer(layer: number[]) {
		this.group.rotation.set(0, 0, 0);
		this.movePieces(layer, this.game.cube.object, this.group);
		this.flipLayer = layer;
	}

	deselectLayer(layer: number[]) {
		this.movePieces(layer, this.group, this.game.cube.object);
		this.flipLayer = [];
	}

	movePieces(layer: number[], from: THREE.Object3D, to: THREE.Object3D) {
		from.updateMatrixWorld();
		to.updateMatrixWorld();

		layer.forEach((index) => {
			const piece = this.game.cube.pieces[index];

			piece.applyMatrix4(from.matrixWorld);
			from.remove(piece);
			piece.applyMatrix4(new THREE.Matrix4().copy(to.matrixWorld).invert());
			to.add(piece);
		});
	}

	getLayer(position: THREE.Vector3 | false): number[] {
		const scalar: Record<number, number> = { 2: 6, 3: 3, 4: 4, 5: 3 };
		const s = scalar[this.game.cube.size];
		const layer: number[] = [];

		let axis: 'x' | 'y' | 'z';

		if (position === false) {
			const piece = (this.dragIntersect as THREE.Intersection).object.parent!;
			axis = this.getMainAxis(this.flipAxis);
			position = piece.position.clone().multiplyScalar(s).round();
		} else {
			axis = this.getMainAxis(position);
		}

		this.game.cube.pieces.forEach((piece) => {
			const piecePosition = piece.position.clone().multiplyScalar(s).round();

			if ((piecePosition as any)[axis] === (position as any)[axis]) layer.push(parseInt(piece.name, 10));
		});

		return layer;
	}

	scrambleCube() {
		if (this.scramble === null) {
			this.scramble = this.game.scrambler;
		}

		const converted = this.scramble.converted;
		const move = converted[0];
		const layer = this.getLayer(move.position);

		this.flipAxis = new THREE.Vector3();
		(this.flipAxis as any)[move.axis] = 1;

		this.selectLayer(layer);
		this.rotateLayer(move.angle, true, () => {
			converted.shift();

			if (converted.length > 0) {
				this.scrambleCube();
			} else {
				this.scramble = null;
			}
		});
	}

	getIntersect(position: THREE.Vector2, object: THREE.Object3D | THREE.Object3D[], multiple: boolean): THREE.Intersection | false {
		this.raycaster.setFromCamera(
			this.draggable.convertPosition(position.clone()) as any,
			this.game.world.camera,
		);

		const intersect = multiple
			? this.raycaster.intersectObjects(object as THREE.Object3D[])
			: this.raycaster.intersectObject(object as THREE.Object3D);

		return intersect.length > 0 ? intersect[0] : false;
	}

	getMainAxis(vector: THREE.Vector3): 'x' | 'y' | 'z' {
		const ax = Math.abs(vector.x);
		const ay = Math.abs(vector.y);
		const az = Math.abs(vector.z);
		if (ax >= ay && ax >= az) return 'x';
		if (ay >= ax && ay >= az) return 'y';
		return 'z';
	}

	detach(child: THREE.Object3D, parent: THREE.Object3D) {
		child.applyMatrix4(parent.matrixWorld);
		parent.remove(child);
		this.game.world.scene.add(child);
	}

	attach(child: THREE.Object3D, parent: THREE.Object3D) {
		child.applyMatrix4(new THREE.Matrix4().copy(parent.matrixWorld).invert());
		this.game.world.scene.remove(child);
		parent.add(child);
	}

	addMomentumPoint(delta: THREE.Vector2 | false) {
		const time = Date.now();
		this.momentum = this.momentum.filter((moment) => time - moment.time < 500);
		if (delta !== false) this.momentum.push({ delta, time });
	}

	getMomentum(): THREE.Vector2 {
		const points = this.momentum.length;
		const momentum = new THREE.Vector2();

		this.addMomentumPoint(false);

		this.momentum.forEach((point, index) => {
			momentum.add(point.delta.multiplyScalar(index / points));
		});

		return momentum;
	}

	roundAngle(angle: number): number {
		const round = Math.PI / 2;
		return Math.sign(angle) * Math.round(Math.abs(angle) / round) * round;
	}

	snapRotation(angle: THREE.Vector3): THREE.Vector3 {
		return angle.set(
			this.roundAngle(angle.x),
			this.roundAngle(angle.y),
			this.roundAngle(angle.z),
		);
	}

	checkIsSolved() {
		let solved = true;
		const sides: Record<string, string[]> = {
			'x-': [], 'x+': [], 'y-': [], 'y+': [], 'z-': [], 'z+': [],
		};

		this.game.cube.edges.forEach((edge) => {
			const position = edge.parent!.localToWorld(edge.position.clone())
				.sub(this.game.cube.object.position);

			const mainAxis = this.getMainAxis(position);
			const mainSign = (position.clone().multiplyScalar(2).round() as any)[mainAxis] < 1 ? '-' : '+';

			sides[mainAxis + mainSign].push(edge.name);
		});

		Object.keys(sides).forEach((side) => {
			if (!sides[side].every((value) => value === sides[side][0])) solved = false;
		});

		if (solved) this.onSolved();
	}
}

// ============================================
// World  (script.js 94-182) — scene/camera/renderer/lights
// ============================================

class World extends Animation {
	game: CubeGame;
	container: HTMLElement;
	scene: THREE.Scene;
	renderer: THREE.WebGLRenderer;
	camera: THREE.PerspectiveCamera;

	stage = { width: 2, height: 3 };
	fov = 10;

	width = 0;
	height = 0;

	lights: {
		holder: THREE.Object3D;
		ambient: THREE.AmbientLight;
		front: THREE.DirectionalLight;
		back: THREE.DirectionalLight;
	};

	onResize: Array<() => void> = [];

	constructor(game: CubeGame) {
		super(true);

		this.game = game;
		this.container = this.game.dom.game;
		this.scene = new THREE.Scene();

		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.container.appendChild(this.renderer.domElement);
		this.renderer.domElement.style.width = '100%';
		this.renderer.domElement.style.height = '100%';
		this.renderer.domElement.style.display = 'block';
		this.renderer.domElement.style.touchAction = 'none';

		this.camera = new THREE.PerspectiveCamera(2, 1, 0.1, 10000);
		this.scene.add(this.camera);

		this.lights = {
			holder: new THREE.Object3D(),
			ambient: new THREE.AmbientLight(0xffffff, 0.69),
			front: new THREE.DirectionalLight(0xffffff, 0.36),
			back: new THREE.DirectionalLight(0xffffff, 0.19),
		};

		this.lights.front.position.set(1.5, 5, 3);
		this.lights.back.position.set(-1.5, -5, -3);

		this.lights.holder.add(this.lights.ambient);
		this.lights.holder.add(this.lights.front);
		this.lights.holder.add(this.lights.back);

		this.scene.add(this.lights.holder);

		this.resize();
		window.addEventListener('resize', this.boundResize, false);
	}

	update() {
		this.renderer.render(this.scene, this.camera);
	}

	private boundResize = () => this.resize();

	resize() {
		this.width = this.container.offsetWidth;
		this.height = this.container.offsetHeight;

		if (this.width === 0 || this.height === 0) return;

		this.renderer.setSize(this.width, this.height);

		this.camera.fov = this.fov;
		this.camera.aspect = this.width / this.height;

		const aspect = this.stage.width / this.stage.height;
		const fovRad = this.fov * THREE.MathUtils.DEG2RAD;

		let distance = aspect < this.camera.aspect
			? (this.stage.height / 2) / Math.tan(fovRad / 2)
			: (this.stage.width / this.camera.aspect) / (2 * Math.tan(fovRad / 2));

		distance *= 0.5;

		this.camera.position.set(distance, distance, distance);
		this.camera.lookAt(this.scene.position);
		this.camera.updateProjectionMatrix();

		this.onResize.forEach((cb) => cb());
	}

	dispose() {
		window.removeEventListener('resize', this.boundResize, false);
		this.stop();
		this.renderer.dispose();
		if (this.renderer.domElement.parentElement) {
			this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
		}
	}
}

// ============================================
// CubeGame — orchestrator (landing-specific subset of reference Game)
// ============================================

export class CubeGame {
	dom: { game: HTMLElement };

	world!: World;
	cube!: Cube;
	controls!: Controls;
	scrambler!: Scrambler;

	private floatTween: Tween | null = null;
	private disposed = false;
	private firstMoveFired = false;

	onSolved: () => void = () => { /* noop */ };
	onFirstMove: () => void = () => { /* noop */ };

	constructor(container: HTMLElement) {
		this.dom = { game: container };

		this.world = new World(this);
		this.cube = new Cube(this);
		this.controls = new Controls(this);
		this.scrambler = new Scrambler(this);

		this.cube.init();
		this.controls.enable();

		this.controls.onMove = () => {
			if (!this.firstMoveFired) {
				this.firstMoveFired = true;
				this.onFirstMove();
			}
		};

		this.controls.onSolved = () => {
			this.onSolved();
		};

		this.float();
	}

	scramble(length?: number) {
		if (this.controls.scramble !== null) return;
		this.scrambler.scramble(length);
		this.controls.scramble = this.scrambler;
		this.controls.scrambleCube();
	}

	/**
	 * Programmatic animasyonlu hamle dizisi uygula.
	 * AuthCube auto-solve choreography icin eklendi (login/signup sayfasi).
	 * Mevcut Scrambler + Controls.scrambleCube pipeline'ini reuse eder.
	 *
	 * Onemli: scrambler.moves mutate edilir; caller original scramble moves'i
	 * korumak istiyorsa onceden capture etmelidir.
	 *
	 * @param moves WCA notation hamle dizisi, ornek: ["R'", "U", "F2"]
	 */
	applyMovesAnimated(moves: string[]) {
		if (this.controls.scramble !== null) return;
		if (!moves || moves.length === 0) return;
		this.scrambler.moves = moves.slice();
		this.scrambler.convert();
		this.controls.scramble = this.scrambler;
		this.controls.scrambleCube();
	}

	reset() {
		this.firstMoveFired = false;
		this.cube.reset();
	}

	dispose() {
		if (this.disposed) return;
		this.disposed = true;

		if (this.floatTween) this.floatTween.stop();
		if (this.controls.rotationTween) this.controls.rotationTween.stop();

		this.controls.draggable.disable();
		this.world.dispose();

		this.world.scene.traverse((obj: any) => {
			if (obj.geometry) obj.geometry.dispose();
			if (obj.material) {
				if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose());
				else obj.material.dispose();
			}
		});
	}

	/**
	 * Idle float animation. Direct port of script.js:2037-2057.
	 * Mutates holder.position.y, holder.rotation.{x,y,z}, AND edges.position.y
	 * (the missing edges sync was a likely cause of the matrix divergence bug).
	 */
	private float() {
		if (this.floatTween) this.floatTween.stop();
		this.floatTween = new Tween({
			duration: 1500,
			easing: Easing.Sine.InOut(),
			yoyo: true,
			onUpdate: (tween) => {
				this.cube.holder.position.y = -0.02 + tween.value * 0.04;
				this.cube.holder.rotation.x = 0.005 - tween.value * 0.01;
				this.cube.holder.rotation.z = -this.cube.holder.rotation.x;
				this.cube.holder.rotation.y = this.cube.holder.rotation.x;

				this.controls.edges.position.y =
					this.cube.holder.position.y + this.cube.object.position.y;
			},
		});
	}
}
