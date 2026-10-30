import * as THREE from 'three';

/**
 * Geometry of a stickerless speedcube: every cubie is a rounded plastic body with a raised,
 * bevelled cap on each outer side. The caps are not squares. On an edge piece the two
 * corners facing the face centre are strongly rounded, and the centre cap is a squircle,
 * so the caps of a face draw a petal around its centre with dark plastic showing between.
 *
 * Units: one cubie is 1 wide. A cap's top sits 0.5 out from its cubie's centre, flush with
 * the cube's outer surface. Pure functions of their inputs, so they are unit tested.
 */

export const DIM = {
	/** Body half-width on hidden sides. The 0.032 left between two bodies is the visible gap. */
	bodyHalf: 0.484,
	/** Body half-width under a cap: low, so the gaps between caps read deep and dark. */
	bodyUnderCap: 0.445,
	bodyRadius: 0.05,
	/** Cap half-width at its side wall. */
	capHalf: 0.486,
	capTop: 0.5,
	capThickness: 0.085,
	bevelWidth: 0.052,
	bevelHeight: 0.046,
	/** Rise of the cap's top towards its middle; just enough to bend the reflections. */
	capDome: 0.004,
	capCornerRadius: 0.065,
	/** The two corners of an edge cap that face the centre: these draw the petal. */
	edgeInnerRadius: 0.27,
	/** Centre cap outline, |x|^n + |y|^n = 1: 2 is a circle, large n a square. */
	centerExponent: 4.2,
	/** The logo's side, as a share of the cap's width (the image has its own margin). */
	logoScale: 0.8,
};

export type CornerRadii = { tr: number; tl: number; bl: number; br: number };
export type CapShape = { kind: 'rect'; radii: CornerRadii } | { kind: 'squircle'; exponent: number };

const ARC_STEPS = 8;
const SQUIRCLE_STEPS = 64;
const BEVEL_STEPS = 6;
/** Rings across the flat top, as fractions of the way from the bevel to the middle. */
const TOP_RINGS = [0.3, 0.6, 0.85];

interface Ring {
	inset: number;
	z: number;
	/** Normal in (outward, up) components, unit length. */
	out: number;
	up: number;
}

/** Profile from the bottom of the side wall, over the bevel, to the domed top. */
function capProfile(half: number): Ring[] {
	const { capThickness: T, bevelWidth: bw, bevelHeight: bh, capDome: dome } = DIM;
	const rings: Ring[] = [
		{ inset: 0, z: -T, out: 1, up: 0 },
		{ inset: 0, z: -bh, out: 1, up: 0 },
	];
	// Quarter ellipse from the wall's top edge to the top's rim.
	for (let j = 1; j <= BEVEL_STEPS; j++) {
		const t = ((Math.PI / 2) * j) / BEVEL_STEPS;
		const nOut = Math.cos(t) / bw;
		const nUp = Math.sin(t) / bh;
		const len = Math.hypot(nOut, nUp);
		rings.push({ inset: bw * (1 - Math.cos(t)), z: -bh * (1 - Math.sin(t)), out: nOut / len, up: nUp / len });
	}
	const span = half - bw;
	for (const s of TOP_RINGS) {
		const slope = (dome * 2 * (1 - s)) / span;
		const len = Math.hypot(slope, 1);
		rings.push({ inset: bw + s * span, z: dome * (1 - (1 - s) * (1 - s)), out: slope / len, up: 1 / len });
	}
	return rings;
}

/**
 * The cap's outline shrunk by `inset`, counter-clockwise seen from above, with outward
 * normals. One shape always yields the same number of points, so rings line up.
 */
