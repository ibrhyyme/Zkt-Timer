/**
 * Whole-cube rotations (x, y, z) detected from a smart cube's gyroscope stream.
 *
 * A smart cube reports face turns relative to its own core, so a rotation of the whole cube
 * never shows up in the move stream. The gyroscope sees it. This module turns a recorded
 * gyro stream into the rotations the solver made, in the CORE frame: `x` is a clockwise
 * quarter turn of the whole cube about the core's R axis, `y` about U, `z` about F. Which
 * way the solver was holding the cube is a separate question, answered when the moves are
 * reconstructed (rotation_reconstruction.ts).
 *
 * Detection is relative, not absolute. Each reading is compared with the orientation the
 * cube settled in after the last detected rotation, in the cube's own frame, and snapped to
 * the nearest of the 24 cube orientations. That needs no calibration step (acubemy asks for
 * a "white top, green front, U4" step because it compares against the world), and the
 * gyro's slow drift and the hand's tilt (20-30 degrees off square on a GAN i4 capture) are
 * absorbed by letting the reference follow the cube while it is not being rotated.
 *
 * A new orientation counts once the cube has stayed close to it long enough: each reading
 * adds (closeness x elapsed time), and the rotation fires at ACCUMULATED_THRESHOLD_S. That
 * keeps a turn in progress (halfway between two orientations, so close to neither) from
 * counting, and it does not depend on the sample rate (about 11 Hz on a GAN i4).
 *
 * Pure: no browser or Node APIs, shared by the client (detection at solve end) and tests.
 */

/** One gyroscope reading as the drivers emit it: GAN's device frame (+X red, +Y blue, +Z white). */
export interface GyroSample {
	t: number;
	x: number;
	y: number;
	z: number;
	w: number;
}

/** A detected rotation, in the `smart_turns` shape so the same compact codec stores it. */
export interface DetectedRotation {
	turn: string;
	completedAt: number;
}

interface Quat {
	w: number;
	x: number;
	y: number;
	z: number;
}

/** Seconds of full closeness a new orientation needs before it counts. */
const ACCUMULATED_THRESHOLD_S = 0.05;
/**
 * How fast the reference follows a cube that is not being rotated, in degrees per second.
 * Hands hold a cube 20-30 degrees off square and drift there between rotations; at 3 deg/s
 * (acubemy's value) a 180 degree flip started from such a tilt never came close enough to
 * any orientation to count. 6-15 detect it on the GAN i4 capture; 25 starts to split the
 * fast free rotations. A real rotation turns at well over 180 deg/s, so this cannot absorb one.
 */
const DRIFT_FOLLOW_DEG_PER_S = 10;
/** A gap in the stream longer than this does not count as time spent in one orientation. */
const MAX_STEP_S = 0.25;

/**
 * Slices, confirmed by both kinds of evidence. Opposite faces turned in a slice's sense this
 * close together may be a slice; the gyro then decides. A fast slice never lets the stream
 * settle: on a GAN i4 Z perm the readings came within 23-29 degrees of the new orientation
 * and moved on, and the closeness above summed to 0.035 and 0.047 against 0.05. So a slice
 * counts once the reading is past halfway (SLICE_CONFIRM_DEG, nearer the turn its faces imply
 * than where the core was) within the window the sensor lags by. 40 missed the same solve's
 * last M' at 43. R and L' turned as two separate moves leave the core where it was, the
 * reading stays ~90 degrees from the implied turn, and they stay two moves.
 */
export const SLICE_PAIR_GYRO_MS = 150;
export const SLICE_CONFIRM_WINDOW_MS = 500;
const SLICE_CONFIRM_DEG = 45;

/** Core face pair (either order) -> the core rotation that slice implies (M = R L' x'). */
const SLICE_PAIR_ROTATION: Record<string, string> = {
	"R L'": "x'",
	"R' L": 'x',
	"U D'": "y'",
	"U' D": 'y',
	"F' B": 'z',
	"F B'": "z'",
};

export function slicePairRotation(a: string, b: string): string | null {
	return SLICE_PAIR_ROTATION[`${a} ${b}`] || SLICE_PAIR_ROTATION[`${b} ${a}`] || null;
}

