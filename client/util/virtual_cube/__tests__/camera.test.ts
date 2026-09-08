import * as THREE from 'three';

import {
	ANGLE_MAX,
	ANGLE_MIN,
	cameraPosition,
	FAR,
	makeCamera,
	moveCameraDelta,
	NEAR,
	parseOrientation,
	RADIUS,
} from '../camera';

/**
 * The camera is the one part of the port whose mistakes are invisible: a flipped
 * argument or a dropped default still renders a cube, just not the right one. So
 * the projection is pinned to hand-computed numbers before any pixel is drawn.
 */
describe('virtual cube camera', () => {
	describe('orientation setting', () => {
		it('parses the two cstimer presets', () => {
			expect(parseOrientation('6,12')).toEqual({ theta: 0, phi: 6 }); // UF
			expect(parseOrientation('10,11')).toEqual({ theta: 4, phi: 5 }); // URF
		});

		it('falls back to UF for a missing or malformed value', () => {
			expect(parseOrientation('')).toEqual({ theta: 0, phi: 6 });
			expect(parseOrientation(undefined as any)).toEqual({ theta: 0, phi: 6 });
		});
	});

	describe('position', () => {
		it('places the UF view at exactly (0, 2, 2)', () => {
			// phi = 6 steps of 7.5 degrees is 45 degrees, and 2*sqrt(2) * sin(45) is
			// exactly 2. An exact expectation here catches an angle-unit error that a
			// tolerance-based check would wave through.
			const pos = cameraPosition(0, 6);
			expect(pos.x).toBeCloseTo(0, 12);
			expect(pos.y).toBeCloseTo(2, 12);
			expect(pos.z).toBeCloseTo(2, 12);
		});

		it('keeps the orbit radius at 2*sqrt(2) for every angle', () => {
			for (const theta of [-6, -3, 0, 4, 6]) {
				for (const phi of [-6, 0, 5, 6]) {
					expect(cameraPosition(theta, phi).length()).toBeCloseTo(RADIUS, 12);
				}
			}
		});

		it('places the URF view up and to the right of the UF view', () => {
			const uf = cameraPosition(0, 6);
			const urf = cameraPosition(4, 5);
			expect(urf.x).toBeGreaterThan(uf.x);
			expect(urf.y).toBeLessThan(uf.y);
		});
	});

	describe('projection matrix', () => {
		const e = makeCamera(0, 6).projectionMatrix.elements;

		// fov 30, aspect 1, near 0.1, far 1000:
		//   ymax = 0.1 * tan(15 deg) = 0.0267949192431122
		//   x = y = 2 * near / (2 * ymax)      = 3.7320508075688776
		//   c = -(far + near) / (far - near)   = -1.0002000200020003
		//   d = -2 * far * near / (far - near) = -0.2000200020002
		it('matches the hand-computed frustum', () => {
			expect(e[0]).toBeCloseTo(3.7320508075688776, 12); // x scale
			expect(e[5]).toBeCloseTo(3.7320508075688776, 12); // y scale
			expect(e[10]).toBeCloseTo(-1.0002000200020003, 12); // c
			expect(e[14]).toBeCloseTo(-0.2000200020002, 12); // d
			expect(e[11]).toBe(-1);
			expect(e[15]).toBe(0);
		});

		it('is symmetric, so the off-centre terms vanish', () => {
			expect(e[8]).toBeCloseTo(0, 15); // a
			expect(e[9]).toBeCloseTo(0, 15); // b
		});

		it('has a non-zero d term, proving near is 0.1 and not 0', () => {
			// `new THREE.Camera(30, 1, 0, 1000)` reads as near = 0, but the reference
			// constructor is `this.near = near || 0.1`. With a true near of 0 the
			// projection degenerates to c = -1, d = 0, every centroid projects to the
			// same z, the depth sort collapses to insertion order and the cube renders
			// inside out. This assertion is the tripwire for that.
			expect(NEAR).toBe(0.1);
			expect(e[14]).not.toBe(0);
			expect(e[10]).not.toBe(-1);
		});
	});

	describe('screen projection', () => {
		/** Project a world point the way the painter does. */
		function project(camera: ReturnType<typeof makeCamera>, x: number, y: number, z: number) {
			const m = camera.projScreenMatrix.elements;
			const w = m[3] * x + m[7] * y + m[11] * z + m[15];
			return {
				x: (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
				y: (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
				z: m[2] * x + m[6] * y + m[10] * z + m[14],
			};
		}

		it('keeps the image upright', () => {
			// The single most likely porting mistake is r125's makePerspective taking
			// (left, right, top, bottom) where the old makeFrustum took
			// (left, right, bottom, top). Getting it wrong mirrors the cube vertically
			// and nothing else complains.
			const camera = makeCamera(0, 0);
			expect(project(camera, 0, 0.5, 0).y).toBeGreaterThan(0);
			expect(project(camera, 0, -0.5, 0).y).toBeLessThan(0);
		});

		it('keeps left and right the right way round', () => {
			const camera = makeCamera(0, 0);
			expect(project(camera, 0.5, 0, 0).x).toBeGreaterThan(0);
			expect(project(camera, -0.5, 0, 0).x).toBeLessThan(0);
		});

		it('puts the whole cube between the near and far planes', () => {
			// Sticker world coordinates are bounded by the cube scale, so a corner is
			// at most 0.45 * sqrt(3) from the origin. Everything must land inside the
			// visibility window or the painter drops faces.
			const camera = makeCamera(0, 6);
			for (const x of [-0.45, 0.45]) {
				for (const y of [-0.45, 0.45]) {
					for (const z of [-0.45, 0.45]) {
						const p = project(camera, x, y, z);
						expect(p.z).toBeGreaterThan(NEAR);
						expect(p.z).toBeLessThan(FAR);
					}
				}
			}
		});

		it('sorts nearer points after farther ones', () => {
			// The painter sorts descending on the w-divided centroid z, so a point
			// closer to the camera must produce the smaller key and be drawn last.
			const camera = makeCamera(0, 6);
			const m = camera.projScreenMatrix.elements;
			const depth = (x: number, y: number, z: number) => {
				const w = m[3] * x + m[7] * y + m[11] * z + m[15];
				return (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
			};
			// The camera sits at (0, 2, 2), so (0, 0.4, 0.4) is nearer than (0, -0.4, -0.4).
			expect(depth(0, 0.4, 0.4)).toBeLessThan(depth(0, -0.4, -0.4));
		});
	});

	describe('arrow key orbit', () => {
		it('clamps both angles', () => {
			let camera = makeCamera(0, 0);
			for (let i = 0; i < 20; i++) camera = moveCameraDelta(camera, 1, 1);
			expect(camera.theta).toBe(ANGLE_MAX);
			expect(camera.phi).toBe(ANGLE_MAX);

			for (let i = 0; i < 40; i++) camera = moveCameraDelta(camera, -1, -1);
			expect(camera.theta).toBe(ANGLE_MIN);
			expect(camera.phi).toBe(ANGLE_MIN);
		});

		it('never reaches a degenerate look-at basis', () => {
			// phi is clamped to +/-45 degrees, so the view direction is never parallel
			// to `up` and lookAt never falls back to its epsilon nudge. This is the
			// trap that bit the hero cube port; here it is structurally impossible.
			for (let phi = ANGLE_MIN; phi <= ANGLE_MAX; phi++) {
				const pos = cameraPosition(0, phi);
				const dir = pos.clone().normalize();
				const cross = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir);
				expect(cross.length()).toBeGreaterThan(0.5);
			}
		});

		it('produces a finite projection at every reachable angle', () => {
			for (let theta = ANGLE_MIN; theta <= ANGLE_MAX; theta++) {
				for (let phi = ANGLE_MIN; phi <= ANGLE_MAX; phi++) {
					for (const value of makeCamera(theta, phi).projScreenMatrix.elements) {
						expect(Number.isFinite(value)).toBe(true);
					}
				}
			}
		});
	});
});
