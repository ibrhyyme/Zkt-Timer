import { attachGyroRecorder, gyroFieldsForSave } from '../gyro_recorder';
import { parseSmartTurns } from '../../../../shared/smart_cube/parse_turns';
import { decodeGyroSamples } from '../../../../shared/smart_cube/gyro_codec';

/** A fake manager whose gyro and move streams the test drives by hand. */
function fakeSource() {
	let gyro: (e: any) => void = () => {};
	let moves: (b: any) => void = () => {};
	return {
		source: {
			subscribeGyro: (l: (e: any) => void) => ((gyro = l), () => {}),
			subscribeMoves: (l: (b: any) => void) => ((moves = l), () => {}),
		},
		gyro: (e: any) => gyro(e),
		move: (turn: string) => moves({ moves: [{ turn }] }),
	};
}

/** Device-frame quaternion of a rotation about the R axis (frame x = device x). */
const aboutR = (deg: number) => {
	const h = (deg * Math.PI) / 360;
	return { type: 'GYRO', quaternion: { x: Math.sin(h), y: 0, z: 0, w: Math.cos(h) } };
};

describe('gyro recorder', () => {
	let now = 0;
	let detach: () => void;
	beforeEach(() => {
		now = 1_000_000;
		jest.spyOn(Date, 'now').mockImplementation(() => now);
	});
	afterEach(() => {
		detach?.();
		jest.restoreAllMocks();
	});

	it('moves the rotations onto the turns\' clock and their time base', () => {
		const f = fakeSource();
		detach = attachGyroRecorder(f.source);
		// The turns' fitted clock runs 5 s behind the JS clock the readings are stamped with.
		const SKEW = 5000;
		const turns: { turn: string; completedAt: number }[] = [];
		const turnAt = (turn: string) => {
			f.move(turn);
			turns.push({ turn, completedAt: now - SKEW });
		};

		for (let i = 0; i < 40; i++) {
			// Still until 1.5 s, a clockwise quarter about R (x) by 1.8 s, still after.
			const k = Math.min(1, Math.max(0, (i * 100 - 1500) / 300));
			f.gyro(aboutR(-90 * k));
			if (i === 5) turnAt('U');
			if (i === 30) turnAt('R');
			now += 100;
		}

		const saved = gyroFieldsForSave(turns, turns[0].completedAt);
		const [rotation] = parseSmartTurns(saved.smart_rotations);
		expect(rotation.turn).toBe('x');
		// U arrives at 0.5 s, the cube crosses into x at 1.7 s: 1.2 s after the first turn.
		expect(rotation.completedAt).toBeGreaterThan(1000);
		expect(rotation.completedAt).toBeLessThan(1400);

		// The readings travel on the same timeline: from the lead-in (the first reading, 0.5 s
		// before U) to just after the last turn (R at 3.0 s), the rotation between.
		const gyro = decodeGyroSamples(saved.smart_gyro);
		expect(gyro[0].t).toBe(-500);
		expect(gyro[gyro.length - 1].t).toBeGreaterThanOrEqual(2500);
		expect(gyro[gyro.length - 1].t).toBeLessThanOrEqual(2800);
		const turned = gyro.find((s) => s.t >= 1300)!;
		expect(Math.abs(turned.x)).toBeGreaterThan(0.6);
	});

	it('has nothing to save without gyro data', () => {
		const f = fakeSource();
		detach = attachGyroRecorder(f.source);
		f.move('R');
		expect(gyroFieldsForSave([{ turn: 'R', completedAt: now }], now)).toEqual({ smart_rotations: null, smart_gyro: null });
	});
});