interface PendingSlice {
	/** When the second face turned: the slice is done from the faces' side then. */
	t: number;
	token: string;
}

/** Consecutive opposite-face pairs that could be slices, in order. */
function slicePairs(turns: DetectedRotation[]): PendingSlice[] {
	const out: PendingSlice[] = [];
	for (let i = 0; i + 1 < turns.length; i++) {
		const a = turns[i];
		const b = turns[i + 1];
		const token = b.completedAt - a.completedAt <= SLICE_PAIR_GYRO_MS ? slicePairRotation(a.turn, b.turn) : null;
		if (!token) continue;
		out.push({ t: b.completedAt, token });
		i++;
	}
	return out;
}

const IDENTITY: Quat = { w: 1, x: 0, y: 0, z: 0 };

function mul(a: Quat, b: Quat): Quat {
	return {
		w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
		x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
		y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
		z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
	};
}

function norm(q: Quat): Quat {
	const s = 1 / (Math.hypot(q.w, q.x, q.y, q.z) || 1);
	return { w: q.w * s, x: q.x * s, y: q.y * s, z: q.z * s };
}

function conj(q: Quat): Quat {
	return { w: q.w, x: -q.x, y: -q.y, z: -q.z };
}

/** Angle between two orientations, in degrees (q and -q are the same orientation). */
function angleDeg(a: Quat, b: Quat): number {
	const d = Math.abs(a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z);
	return (2 * Math.acos(Math.min(1, d)) * 180) / Math.PI;
}

function slerp(a: Quat, b: Quat, f: number): Quat {
	let d = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
	const s = d < 0 ? -1 : 1;
	d = Math.abs(d);
	if (d > 0.9995) {
		return norm({ w: a.w + (s * b.w - a.w) * f, x: a.x + (s * b.x - a.x) * f, y: a.y + (s * b.y - a.y) * f, z: a.z + (s * b.z - a.z) * f });
	}
	const th = Math.acos(d);
	const k1 = Math.sin((1 - f) * th) / Math.sin(th);
	const k2 = (s * Math.sin(f * th)) / Math.sin(th);
	return norm({ w: a.w * k1 + b.w * k2, x: a.x * k1 + b.x * k2, y: a.y * k1 + b.y * k2, z: a.z * k1 + b.z * k2 });
}

/** GAN device frame to the frame used here: +X = R, +Y = U, +Z = F (the core's faces). */
function fromDevice(s: GyroSample): Quat {
	return norm({ w: s.w, x: s.x, y: s.z, z: -s.y });
}

function axisAngle(axis: 'x' | 'y' | 'z', deg: number): Quat {
	const h = (deg * Math.PI) / 360;
	return { w: Math.cos(h), x: axis === 'x' ? Math.sin(h) : 0, y: axis === 'y' ? Math.sin(h) : 0, z: axis === 'z' ? Math.sin(h) : 0 };
}

// A clockwise turn seen from the face is a negative angle about that face's axis.
const ROTATION_QUATS: Record<string, Quat> = {};
for (const axis of ['x', 'y', 'z'] as const) {
	ROTATION_QUATS[axis] = axisAngle(axis, -90);
	ROTATION_QUATS[`${axis}'`] = axisAngle(axis, 90);
	ROTATION_QUATS[`${axis}2`] = axisAngle(axis, 180);
}

interface Orientation {
	q: Quat;
	/** Core-frame rotation tokens that reach it from the reference, in order. */
	tokens: string[];
}

/** The 23 non-identity cube orientations, each with its shortest rotation spelling. */
const ORIENTATIONS: Orientation[] = (() => {
	const out: Orientation[] = [];
	const seen = (q: Quat) => angleDeg(q, IDENTITY) < 1 || out.some((o) => angleDeg(o.q, q) < 1);
	const names = Object.keys(ROTATION_QUATS);
	for (const a of names) {
		if (!seen(ROTATION_QUATS[a])) out.push({ q: ROTATION_QUATS[a], tokens: [a] });
	}
	for (const a of names) {
		for (const b of names) {
			// Body-frame rotations compose left to right: a first, then b about the new axes.
			const q = norm(mul(ROTATION_QUATS[a], ROTATION_QUATS[b]));
			if (!seen(q)) out.push({ q, tokens: [a, b] });
		}
	}
	return out;
})();

