import * as THREE from 'three';
import { frameToQuat } from '../../../../util/cube_rotation_quat';
import type { Frame } from '../../../../../shared/smart_cube/rotation_reconstruction';
import type { GyroSample } from '../../../../../shared/smart_cube/gyro_rotations';

/**
 * The cube's real orientation through a solve, from its recorded gyro stream, as scene
 * quaternions on the replay's timeline. The replay turns its scene by this instead of the
 * reconstruction's square frames, so the cube on screen tilts and turns the way it did in
 * the solver's hands.
 *
 * The gyro reports orientation in a world frame that starts wherever the cube was when it
 * connected; nothing says where "facing the solver" is (acubemy asks for a calibration step
 * for that). It is anchored here instead: one fixed rotation that puts the stream, on
 * average, where the reconstruction says the cube was held. Averaged over the solve rather
 * than taken from one moment, so a start in mid-rotation or a hand that holds the cube at
 * 30 degrees does not tilt the whole replay. Moments that disagree with the reconstruction by
 * more than INLIER_DEG (mid-rotation, a missed rotation) are left out of the average.
 *
 * Measured on two acubemy-recorded GAN i4 solves before building this: the sensor lags fast
 * slices by a few hundred ms but does not lose them (four M2s of an H perm end 14 degrees
 * from where they started, hand movement included), so nothing here repairs the stream.
 *
 * What is taken out is its slow part. A hand that feels it holds the cube straight holds it
 * 20-30 degrees off, and the gyro drifts; shown raw, the cube sat at an angle the whole replay
 * and the owner saw it "held crooked" when it was not. So the offset from the held frame is
 * smoothed over about BIAS_SIGMA_MS either side and removed: a steady hold shows square, and
 * what moves faster than that (a rotation, a wobble, a regrip) shows as it happened. Moments
 * mid-rotation (offset past INLIER_DEG) are left out of the smoothing, so a rotation plays in
 * full and the correction bridges from the hold before it to the hold after it. What is left
 * below STRAIGHT_DEG (shake, jitter) is not shown either (straightened): the cube on screen
 * stands square and moves only when the solver's really did.
 */

export interface GyroTrack {
	/** Replay time of each reading, ms on the same timeline as the tokens' relativeMs. */
	times: number[];
	/** Scene quaternion of each reading, anchored. */
	quats: THREE.Quaternion[];
}

const INLIER_DEG = 35;
const ANCHOR_PASSES = 4;
const MIN_INLIERS = 3;
/** How many readings are tried as the anchor's starting point. */
const SEED_COUNT = 80;
/** Spread of the smoothing that finds a reading's slow offset (Gaussian, ms). */
const BIAS_SIGMA_MS = 400;
/** Readings this far from a reading still count toward its offset; past that the weight is nil. */
const BIAS_REACH_MS = 3 * BIAS_SIGMA_MS;
/** Deviation from the held frame shown as square below this, as it is past MOTION_DEG. */
const STRAIGHT_DEG = 20;
const MOTION_DEG = 45;

/** A device-frame reading in the scene's frame (+X R, +Y U, +Z F), as SmartCubeView maps it. */
function toScene(s: GyroSample): THREE.Quaternion {
	return new THREE.Quaternion(s.x, s.z, -s.y, s.w).normalize();
}

const angleDeg = (a: THREE.Quaternion, b: THREE.Quaternion) => (a.angleTo(b) * 180) / Math.PI;

/** Mean of quaternions that sit close together, each flipped onto `ref`'s hemisphere. */
function meanNear(quats: THREE.Quaternion[], ref: THREE.Quaternion): THREE.Quaternion {
	const sum = new THREE.Quaternion(0, 0, 0, 0);
	for (const q of quats) {
		const s = q.dot(ref) < 0 ? -1 : 1;
		sum.set(sum.x + s * q.x, sum.y + s * q.y, sum.z + s * q.z, sum.w + s * q.w);
	}
	return sum.normalize();
}

/**
 * `samples`: the decoded stream (times from the solve's time base). `t0`: that base's time of
 * the first turn, which the replay's clock counts from. `tokenTimes[i]` and `frames` (one
 * longer): the reconstruction, frames[i] being how the cube was held with i tokens played.
 */
