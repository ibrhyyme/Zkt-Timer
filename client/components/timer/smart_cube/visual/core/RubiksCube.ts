import * as THREE from 'three';
import CubeMesh from './CubeMesh';
import { Axis } from './types';

export class RubiksCube {
	private camera: THREE.PerspectiveCamera;
	private scene: THREE.Scene;
	private renderer: THREE.Renderer;
	private locked: boolean = false;

	// Jiroskop desteği için eklenen alanlar
	private cubeContainer: THREE.Object3D;
	private gyroBasis: THREE.Quaternion | null = null;
	private targetQuaternion: THREE.Quaternion = new THREE.Quaternion(); // identity
	private currentQuaternion: THREE.Quaternion = new THREE.Quaternion(); // identity
	// Standart pozisyon: identity quaternion (kamera açısı zaten doğru görünümü sağlıyor)
	private readonly HOME_ORIENTATION = new THREE.Quaternion(); // identity quaternion

	constructor(
		canvas: HTMLCanvasElement,
		private materials: THREE.Material[],
		private speed: number = 1000,
		width: string = '100%',
		height: string = '100%',
		initState: string
	) {
		this.camera = new THREE.PerspectiveCamera();
		this.camera.position.set(4, 4, 4);
		this.camera.lookAt(0, -0.33, 0);

		this.scene = new THREE.Scene();

		// Add lighting (Ambient + Directional) for 3D effect
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
		this.scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
		directionalLight.position.set(10, 10, 10);
		this.scene.add(directionalLight);

		// Add fill light from the other side
		const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
		fillLight.position.set(-10, -10, -5);
		this.scene.add(fillLight);

		// Jiroskop desteği için container oluştur
		this.cubeContainer = new THREE.Object3D();
		this.scene.add(this.cubeContainer);

		// Küp parçalarını container'a ekle
		const cubes = this.generateCubeCluster(initState);
		cubes.forEach(cube => this.cubeContainer.add(cube));

		this.renderer = new THREE.WebGLRenderer({
			antialias: true,
			canvas,
			alpha: true,
		});
		this.renderer.domElement.style.width = width;
		this.renderer.domElement.style.height = height;

		this.resize();
		this.render();
	}

	public resize() {
		const canvas = this.renderer.domElement;
		const pixelRatio = window.devicePixelRatio;
		const width = (canvas.clientWidth * pixelRatio) | 0;
		const height = (canvas.clientHeight * pixelRatio) | 0;

		if (canvas.width !== width || canvas.height !== height) {
			this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
			this.camera.updateProjectionMatrix();
			this.renderer.setSize(width, height, false);
		}
	}

	// Front
	public async F(clockwise: boolean = true, duration: number = this.speed) {
		const cubes = this.cubeContainer.children.filter((node) => node instanceof CubeMesh && node.position.z === 1);
		await this.rotate(cubes, Axis.z, clockwise, duration);
	}

	// Back
	public async B(clockwise: boolean = true, duration: number = this.speed) {
		const cubes = this.cubeContainer.children.filter((node) => node instanceof CubeMesh && node.position.z === -1);
		await this.rotate(cubes, Axis.z, clockwise, duration);
	}

	// Up
	public async U(clockwise: boolean = true, duration: number = this.speed) {
		const cubes = this.cubeContainer.children.filter((node) => node instanceof CubeMesh && node.position.y === 1);
		await this.rotate(cubes, Axis.y, !clockwise, duration);
	}

	// Down
	public async D(clockwise: boolean = true, duration: number = this.speed) {
		const cubes = this.cubeContainer.children.filter((node) => node instanceof CubeMesh && node.position.y === -1);
		await this.rotate(cubes, Axis.y, clockwise, duration);
	}

	// Left
	public async L(clockwise: boolean = true, duration: number = this.speed) {
		const cubes = this.cubeContainer.children.filter((node) => node instanceof CubeMesh && node.position.x === -1);
		await this.rotate(cubes, Axis.x, clockwise, duration);
	}