function closeness(deg: number): number {
	// 1 at the exact orientation, 0.5 at 22.5 degrees off, ~0 at the 45 degree boundary.
	return 1 / (1 + Math.exp(-((Math.max(0, 45 - deg) / 45) * 12 - 6)));
}

/**
 * `turns`: the solve's face turns on the samples' timeline, core frame. Optional; with them,
 * fast slices the stream alone misses are confirmed (SLICE_PAIR_GYRO_MS).
 */
export function detectCubeRotations(samples: GyroSample[], turns: DetectedRotation[] = []): DetectedRotation[] {
	const out: DetectedRotation[] = [];
	if (!samples || samples.length < 2) return out;

	let reference = fromDevice(samples[0]);
	let lastT = samples[0].t;
	let candidate: Orientation | null = null;
	let candidateSince = 0;
	let accumulated = 0;
	let pending = slicePairs(turns);

	for (let i = 1; i < samples.length; i++) {
		const s = samples[i];
		const q = fromDevice(s);
		const dt = Math.min(MAX_STEP_S, Math.max(0, (s.t - lastT) / 1000));
		lastT = s.t;

		// The cube's orientation relative to the reference, in the cube's own frame.
		const rel = norm(mul(conj(reference), q));

		// Slices whose faces are in and whose window is open, oldest first. The reading is
		// checked against each run of them (an M2 is two in a row): the core is where they put it.
		pending = pending.filter((p) => s.t - p.t <= SLICE_CONFIRM_WINDOW_MS);
		const open = pending.filter((p) => p.t <= s.t);
		let implied = IDENTITY;
		let confirmed = 0;
		for (let k = 0; k < open.length; k++) {
			implied = norm(mul(implied, ROTATION_QUATS[open[k].token]));
			if (angleDeg(rel, implied) < SLICE_CONFIRM_DEG) confirmed = k + 1;
		}
		if (confirmed > 0) {
			for (const p of open.slice(0, confirmed)) out.push({ turn: p.token, completedAt: p.t });
			implied = IDENTITY;
			for (const p of open.slice(0, confirmed)) implied = norm(mul(implied, ROTATION_QUATS[p.token]));
			reference = norm(mul(reference, implied));
			pending = pending.filter((p) => !open.slice(0, confirmed).includes(p));
			candidate = null;
			accumulated = 0;
			continue;
		}

		const stillDeg = angleDeg(rel, IDENTITY);
		let nearest: Orientation | null = null;
		let nearestDeg = stillDeg;
		for (const o of ORIENTATIONS) {
			const d = angleDeg(rel, o.q);
			if (d < nearestDeg) {
				nearestDeg = d;
				nearest = o;
			}
		}

		if (!nearest) {
			candidate = null;
			accumulated = 0;
			if (stillDeg > 0.1) {
				reference = slerp(reference, q, Math.min(1, (DRIFT_FOLLOW_DEG_PER_S * dt) / stillDeg));
			}
			continue;
		}

		if (nearest !== candidate) {
			candidate = nearest;
			// The reading that first lands nearer the new orientation is the closest thing to
			// the moment of the rotation the stream has.
			candidateSince = s.t;
			accumulated = 0;
		}
		accumulated += closeness(nearestDeg) * dt;
		if (accumulated >= ACCUMULATED_THRESHOLD_S) {
			for (const turn of nearest.tokens) out.push({ turn, completedAt: candidateSince });
			// Snap to the exact orientation rather than to the reading: the reading's small
			// offset is left for the drift follow above instead of being baked in.
			reference = norm(mul(reference, nearest.q));
			// A slow slice the stream caught on its own: its faces are explained.
			const axes = new Set(nearest.tokens.map((tok) => tok[0]));
			pending = pending.filter((p) => !(p.t <= s.t && axes.has(p.token[0])));
			candidate = null;
			accumulated = 0;
		}
	}

	return out;
}