export function capOutline(shape: CapShape, half: number, inset: number): { x: number[]; y: number[]; nx: number[]; ny: number[] } {
	const x: number[] = [];
	const y: number[] = [];
	const nx: number[] = [];
	const ny: number[] = [];
	const h = half - inset;
	if (shape.kind === 'rect') {
		const corners: [keyof CornerRadii, number, number, number][] = [
			['tr', 1, 1, 0],
			['tl', -1, 1, Math.PI / 2],
			['bl', -1, -1, Math.PI],
			['br', 1, -1, (3 * Math.PI) / 2],
		];
		for (const [name, sx, sy, a0] of corners) {
			const r = Math.max(shape.radii[name] - inset, 0);
			const cx = sx * (h - r);
			const cy = sy * (h - r);
			for (let j = 0; j <= ARC_STEPS; j++) {
				const a = a0 + ((Math.PI / 2) * j) / ARC_STEPS;
				x.push(cx + r * Math.cos(a));
				y.push(cy + r * Math.sin(a));
				nx.push(Math.cos(a));
				ny.push(Math.sin(a));
			}
		}
	} else {
		const n = shape.exponent;
		for (let j = 0; j < SQUIRCLE_STEPS; j++) {
			const t = (2 * Math.PI * j) / SQUIRCLE_STEPS;
			const c = Math.cos(t);
			const s = Math.sin(t);
			const px = Math.sign(c) * Math.abs(c) ** (2 / n);
			const py = Math.sign(s) * Math.abs(s) ** (2 / n);
			x.push(h * px);
			y.push(h * py);
			// Gradient of |x|^n + |y|^n.
			const gx = Math.sign(px) * Math.abs(px) ** (n - 1);
			const gy = Math.sign(py) * Math.abs(py) ** (n - 1);
			const len = Math.hypot(gx, gy) || 1;
			nx.push(gx / len);
			ny.push(gy / len);
		}
	}
	return { x, y, nx, ny };
}

/**
 * One cap, built in its own frame: top at z = 0 facing +z, body below. The `color`
 * attribute is a grey shade, not the cap's colour: the bevel and the wall darken towards
 * the gap, which is the cheap stand-in for light not reaching into it. The cap's colour
 * comes from its material and multiplies with this.
 */
export function buildCapGeometry(shape: CapShape, half = DIM.capHalf): THREE.BufferGeometry {
	const rings = capProfile(half);
	const positions: number[] = [];
	const normals: number[] = [];
	const shades: number[] = [];
	let perRing = 0;
	for (const ring of rings) {
		const o = capOutline(shape, half, ring.inset);
		perRing = o.x.length;
		// Full brightness on the top; the wall drops to 40%.
		const depth = -ring.z;
		const k = Math.min(1, Math.max(0, (depth - 0.006) / (0.05 - 0.006)));
		const shade = 1 - 0.6 * k * k * (3 - 2 * k);
		for (let i = 0; i < perRing; i++) {
			positions.push(o.x[i], o.y[i], ring.z);
			normals.push(o.nx[i] * ring.out, o.ny[i] * ring.out, ring.up);
			shades.push(shade, shade, shade);
		}
	}
	const centerIndex = positions.length / 3;
	positions.push(0, 0, DIM.capDome);
	normals.push(0, 0, 1);
	shades.push(1, 1, 1);

	const index: number[] = [];
	for (let r = 0; r < rings.length - 1; r++) {
		for (let i = 0; i < perRing; i++) {
			const a = r * perRing + i;
			const b = r * perRing + ((i + 1) % perRing);
			const c = (r + 1) * perRing + ((i + 1) % perRing);
			const d = (r + 1) * perRing + i;
			index.push(a, b, c, a, c, d);
		}
	}
	const last = (rings.length - 1) * perRing;
	for (let i = 0; i < perRing; i++) index.push(last + i, last + ((i + 1) % perRing), centerIndex);

	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
	geo.setAttribute('color', new THREE.Float32BufferAttribute(shades, 3));
	geo.setIndex(index);
	geo.computeBoundingSphere();
	return geo;
}

export type CapKind = 'corner' | 'edge' | 'center';

export function capShapeFor(kind: CapKind): CapShape {
	const r = DIM.capCornerRadius;
	if (kind === 'center') return { kind: 'squircle', exponent: DIM.centerExponent };
	if (kind === 'edge') return { kind: 'rect', radii: { tr: r, tl: r, bl: DIM.edgeInnerRadius, br: DIM.edgeInnerRadius } };
	return { kind: 'rect', radii: { tr: r, tl: r, bl: r, br: r } };
}

/** What kind of piece sits at `home` on a puzzle whose outer layer is at `hi`. */
export function capKindAt(home: THREE.Vector3, hi: number): CapKind {
	const outer = [home.x, home.y, home.z].filter((v) => Math.abs(v) > hi - 1e-6).length;
	return outer === 1 ? 'center' : outer === 2 ? 'edge' : 'corner';
}

/**
 * Where a cap sits inside its cubie: rotated so its local +z is the face normal, and for an
 * edge so its local -y points at the face centre (that is where the shape's big corners
 * are). Centres keep +y towards U, or towards B on U and D, so the logo reads upright.
 */
