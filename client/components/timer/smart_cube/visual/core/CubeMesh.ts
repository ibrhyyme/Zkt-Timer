import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry';

type CubeMeshProps = {
	position: THREE.Vector3;
	materials: THREE.Material[];
};

export default class CubeMesh extends THREE.Mesh {
	constructor({ position, materials }: CubeMeshProps) {
		super(new THREE.BoxGeometry(0.96, 0.96, 0.96), materials);
		this.position.x = position.x;
		this.position.y = position.y;
		this.position.z = position.z;
	}
}
