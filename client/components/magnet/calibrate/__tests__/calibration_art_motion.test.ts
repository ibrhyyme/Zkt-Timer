// The calibration page's step drawings: the loops are seamless, the cube is never drawn over a
// phone that should hide it, nothing leaves the frame, and the still frames tell each step.
import {
	ArtScene,
	CUBE,
	cubeAt,
	fieldBar,
	OY,
	PHONE,
	REST_SPOT,
	sceneKeyframes,
	sceneMs,
	sceneStyles,
	smoothPath,
	stillStyles,
	SWEEP_ROUTE,
	TY,
	TZ,
	VIEW,
} from '../calibration_art_motion';

const SCENES: ArtScene[] = ['steady', 'sweep', 'rest', 'away'];

function times(scene: ArtScene, step = 20): number[] {
	const out: number[] = [];
	for (let t = 0; t <= sceneMs(scene); t += step) out.push(t);
	return out;
}

describe('calibration art motion', () => {
	it.each(SCENES)('%s: the cube is drawn after the phone, so it is never behind it where they meet', (scene) => {
		for (const t of times(scene)) {
			const p = cubeAt(scene, t);
			const left = p.x - CUBE / 2;
			const right = p.x + CUBE / 2;
			const far = p.y - CUBE / 2;
			const near = p.y + CUBE / 2;
			const overX = right > PHONE.x && left < PHONE.x + PHONE.w;
			const overY = near > PHONE.y && far < PHONE.y + PHONE.l;
			// Over the phone: held above it.
			if (overX && overY) expect([scene, t, p.z >= PHONE.t]).toEqual([scene, t, true]);
			// Beyond its top end: the cube's bottom edge stays above the phone's far edge on screen.
			if (overX && near <= PHONE.y) {
				const cubeBottom = OY + near * TY - p.z * TZ;
				const phoneTop = OY + PHONE.y * TY - PHONE.t * TZ;
				expect([scene, t, cubeBottom <= phoneTop]).toEqual([scene, t, true]);
			}
		}
	});

	it.each(SCENES)('%s: the cube stays inside the frame', (scene) => {
		for (const t of times(scene)) {
			const p = cubeAt(scene, t);
			expect(p.x - CUBE / 2).toBeGreaterThanOrEqual(0);
			expect(p.x + CUBE / 2).toBeLessThanOrEqual(VIEW.w);
			expect(OY + (p.y - CUBE / 2) * TY - (p.z + CUBE) * TZ).toBeGreaterThanOrEqual(0);
			expect(OY + (p.y + CUBE / 2) * TY).toBeLessThanOrEqual(VIEW.h);
		}
	});

	it('the sweep loop is seamless and reaches both sides and the top of the phone', () => {
		expect(sceneStyles('sweep', sceneMs('sweep'))).toEqual(sceneStyles('sweep', 0));
		const xs = times('sweep').map((t) => cubeAt('sweep', t));
		expect(xs.some((p) => p.x + CUBE / 2 < PHONE.x)).toBe(true);
		expect(xs.some((p) => p.x - CUBE / 2 > PHONE.x + PHONE.w)).toBe(true);
		expect(xs.some((p) => p.y + CUBE / 2 < PHONE.y && Math.abs(p.x - (PHONE.x + PHONE.w / 2)) < 4)).toBe(true);
	});

	it.each(['steady', 'rest', 'away'] as ArtScene[])('%s: the moving things are hidden where the loop jumps back', (scene) => {
		expect(sceneStyles(scene, 0).actors?.opacity).toBe(0);
		expect(sceneStyles(scene, sceneMs(scene)).actors?.opacity).toBe(0);
	});

	it('the bar falls off with distance like a magnet; the resting cube fills about 80 %', () => {
		expect(fieldBar({ ...REST_SPOT, z: 0 })).toBeCloseTo(0.8);
		const near = fieldBar({ ...REST_SPOT, z: 10 });
		const far = fieldBar({ x: 20, y: 150, z: 0 });
		expect(near).toBeLessThan(0.8);
		expect(far).toBeLessThan(0.05);
		for (const scene of SCENES) {
			for (const t of times(scene, 100)) {
				const scale = Number(/scaleX\(([\d.]+)\)/.exec(sceneStyles(scene, t).bar!.transform!)![1]);
				expect(scale).toBeGreaterThanOrEqual(0);
				expect(scale).toBeLessThanOrEqual(1);
			}
		}
	});

	it('the still frames tell each step on their own', () => {
		// Step 1: the cube and the earbud case are away, the phone shows the check.
		const steady = stillStyles('steady');
		expect(steady.check?.opacity).toBe(1);
		expect(steady.case).toBeDefined();
		expect(cubeAt('steady', 4600).x - CUBE / 2).toBeGreaterThan(PHONE.x + PHONE.w);
		// Step 3: the cube rests on its spot and the reading is green.
		expect(stillStyles('rest').ready?.opacity).toBe(1);
		expect(cubeAt('rest', 4000)).toEqual({ ...REST_SPOT, z: 0 });
		// The away check: the cube is gone, the reading is back to the baseline.
		const away = stillStyles('away');
		expect(away.ready?.opacity).toBe(0);
		expect(away.check?.opacity).toBe(1);
		// Only step 1 has the earbud case.
		expect(stillStyles('sweep').case).toBeUndefined();
	});

	it('keyframes run from 0 to 1 with every part on the same samples', () => {
		for (const scene of SCENES) {
			const frames = sceneKeyframes(scene);
			const lengths = new Set(Object.values(frames).map((f) => f!.length));
			expect(lengths.size).toBe(1);
			for (const list of Object.values(frames)) {
				expect(list![0].offset).toBe(0);
				expect(list![list!.length - 1].offset).toBe(1);
				for (let i = 1; i < list!.length; i++) expect(list![i].offset).toBeGreaterThan(list![i - 1].offset);
			}
		}
	});

	it('the sweep route runs through its stops', () => {
		const d = smoothPath(SWEEP_ROUTE);
		const first = SWEEP_ROUTE[0];
		const last = SWEEP_ROUTE[SWEEP_ROUTE.length - 1];
		expect(d.startsWith(`M${first.x} ${first.y}`)).toBe(true);
		expect(d.endsWith(`${last.x} ${last.y}`)).toBe(true);
		expect(d.match(/C/g)).toHaveLength(SWEEP_ROUTE.length - 1);
	});
});