export function buildGyroTrack(samples: GyroSample[], t0: number, tokenTimes: number[], frames: Frame[]): GyroTrack | null {
	if (samples.length < 2 || frames.length === 0) return null;

	const times = samples.map((s) => s.t - t0);
	const raw = samples.map(toScene);
	const frameQuats = frames.map((f) => frameToQuat(f));
	let k = 0;
	const lattice = times.map((t) => {
		while (k < tokenTimes.length && tokenTimes[k] <= t) k++;
		return frameQuats[k];
	});
	// The anchor each reading would give on its own: scene = anchor * reading.
	const candidates = raw.map((q, i) => lattice[i].clone().multiply(q.clone().invert()));

	// Start from the candidate most readings agree with, not from one chosen moment: seeded
	// from the first turn's reading, a real GAN i4 solve began mid-motion, found no reading
	// near it, never refined, and showed the whole replay 114 degrees off.
	const inliersOf = (a: THREE.Quaternion) =>
		raw.reduce((n, q, i) => n + (angleDeg(a.clone().multiply(q), lattice[i]) < INLIER_DEG ? 1 : 0), 0);
	const stride = Math.max(1, Math.floor(candidates.length / SEED_COUNT));
	let anchor = candidates[0].clone();
	let best = -1;
	for (let i = 0; i < candidates.length; i += stride) {
		const n = inliersOf(candidates[i]);
		if (n > best) {
			best = n;
			anchor = candidates[i].clone();
		}
	}
	for (let pass = 0; pass < ANCHOR_PASSES; pass++) {
		const inliers = candidates.filter((c, i) => angleDeg(anchor.clone().multiply(raw[i]), lattice[i]) < INLIER_DEG);
		if (inliers.length < MIN_INLIERS) break;
		anchor = meanNear(inliers, anchor);
	}

	const anchored = raw.map((q) => anchor.clone().multiply(q));
	return { times, quats: straightened(withoutSlowOffset(times, anchored, lattice), lattice) };
}

/**
 * Small deviations from the held frame shown square, large ones as they are. With the slow
 * offset gone, what is left on a real solve is mostly quick shake: sensor jitter from the
 * turns and the hands (median 168 deg/s on a GAN i4 solve), a median 12-15 degrees off square
 * at any smoothing tried. The owner read it as the cube held crooked. Below STRAIGHT_DEG the
 * frame is shown; past MOTION_DEG (a rotation, a regrip) the reading; between, a smooth blend,
 * so a rotation still starts and ends without a jump.
 */
function straightened(quats: THREE.Quaternion[], lattice: THREE.Quaternion[]): THREE.Quaternion[] {
	return quats.map((q, i) => {
		const d = angleDeg(q, lattice[i]);
		const k = Math.min(1, Math.max(0, (d - STRAIGHT_DEG) / (MOTION_DEG - STRAIGHT_DEG)));
		const w = k * k * (3 - 2 * k);
		return lattice[i].clone().slerp(q, w);
	});
}

/**
 * Each reading with its slow offset from the held frame taken out (see the header). The offset
 * is world-side (scene = offset * held), the way a tilting hand or a drifting gyro adds it.
 */
function withoutSlowOffset(times: number[], quats: THREE.Quaternion[], lattice: THREE.Quaternion[]): THREE.Quaternion[] {
	const offsets = quats.map((q, i) => q.clone().multiply(lattice[i].clone().invert()));
	const settled = offsets.map((e) => angleDeg(e, IDENTITY) < INLIER_DEG);
	let previous = new THREE.Quaternion();
	return quats.map((q, i) => {
		const sum = new THREE.Quaternion(0, 0, 0, 0);
		let weight = 0;
		for (let j = 0; j < quats.length; j++) {
			const dt = times[j] - times[i];
			if (!settled[j] || Math.abs(dt) > BIAS_REACH_MS) continue;
			const w = Math.exp(-((dt / BIAS_SIGMA_MS) ** 2));
			const e = offsets[j];
			const s = e.dot(previous) < 0 ? -w : w;
			sum.set(sum.x + s * e.x, sum.y + s * e.y, sum.z + s * e.z, sum.w + s * e.w);
			weight += w;
		}
		// No hold anywhere near (a long rotation, a stream of misses): keep the last offset.
		if (weight > 1e-3) previous = sum.normalize();
		return previous.clone().invert().multiply(q);
	});
}

const IDENTITY = new THREE.Quaternion();

/** The track's orientation at replay time `t`, interpolated between the readings around it. */
export function sampleGyroTrack(track: GyroTrack, t: number): THREE.Quaternion {
	const { times, quats } = track;
	if (t <= times[0]) return quats[0].clone();
	if (t >= times[times.length - 1]) return quats[quats.length - 1].clone();
	let lo = 0;
	let hi = times.length - 1;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (times[mid] <= t) lo = mid;
		else hi = mid;
	}
	const span = times[hi] - times[lo];
	return quats[lo].clone().slerp(quats[hi], span > 0 ? (t - times[lo]) / span : 0);
}