export function capMatrix(home: THREE.Vector3, normal: THREE.Vector3, hi: number): THREE.Matrix4 {
	const z = normal.clone();
	const kind = capKindAt(home, hi);
	let y: THREE.Vector3;
	if (kind === 'center') {
		y = Math.abs(normal.y) > 0.5 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
	} else {
		// Away from the face centre, within the face.
		const inPlane = home.clone().addScaledVector(normal, -home.dot(normal));
		if (kind === 'edge') {
			y = inPlane.normalize();
		} else {
			// Corners are symmetric; any in-plane axis will do.
			const axis = Math.abs(inPlane.x) > 1e-6 ? 0 : 1;
			y = new THREE.Vector3().setComponent(axis, Math.sign(inPlane.getComponent(axis)));
		}
	}
	const x = new THREE.Vector3().crossVectors(y, z);
	return new THREE.Matrix4().makeBasis(x, y, z).setPosition(normal.clone().multiplyScalar(DIM.capTop));
}

/**
 * The logo's place on its piece: on the U cap, upright when the cube is seen from the front
 * (its top towards B), just above the cap's dome.
 */
export function logoMatrix(): THREE.Matrix4 {
	return new THREE.Matrix4()
		.makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0))
		.setPosition(0, DIM.capTop + DIM.capDome + 0.0015, 0);
}

/**
 * Which piece carries the logo: the U centre on a 3x3, the UFR corner on a 2x2 (no centres;
 * UFR is the corner nearest the viewer in the home view).
 */
export function logoHome(hi: number): THREE.Vector3 {
	return hi >= 1 ? new THREE.Vector3(0, hi, 0) : new THREE.Vector3(hi, hi, hi);
}

/**
 * A rounded body for the cubie at `home`. Sides carrying a cap stop at bodyUnderCap, the
 * rest at bodyHalf. Built as six gridded faces whose vertices are pushed out onto rounded
 * edges and corners; grid lines near each edge are spaced so the rounding gets even steps.
 */
export function buildBodyGeometry(home: THREE.Vector3, hi: number): THREE.BufferGeometry {
	const { bodyHalf, bodyUnderCap, bodyRadius: r } = DIM;
	const min: number[] = [];
	const max: number[] = [];
	for (let a = 0; a < 3; a++) {
		const v = home.getComponent(a);
		min.push(v < -hi + 1e-6 ? -bodyUnderCap : -bodyHalf);
		max.push(v > hi - 1e-6 ? bodyUnderCap : bodyHalf);
	}
	const K = 3;
	const lines = (a: number) => {
		const out: number[] = [];
		for (let j = K; j >= 0; j--) out.push(min[a] + r - r * Math.tan((Math.PI / 4) * (j / K)));
		for (let j = 0; j <= K; j++) out.push(max[a] - r + r * Math.tan((Math.PI / 4) * (j / K)));
		return out;
	};

	const positions: number[] = [];
	const normals: number[] = [];
	const index: number[] = [];
	const p = [0, 0, 0];
	for (let a = 0; a < 3; a++) {
		for (const s of [1, -1]) {
			const u = (a + 1) % 3;
			const v = (a + 2) % 3;
			const lu = lines(u);
			const lv = lines(v);
			const base = positions.length / 3;
			for (let i = 0; i < lu.length; i++) {
				for (let j = 0; j < lv.length; j++) {
					p[a] = s > 0 ? max[a] : min[a];
					p[u] = lu[i];
					p[v] = lv[j];
					// Nearest point of the box shrunk by r, then out by r along the offset.
					const d = [0, 0, 0];
					let len = 0;
					for (let k = 0; k < 3; k++) {
						const inner = Math.min(Math.max(p[k], min[k] + r), max[k] - r);
						d[k] = p[k] - inner;
						len += d[k] * d[k];
					}
					len = Math.sqrt(len) || 1;
					for (let k = 0; k < 3; k++) {
						const inner = Math.min(Math.max(p[k], min[k] + r), max[k] - r);
						positions.push(inner + (d[k] / len) * r);
						normals.push(d[k] / len);
					}
				}
			}
			const nv = lv.length;
			for (let i = 0; i < lu.length - 1; i++) {
				for (let j = 0; j < nv - 1; j++) {
					const i0 = base + i * nv + j;
					const i1 = base + (i + 1) * nv + j;
					const i2 = base + (i + 1) * nv + j + 1;
					const i3 = base + i * nv + j + 1;
					if (s > 0) index.push(i0, i1, i2, i0, i2, i3);
					else index.push(i0, i2, i1, i0, i3, i2);
				}
			}
		}
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
	geo.setIndex(index);
	geo.computeBoundingSphere();
	return geo;
}
