import * as THREE from 'three';

/**
 * Materials for the smart-cube renderer, on three r125.
 *
 * Tone mapping is done per material instead of by the renderer: r125 has no hue-preserving
 * operator (ACES turns saturated red and yellow orange-ish), so the renderer runs without
 * one and these materials apply Khronos PBR Neutral themselves. Nothing global changes,
 * so the landing cube, which shares this copy of three, is untouched.
 */

// Khronos PBR Neutral tone mapping, written from the published specification.
const NEUTRAL_TONE_MAP = `
vec3 zktNeutralToneMap( vec3 color ) {
	const float startCompression = 0.76;
	const float desaturation = 0.15;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < startCompression ) return color;
	float d = 1.0 - startCompression;
	float newPeak = 1.0 - d * d / ( peak + d - startCompression );
	color *= newPeak / peak;
	float g = 1.0 - 1.0 / ( desaturation * ( peak - newPeak ) + 1.0 );
	return mix( color, vec3( newPeak ), g );
}
`;

function injectToneMap(shader: THREE.Shader) {
	shader.fragmentShader = shader.fragmentShader
		.replace('#include <common>', `#include <common>\n${NEUTRAL_TONE_MAP}`)
		.replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb = zktNeutralToneMap( gl_FragColor.rgb );');
}

/** sRGB hex to the linear colour the lighting works in. */
export function linearColor(hex: string | number): THREE.Color {
	return new THREE.Color(hex).convertSRGBToLinear();
}

/**
 * A cap: glossy injection-moulded plastic with a clear coat, which is what puts the sharp
 * highlight on the bevels. `lite` drops the clear coat for weak devices.
 */
export function createCapMaterial(color: THREE.Color, lite: boolean): THREE.MeshStandardMaterial {
	const material = lite
		? new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 0.34, metalness: 0 })
		: new THREE.MeshPhysicalMaterial({
				color,
				vertexColors: true,
				roughness: 0.3,
				metalness: 0,
				// Weaker base reflection than the 4% default: the top face mirrors the sky and
				// would otherwise fade its colour. The clear coat still draws the bevel highlights.
				reflectivity: 0.35,
				clearcoat: 0.42,
				clearcoatRoughness: 0.18,
		  });
	material.onBeforeCompile = injectToneMap;
	material.customProgramCacheKey = () => (lite ? 'zkt-cap-lite-v1' : 'zkt-cap-v1');
	return material;
}

/** The logo printed on the white centre: same plastic, drawn just above the cap. */
export function createLogoMaterial(map: THREE.Texture): THREE.MeshPhysicalMaterial {
	const material = new THREE.MeshPhysicalMaterial({
		map,
		transparent: true,
		depthWrite: false,
		polygonOffset: true,
		polygonOffsetFactor: -2,
		polygonOffsetUnits: -2,
		roughness: 0.3,
		metalness: 0,
		clearcoat: 0.5,
		clearcoatRoughness: 0.18,
	});
	material.onBeforeCompile = injectToneMap;
	material.customProgramCacheKey = () => 'zkt-logo-v1';
	return material;
}

/** Plastic colours of the body, in sRGB. */
const GAP = '#0e0f11';
const SMOKE = '#131417';
// An opened layer's inside faces the key light; any lighter and it reads as white plastic.
const FROST = '#5f646d';

export interface BodyUniforms {
	uHome: { value: THREE.Vector3 };
	/** Per axis of the cubie's own frame: how far the gap on the + / - side is opened by a turn, 0..1. */
	uExposePos: { value: THREE.Vector3 };
	uExposeNeg: { value: THREE.Vector3 };
	/** Colour of the cap on each axis of the cubie's own frame (black where there is none). */
	uCap: { value: THREE.Color }[];
}

/**
 * The body. Closed, the gaps between pieces are dark plastic. When a turn opens a gap, the
 * inner faces it uncovers are drawn as frosted glass instead of black: lit with a pale tint
 * of the nearby caps towards the outside, going smoky towards the core. The shader only
 * decides colour, so it costs a few instructions and no extra pass.
 */
