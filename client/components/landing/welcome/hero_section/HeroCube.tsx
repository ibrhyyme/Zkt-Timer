import React, { useEffect, useRef, useCallback } from 'react';
import block from '../../../../styles/bem';

const b = block('hero-cube');

// Rubik's cube face colors
const FACE_COLORS = {
	R: 0xb71234, // Red
	L: 0xff5800, // Orange
	U: 0xffffff, // White
	D: 0xffd500, // Yellow
	F: 0x009b48, // Green
	B: 0x0046ad, // Blue
};

const INNER_COLOR = 0x1a1a1a;
const CUBE_SIZE = 0.93;
const GAP = 0.06;
const MOVES = ['R', 'U', 'F', 'L', 'D', 'B'];

export default function HeroCube() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const cubeRef = useRef<any>(null);

	const initCube = useCallback(async () => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const THREE = await import('three');
		const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls');

		// Scene
		const scene = new THREE.Scene();

		// Camera
		const camera = new THREE.PerspectiveCamera(35, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
		camera.position.set(5, 4, 5);
		camera.lookAt(0, 0, 0);

		// Renderer
		const renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			alpha: true,
		});
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.2;

		// Lights
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
		scene.add(ambientLight);

		const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
		mainLight.position.set(8, 10, 6);
		mainLight.castShadow = false;
		scene.add(mainLight);

		const fillLight = new THREE.DirectionalLight(0x8080ff, 0.3);
		fillLight.position.set(-6, -4, -8);
		scene.add(fillLight);

		const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
		rimLight.position.set(-3, 8, -5);
		scene.add(rimLight);

		// Cube container (for rotation animations)
		const cubeContainer = new THREE.Group();
		scene.add(cubeContainer);

		// Build 3x3x3 Rubik's cube
		const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE, 1, 1, 1);
		// Round edges with beveled geometry
		const roundedGeo = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);

		const cubeMeshes: THREE.Mesh[] = [];

		for (let x = -1; x <= 1; x++) {
			for (let y = -1; y <= 1; y++) {
				for (let z = -1; z <= 1; z++) {
					const materials = createFaceMaterials(x, y, z, THREE);
					const mesh = new THREE.Mesh(roundedGeo, materials);
					mesh.position.set(x * (CUBE_SIZE + GAP), y * (CUBE_SIZE + GAP), z * (CUBE_SIZE + GAP));
					(mesh as any)._gridPos = { x, y, z };
					cubeContainer.add(mesh);
					cubeMeshes.push(mesh);
				}
			}
		}

		// OrbitControls
		const controls = new OrbitControls(camera, canvas);
		controls.enableDamping = true;
		controls.dampingFactor = 0.08;
		controls.enableZoom = false;
		controls.enablePan = false;
		controls.autoRotate = true;
		controls.autoRotateSpeed = 1.5;
		controls.minPolarAngle = Math.PI * 0.2;
		controls.maxPolarAngle = Math.PI * 0.8;

		// Animation state
		let animating = false;
		let reqId: number;

		// Random move animation
		async function doRandomMove() {
			if (animating) return;
			animating = true;

			const move = MOVES[Math.floor(Math.random() * MOVES.length)];
			const clockwise = Math.random() > 0.5;
			const axis = getAxisForMove(move);
			const layer = getLayerForMove(move);

			const group = new THREE.Group();
			scene.add(group);

			// Find cubes in this layer
			const layerMeshes = cubeMeshes.filter((m) => {
				const pos = m.position.clone();
				cubeContainer.localToWorld(pos);
				scene.worldToLocal(pos);
				const val = Math.round(pos[axis] / (CUBE_SIZE + GAP));
				return val === layer;
			});

			// Reparent to group
			layerMeshes.forEach((m) => {
				group.attach(m);
			});

			// Animate rotation
			const targetAngle = (clockwise ? -1 : 1) * (Math.PI / 2);
			const duration = 400;
			const startTime = performance.now();

			await new Promise<void>((resolve) => {
				function animate() {
					const elapsed = performance.now() - startTime;
					const progress = Math.min(elapsed / duration, 1);
					// Ease out cubic
					const eased = 1 - Math.pow(1 - progress, 3);

					if (axis === 'x') group.rotation.x = targetAngle * eased;
					else if (axis === 'y') group.rotation.y = targetAngle * eased;
					else group.rotation.z = targetAngle * eased;

					if (progress < 1) {
						requestAnimationFrame(animate);
					} else {
						// Reparent back
						layerMeshes.forEach((m) => {
							cubeContainer.attach(m);
							m.position.set(
								Math.round(m.position.x / (CUBE_SIZE + GAP)) * (CUBE_SIZE + GAP),
								Math.round(m.position.y / (CUBE_SIZE + GAP)) * (CUBE_SIZE + GAP),
								Math.round(m.position.z / (CUBE_SIZE + GAP)) * (CUBE_SIZE + GAP)
							);
						});
						scene.remove(group);
						resolve();
					}
				}
				animate();
			});

			animating = false;
		}

		// Periodic random moves
		const moveInterval = setInterval(() => {
			doRandomMove();
		}, 3000);

		// First move after 1.5s
		const firstMoveTimeout = setTimeout(() => doRandomMove(), 1500);

		// Render loop
		function render() {
			reqId = requestAnimationFrame(render);
			controls.update();
			renderer.render(scene, camera);
		}
		render();

		// Resize handler
		function onResize() {
			if (!canvas.parentElement) return;
			const width = canvas.clientWidth;
			const height = canvas.clientHeight;
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			renderer.setSize(width, height, false);
		}
		window.addEventListener('resize', onResize);

		// Store cleanup refs
		cubeRef.current = {
			dispose: () => {
				clearInterval(moveInterval);
				clearTimeout(firstMoveTimeout);
				cancelAnimationFrame(reqId);
				window.removeEventListener('resize', onResize);
				controls.dispose();
				renderer.dispose();
				scene.traverse((obj: any) => {
					if (obj.geometry) obj.geometry.dispose();
					if (obj.material) {
						if (Array.isArray(obj.material)) {
							obj.material.forEach((m: any) => m.dispose());
						} else {
							obj.material.dispose();
						}
					}
				});
			},
		};
	}, []);

	useEffect(() => {
		initCube();
		return () => {
			cubeRef.current?.dispose();
		};
	}, [initCube]);

	return (
		<div className={b()}>
			<canvas ref={canvasRef} className={b('canvas')} />
		</div>
	);
}