	// Right
	public async R(clockwise: boolean = true, duration: number = this.speed) {
		const cubes = this.cubeContainer.children.filter((node) => node instanceof CubeMesh && node.position.x === 1);
		await this.rotate(cubes, Axis.x, clockwise, duration);
	}

	// Front two layers
	public async f(clockwise: boolean = true, duration: number = this.speed) {
		const cubes = this.cubeContainer.children.filter(
			(node) => node instanceof CubeMesh && (node.position.z === 1 || node.position.z === 0)
		);
		await this.rotate(cubes, Axis.z, clockwise, duration);
	}

	// Back two layers
	public async b(clockwise: boolean = true, duration: number = this.speed) {
		const cubes = this.cubeContainer.children.filter(
			(node) => node instanceof CubeMesh && (node.position.z === -1 || node.position.z === 0)
		);
		await this.rotate(cubes, Axis.z, clockwise, duration);
	}

	// Up two layers
	public async u(clockwise: boolean = true, duration: number = this.speed) {
		const cubes = this.cubeContainer.children.filter(
			(node) => node instanceof CubeMesh && (node.position.y === 1 || node.position.y === 0)
		);
		await this.rotate(cubes, Axis.y, !clockwise, duration);
	}

	// Down two layers
	public async d(clockwise: boolean = true, duration: number = this.speed) {
		const cubes = this.cubeContainer.children.filter(
			(node) => node instanceof CubeMesh && (node.position.y === -1 || node.position.y === 0)
		);
		await this.rotate(cubes, Axis.y, clockwise, duration);
	}

	// Left two layers
	public async l(clockwise: boolean = true, duration: number = this.speed) {
		const cubes = this.cubeContainer.children.filter(
			(node) => node instanceof CubeMesh && (node.position.x === -1 || node.position.x === 0)
		);
		await this.rotate(cubes, Axis.x, clockwise, duration);
	}

	// Right two layers
	public async r(clockwise: boolean = true, duration: number = this.speed) {
		const cubes = this.cubeContainer.children.filter(
			(node) => node instanceof CubeMesh && (node.position.x === 1 || node.position.x === 0)
		);
		await this.rotate(cubes, Axis.x, clockwise, duration);
	}

	// Cube on x axis
	public async x(clockwise: boolean = true, duration: number = this.speed) {
		const cubes = this.cubeContainer.children.filter((node) => node instanceof CubeMesh);
		await this.rotate(cubes, Axis.x, clockwise, duration);
	}

	// Cube on y axis
	public async y(clockwise: boolean = true, duration: number = this.speed) {
		const cubes = this.cubeContainer.children.filter((node) => node instanceof CubeMesh);
		await this.rotate(cubes, Axis.y, clockwise, duration);
	}

	// Cube on z axis
	public async z(clockwise: boolean = true, duration: number = this.speed) {
		const cubes = this.cubeContainer.children.filter((node) => node instanceof CubeMesh);
		await this.rotate(cubes, Axis.z, clockwise, duration);
	}

	private async rotate(cubes: THREE.Object3D[], axis: Axis, clockwise: boolean = false, duration: number) {
		if (!this.locked) {
			this.locked = true;
			const group = cubes.reduce((acc, cube) => acc.add(cube), new THREE.Object3D());

			this.cubeContainer.add(group);

			await this.rotateObject(group, axis, clockwise, duration);

			for (let i = group.children.length - 1; i >= 0; i--) {
				const child = group.children[i];
				this.cubeContainer.attach(child);
				child.position.set(
					Math.round(child.position.x),
					Math.round(child.position.y),
					Math.round(child.position.z)
				);
			}

			this.cubeContainer.remove(group);
			this.locked = false;
		}
	}