export function createBodyMaterial(home: THREE.Vector3): { material: THREE.MeshStandardMaterial; uniforms: BodyUniforms } {
	const uniforms: BodyUniforms = {
		uHome: { value: home.clone() },
		uExposePos: { value: new THREE.Vector3() },
		uExposeNeg: { value: new THREE.Vector3() },
		uCap: [0, 1, 2].map(() => ({ value: new THREE.Color(0, 0, 0) })),
	};
	// Low reflection: an opened layer's inside is seen at a grazing angle, where even matte
	// plastic mirrors the bright studio ceiling and turns into a pale sheet.
	const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0, envMapIntensity: 0.22 });
	const gap = linearColor(GAP);
	const smoke = linearColor(SMOKE);
	const frost = linearColor(FROST);
	material.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, {
			uHome: uniforms.uHome,
			uExposePos: uniforms.uExposePos,
			uExposeNeg: uniforms.uExposeNeg,
			uCapX: uniforms.uCap[0],
			uCapY: uniforms.uCap[1],
			uCapZ: uniforms.uCap[2],
			uGap: { value: gap },
			uSmoke: { value: smoke },
			uFrost: { value: frost },
		});
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', '#include <common>\nvarying vec3 vBodyPos;\nvarying vec3 vBodyNormal;')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBodyPos = position;\nvBodyNormal = normal;');
		injectToneMap(shader);
		shader.fragmentShader = shader.fragmentShader
			.replace(
				'#include <common>',
				`#include <common>
varying vec3 vBodyPos;
varying vec3 vBodyNormal;
uniform vec3 uHome;
uniform vec3 uExposePos;
uniform vec3 uExposeNeg;
uniform vec3 uCapX;
uniform vec3 uCapY;
uniform vec3 uCapZ;
uniform vec3 uGap;
uniform vec3 uSmoke;
uniform vec3 uFrost;
vec3 zktGlassGlow = vec3( 0.0 );`
			)
			.replace(
				'#include <color_fragment>',
				`#include <color_fragment>
{
	// The side of the box this pixel is on.
	vec3 an = abs( vBodyNormal );
	vec3 axis = an.x >= an.y && an.x >= an.z ? vec3( 1.0, 0.0, 0.0 ) : ( an.y >= an.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 0.0, 0.0, 1.0 ) );
	float side = sign( dot( vBodyNormal, axis ) );
	float homeOnAxis = dot( uHome, axis );
	if ( homeOnAxis != 0.0 && side == sign( homeOnAxis ) ) {
		// Under a cap, seen only through the gaps between caps.
		diffuseColor.rgb = uGap;
	} else {
		float opened = dot( side > 0.0 ? uExposePos : uExposeNeg, axis );
		// Nearness to each capped side of the piece, in its own frame.
		vec3 near = vec3(
			uHome.x != 0.0 ? smoothstep( -0.15, 0.45, vBodyPos.x * sign( uHome.x ) ) : 0.0,
			uHome.y != 0.0 ? smoothstep( -0.15, 0.45, vBodyPos.y * sign( uHome.y ) ) : 0.0,
			uHome.z != 0.0 ? smoothstep( -0.15, 0.45, vBodyPos.z * sign( uHome.z ) ) : 0.0 );
		float total = near.x + near.y + near.z;
		vec3 tint = total > 0.0 ? ( near.x * uCapX + near.y * uCapY + near.z * uCapZ ) / total : uFrost;
		// Kept dim, so next to a white cap it still reads as glass and not as white plastic.
		vec3 pastel = mix( tint * 0.45, uFrost, 0.5 );
		float core = 1.0 - smoothstep( 0.25, 1.25, length( uHome + vBodyPos ) );
		vec3 glass = mix( mix( uFrost, uSmoke, core ), pastel, 0.6 * min( total, 1.0 ) );
		diffuseColor.rgb = mix( uGap, glass, opened );
		zktGlassGlow = pastel * 0.06 * min( total, 1.0 ) * opened;
	}
}`
			)
			.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += zktGlassGlow;');
	};
	material.customProgramCacheKey = () => 'zkt-body-v1';
	return { material, uniforms };
}