function createFaceMaterials(x: number, y: number, z: number, THREE: any): THREE.Material[] {
	const makeMat = (color: number) =>
		new THREE.MeshStandardMaterial({
			color,
			roughness: 0.3,
			metalness: 0.05,
		});

	return [
		makeMat(x === 1 ? FACE_COLORS.R : INNER_COLOR), // +x = Right
		makeMat(x === -1 ? FACE_COLORS.L : INNER_COLOR), // -x = Left
		makeMat(y === 1 ? FACE_COLORS.U : INNER_COLOR), // +y = Up
		makeMat(y === -1 ? FACE_COLORS.D : INNER_COLOR), // -y = Down
		makeMat(z === 1 ? FACE_COLORS.F : INNER_COLOR), // +z = Front
		makeMat(z === -1 ? FACE_COLORS.B : INNER_COLOR), // -z = Back
	];
}

function getAxisForMove(move: string): 'x' | 'y' | 'z' {
	switch (move) {
		case 'R': case 'L': return 'x';
		case 'U': case 'D': return 'y';
		case 'F': case 'B': return 'z';
		default: return 'y';
	}
}

function getLayerForMove(move: string): number {
	switch (move) {
		case 'R': return 1;
		case 'L': return -1;
		case 'U': return 1;
		case 'D': return -1;
		case 'F': return 1;
		case 'B': return -1;
		default: return 1;
	}
}
