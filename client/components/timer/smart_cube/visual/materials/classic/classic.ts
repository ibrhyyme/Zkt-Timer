import * as THREE from 'three';

import { resourceUri } from '../../../../../../util/storage';

const textureLink = (color: string) => resourceUri(`/images/smart_cube/${color}.png`);

export const material = [
	new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load(textureLink('red')) }),
	new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load(textureLink('orange')) }),

	new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load(textureLink('white')) }),
	new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load(textureLink('yellow')) }),

	new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load(textureLink('green')) }),
	new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load(textureLink('blue')) }),
];

// Note: Standard scheme is typically:
// U: White, D: Yellow
// F: Green, B: Blue
// R: Red, L: Orange
// The generic layout in RubiksCube.ts expects materials in order: R, L, U, D, F, B
// So:
// 0: R (Red)
// 1: L (Orange)
// 2: U (White)
// 3: D (Yellow)
// 4: F (Green)
// 5: B (Blue)
