import * as THREE from 'three';
import { buildGyroTrack, sampleGyroTrack } from '../gyro_track';
import { bestHolding, framesAlongTokens, reconstructWithRotations } from '../../../../../../shared/smart_cube/rotation_reconstruction';
import { detectCubeRotations, GyroSample } from '../../../../../../shared/smart_cube/gyro_rotations';
import { decodeGyroSamples } from '../../../../../../shared/smart_cube/gyro_codec';
import { parseSmartTurns } from '../../../../../../shared/smart_cube/parse_turns';
import { frameToQuat } from '../../../../../util/cube_rotation_quat';
import zperm from '../../../../../../shared/smart_cube/__tests__/fixtures/gani4_zperm_solve.json';

const deg = (a: THREE.Quaternion, b: THREE.Quaternion) => (a.angleTo(b) * 180) / Math.PI;
const axisAngle = (x: number, y: number, z: number, d: number) =>
	new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(x, y, z).normalize(), (d * Math.PI) / 180);

/** A device-frame reading for a scene-frame orientation (inverse of the scene mapping). */
function reading(t: number, scene: THREE.Quaternion): GyroSample {
	return { t, x: scene.x, y: -scene.z, z: scene.y, w: scene.w };
}

const still = () => new THREE.Quaternion();

/**
 * A cube turned by y (clockwise from the top: -90 about +Y) between 0.9 and 1.1 s, in a gyro
 * world frame that has nothing to do with the screen. `hand(t)` is what the hand adds on top
 * (a shake, a look at the last layer); `extra` are rotations the reconstruction has besides the y.
 */
function scenario(startAt = -1500, hand: (t: number) => THREE.Quaternion = still, extra: { turn: string; completedAt: number }[] = []) {
	const tokens = reconstructWithRotations(
		[{ turn: 'R', completedAt: 0 }, { turn: 'R', completedAt: 4000 }],
		[{ turn: 'y', completedAt: 1000 }, ...extra]
	);
	const frames = framesAlongTokens(tokens);
	const world = axisAngle(0.3, 1, -0.4, 73);
	const samples: GyroSample[] = [];
	for (let t = startAt; t <= 4500; t += 90) {
		const k = Math.min(1, Math.max(0, (t - 900) / 200));
		const held = hand(t).multiply(axisAngle(0, 1, 0, -90 * k));
		samples.push(reading(t, world.clone().multiply(held)));
	}
	return { tokens, frames, samples };
}

/** The cube tilted 60 degrees about +X from 3.0 to 3.3 s and put back: a look at the last layer. */
const look = (t: number) => (t >= 3000 && t < 3300 ? axisAngle(1, 0, 0, 60) : new THREE.Quaternion());

const SQUARE_BEFORE = new THREE.Quaternion();
const SQUARE_AFTER = axisAngle(0, 1, 0, -90);

describe('buildGyroTrack', () => {
	it('finds where the solver faced, whatever frame the gyro reports in', () => {
		const { tokens, frames, samples } = scenario();
		const track = buildGyroTrack(samples, 0, tokens.map((k) => k.t), frames)!;
		expect(deg(sampleGyroTrack(track, 300), SQUARE_BEFORE)).toBeLessThan(3);
		expect(deg(sampleGyroTrack(track, 2500), SQUARE_AFTER)).toBeLessThan(3);
	});

	it('plays the rotation itself as it happened', () => {
		const { tokens, frames, samples } = scenario();
		const track = buildGyroTrack(samples, 0, tokens.map((k) => k.t), frames)!;
		// Halfway through the y the cube is halfway, not snapped to either side.
		const mid = sampleGyroTrack(track, 1000);
		expect(deg(mid, SQUARE_BEFORE)).toBeGreaterThan(25);
		expect(deg(mid, SQUARE_AFTER)).toBeGreaterThan(25);
	});

	it('shows a shake of the hand as it was', () => {
		const shake = (t: number) => (t >= 3000 && t < 3150 ? axisAngle(0, 0, 1, 25) : new THREE.Quaternion());
		const { tokens, frames, samples } = scenario(-1500, shake);
		const track = buildGyroTrack(samples, 0, tokens.map((k) => k.t), frames)!;
		expect(deg(sampleGyroTrack(track, 3050), SQUARE_AFTER)).toBeGreaterThan(20);
	});

	it('shows a look at the last layer as the tilt it was, even when the reconstruction took it for a rotation', () => {
		// The detector read the look as an x, and its return as nothing: the frames stay a quarter off.
		const { tokens, frames, samples } = scenario(-1500, look, [{ turn: 'x', completedAt: 3100 }]);
		const track = buildGyroTrack(samples, 0, tokens.map((k) => k.t), frames)!;
		const atTop = deg(sampleGyroTrack(track, 3150), SQUARE_AFTER);
		expect(atTop).toBeGreaterThan(55);
		expect(atTop).toBeLessThan(65);
		expect(deg(sampleGyroTrack(track, 3600), SQUARE_AFTER)).toBeLessThan(3);
	});

	it('is not thrown off by a recording that starts mid-rotation', () => {
		const { tokens, frames, samples } = scenario();
		// Replace the lead-in with readings 40 degrees off, as if the cube were still turning.
		const swung = samples.map((s) => (s.t < 0 ? reading(s.t, new THREE.Quaternion(s.x, s.z, -s.y, s.w).multiply(axisAngle(0, 0, 1, 40))) : s));
		const track = buildGyroTrack(swung, 0, tokens.map((k) => k.t), frames)!;
		expect(deg(sampleGyroTrack(track, 600), SQUARE_BEFORE)).toBeLessThan(5);
	});

	it('anchors a real GAN i4 solve whose first turn came mid-motion', () => {
		// Seeded from the first turn's reading, this solve's replay sat 114 degrees off throughout.
		// What is left is the hand's own tilt and wobble, shown as it was: a median 23 degrees here.
		const turns = parseSmartTurns(zperm.smart_turns);
		const samples = decodeGyroSamples(zperm.smart_gyro);
		const rotations = detectCubeRotations(samples.filter((s) => s.t <= turns[turns.length - 1].completedAt), turns);
		const holding = bestHolding(turns, rotations, 'z2');
		const tokens = reconstructWithRotations(turns, rotations, holding);
		const frames = framesAlongTokens(tokens, holding);
		const t0 = turns[0].completedAt;
		const track = buildGyroTrack(samples, t0, tokens.map((k) => k.t - t0), frames)!;
		let k = 0;
		const off = track.times.map((t, i) => {
			while (k < tokens.length && tokens[k].t - t0 <= t) k++;
			return deg(track.quats[i], frameToQuat(frames[k]));
		}).sort((a, b) => a - b);
		expect(off[Math.floor(off.length / 2)]).toBeLessThan(30);
	});

	it('is null without a stream', () => {
		const { tokens, frames } = scenario();
		expect(buildGyroTrack([], 0, tokens.map((k) => k.t), frames)).toBeNull();
	});
});

describe('sampleGyroTrack', () => {
	const track = {
		times: [0, 100],
		quats: [new THREE.Quaternion(), axisAngle(0, 1, 0, 90)],
	};

	it('interpolates between readings and holds at the ends', () => {
		expect(deg(sampleGyroTrack(track, 50), axisAngle(0, 1, 0, 45))).toBeLessThan(0.01);
		expect(deg(sampleGyroTrack(track, -20), track.quats[0])).toBeLessThan(0.01);
		expect(deg(sampleGyroTrack(track, 500), track.quats[1])).toBeLessThan(0.01);
	});
});
