import * as THREE from 'three';
import { calculateNetRotationQuat, frameToQuat } from '../cube_rotation_quat';
import { framesAlongTokens } from '../../../shared/smart_cube/rotation_reconstruction';

const NORMAL: Record<string, THREE.Vector3> = {
	R: new THREE.Vector3(1, 0, 0),
	L: new THREE.Vector3(-1, 0, 0),
	U: new THREE.Vector3(0, 1, 0),
	D: new THREE.Vector3(0, -1, 0),
	F: new THREE.Vector3(0, 0, 1),
	B: new THREE.Vector3(0, 0, -1),
};

/** The frame at the start of a solve held with `holding` and no turns. */
const frameOf = (holding: string) => framesAlongTokens([], holding)[0];

/** q and -q are the same rotation. */
function sameRotation(a: THREE.Quaternion, b: THREE.Quaternion) {
	expect(Math.abs(a.dot(b))).toBeCloseTo(1, 6);
}

describe('frameToQuat', () => {
	it('agrees with the holding quaternion for a single rotation', () => {
		for (const r of ['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2']) {
			sameRotation(frameToQuat(frameOf(r)), calculateNetRotationQuat([r]));
		}
	});

	it('puts every core face where the solver has it after several rotations', () => {
		for (const holding of ["z2 y'", 'x y', "y x' z2", 'z y2 x']) {
			const frame = frameOf(holding);
			const q = frameToQuat(frame);
			for (const pos of Object.keys(NORMAL)) {
				const core = (frame as any)[pos];
				const seen = NORMAL[core].clone().applyQuaternion(q);
				expect(seen.distanceTo(NORMAL[pos])).toBeLessThan(1e-6);
			}
		}
	});
});