	private async rotateObject(
		object: THREE.Object3D,
		axis: Axis,
		clockwise: boolean,
		duration: number,
		start?: number
	) {
		return new Promise((resolve) => {
			const targetRadians = (clockwise ? -1 : 1) * THREE.MathUtils.degToRad(90);

			if (duration <= 0) {
				// Instant rotation
				switch (axis) {
					case Axis.x: object.rotation.x = targetRadians; break;
					case Axis.y: object.rotation.y = targetRadians; break;
					case Axis.z: object.rotation.z = targetRadians; break;
				}
				resolve(null);
				return;
			}

			const startTime = performance.now();

			const animate = () => {
				const now = performance.now();
				const progress = Math.min((now - startTime) / duration, 1);

				// Smooth step easing could be added here, currently linear
				const currentRadians = targetRadians * progress;

				switch (axis) {
					case Axis.x: object.rotation.x = currentRadians; break;
					case Axis.y: object.rotation.y = currentRadians; break;
					case Axis.z: object.rotation.z = currentRadians; break;
				}

				if (progress < 1) {
					requestAnimationFrame(animate);
				} else {
					resolve(null);
				}
			};

			animate();
		});
	}

	private render() {
		window.requestAnimationFrame(this.render.bind(this));
		// Jiroskop animasyonu için smooth interpolasyon
		this.animateGyro();
		this.renderer.render(this.scene, this.camera);
	}

	/**
	 * Jiroskop quaternion verisini ayarla
	 * @param quaternion { x, y, z, w } quaternion verisi
	 */
	public setGyroQuaternion(quaternion: { x: number; y: number; z: number; w: number } | null) {
		if (!quaternion) {
			return;
		}

		// GAN küpün quaternion formatını THREE.js formatına dönüştür
		const { x: qx, y: qy, z: qz, w: qw } = quaternion;
		const quat = new THREE.Quaternion(qx, qz, -qy, qw).normalize();

		// İlk veri geldiğinde basis'i kaydet
		if (!this.gyroBasis) {
			this.gyroBasis = quat.clone().conjugate();
		}

		// Hedef quaternion'u hesapla
		this.targetQuaternion.copy(quat.premultiply(this.gyroBasis).premultiply(this.HOME_ORIENTATION));
	}

	/**
	 * Jiroskop basis'ini sıfırla ve küpü standart pozisyona döndür
	 * Standart pozisyon: Beyaz üstte, Yeşil önde, Kırmızı sağda
	 */
	public resetGyroBasis() {
		this.gyroBasis = null;
		// Küpü başlangıç pozisyonuna döndür (HOME_ORIENTATION)
		this.targetQuaternion.copy(this.HOME_ORIENTATION);
		this.currentQuaternion.copy(this.HOME_ORIENTATION);
		this.cubeContainer.quaternion.copy(this.HOME_ORIENTATION);
	}

	/**
	 * Her frame'de jiroskop animasyonunu uygula
	 */
	private animateGyro() {
		if (this.gyroBasis) {
			// Smooth interpolasyon için slerp kullan (0.25 faktörü)
			this.currentQuaternion.slerp(this.targetQuaternion, 0.25);
			this.cubeContainer.quaternion.copy(this.currentQuaternion);
		}
	}

	private generateCubeCluster(initState: string) {
		const materialMapping: { [key: string]: number } = {
			R: 0,
			L: 1,
			U: 2,
			D: 3,
			F: 4,
			B: 5,
		};

		const positionMapping: { [key: string]: string } = {
			'1,1,1': 'B',
			'0,1,1': 'U',
			'0,-1,1': 'U',
			'0,1,-1': 'U',
		};

		const cubes: CubeMesh[] = [];
		for (let z = -1; z < 2; z++) {
			for (let y = -1; y < 2; y++) {
				for (let x = -1; x < 2; x++) {
					const cube = new CubeMesh({
						position: new THREE.Vector3(x, y, z),
						materials: this.materials,
					});

					cubes.push(cube);
				}
			}
		}

		return cubes;
	}
}
