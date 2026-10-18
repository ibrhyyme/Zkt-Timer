import type { MagnetCubeProfile, MagnetProfileStatus } from '../../../../../util/magnet-start/cube_profile';
import { liveBarScaleUt } from '../../../../../util/magnet-start/cube_profile';
import {
	liveBarFraction,
	liveBarShowsValue,
	liveBarTarget,
	magnetGuideView,
	MagnetGuideInput,
	smoothLiveBar,
} from '../guide_state';

function profile(status: MagnetProfileStatus, extra: Partial<MagnetCubeProfile> = {}): MagnetCubeProfile {
	return {
		status,
		puzzle: '333',
		cubeId: status === 'ready' || status === 'no_calibration' ? 'c1' : null,
		cubeName: 'GAN 12',
		deviceModel: 'samsung SM-F956B',
		nearMin: status === 'ready' ? 150 : null,
		farMax: status === 'ready' ? 80 : null,
		quality: status === 'ready' ? 'ok' : null,
		restUt: status === 'ready' ? 480 : null,
		peakUt: status === 'ready' ? 2300 : null,
		recalibrate: false,
		pending: false,
		...extra,
	};
}

function input(extra: Partial<MagnetGuideInput> = {}): MagnetGuideInput {
	return {
		profile: profile('ready'),
		active: true,
		stage: 'far',
		moving: false,
		introDone: false,
		holdHintSeen: false,
		canAct: true,
		...extra,
	};
}

describe('magnetGuideView', () => {
	it('says nothing while the cube list or the model key is loading, or without a profile', () => {
		expect(magnetGuideView(input({ profile: null }))).toEqual({ card: null, line: null, moving: false, holdHint: false });
		expect(magnetGuideView(input({ profile: profile('loading') })).card).toBeNull();
		expect(magnetGuideView(input({ profile: profile('loading') })).line).toBeNull();
	});

	it.each(['no_cubes', 'no_puzzle_cube', 'no_main', 'no_calibration'] as MagnetProfileStatus[])(
		'shows the %s card, whatever the stream says',
		(status) => {
			const view = magnetGuideView(input({ profile: profile(status), active: false, stage: 'off', moving: true }));
			expect(view.card).toBe(status);
			expect(view.line).toBeNull();
			expect(view.moving).toBe(false);
		}
	);

	it('never offers to skip calibration, 3x3 included (owner decision)', () => {
		const view = magnetGuideView(input({ profile: profile('no_calibration', { puzzle: '333' }) }));
		expect(view.card).toBe('no_calibration');
		expect(Object.keys(view)).not.toContain('skip');
	});

	it('hides cards during inspection, where no button can be reached', () => {
		expect(magnetGuideView(input({ profile: profile('no_main'), canAct: false })).card).toBeNull();
	});

	it('says the puzzle has no Magnet Timer when the bucket has no physical puzzle', () => {
		expect(magnetGuideView(input({ profile: profile('no_puzzle') })).line).toBe('magnet_guide.no_puzzle');
	});

	it('says nothing while the stream of a calibrated cube is starting', () => {
		expect(magnetGuideView(input({ active: false, stage: 'off' })).line).toBeNull();
		expect(magnetGuideView(input({ stage: 'off' })).line).toBeNull();
	});

	it('puts a slow sensor above everything the stream says', () => {
		const view = magnetGuideView(input({ stage: 'unsupported', moving: true }));
		expect(view.line).toBe('time_display.magnet_unsupported');
		expect(view.moving).toBe(false);
	});

	it('asks to put the phone down before anything about the cube (#7 over #8 to #10)', () => {
		for (const stage of ['unknown', 'far', 'closer'] as const) {
			const view = magnetGuideView(input({ stage, moving: true }));
			expect(view.line).toBe('magnet_guide.moving');
			expect(view.moving).toBe(true);
			expect(view.card).toBeNull();
		}
	});

	it('turns an unknown baseline into the re-learn card, and into a line during inspection', () => {
		expect(magnetGuideView(input({ stage: 'unknown' })).card).toBe('relearn');
		const inspecting = magnetGuideView(input({ stage: 'unknown', canAct: false }));
		expect(inspecting.card).toBeNull();
		expect(inspecting.line).toBe('time_display.magnet_unknown');
	});

	it('speaks the routine lines only until the first lift start', () => {
		expect(magnetGuideView(input({ stage: 'far' })).line).toBe('time_display.magnet_far');
		expect(magnetGuideView(input({ stage: 'far', introDone: true, holdHintSeen: true })).line).toBeNull();
		expect(magnetGuideView(input({ stage: 'ready_solve' })).line).toBe('time_display.magnet_ready_solve');
		expect(magnetGuideView(input({ stage: 'ready_solve', introDone: true, holdHintSeen: true })).line).toBeNull();
		expect(magnetGuideView(input({ stage: 'ready_inspection', introDone: true, holdHintSeen: true })).line).toBeNull();
	});

	it('keeps the lines the user has to act on after the first lift start', () => {
		const done = { introDone: true, holdHintSeen: true };
		expect(magnetGuideView(input({ stage: 'closer', ...done })).line).toBe('time_display.magnet_closer');
		expect(magnetGuideView(input({ stage: 'not_armed', ...done })).line).toBe('time_display.magnet_not_armed');
		expect(magnetGuideView(input({ stage: 'inspection_waiting', ...done, canAct: false })).line).toBe(
			'time_display.magnet_inspection_waiting'
		);
	});

	it('lets colour alone speak while the cube settles and while it rests through a stop', () => {
		expect(magnetGuideView(input({ stage: 'dwelling' })).line).toBeNull();
		expect(magnetGuideView(input({ stage: 'resting' })).line).toBeNull();
	});

	it('teaches hold to stop once, after the first Magnet solve, outside inspection', () => {
		expect(magnetGuideView(input({ stage: 'resting', introDone: true })).holdHint).toBe(true);
		expect(magnetGuideView(input({ stage: 'resting', introDone: false })).holdHint).toBe(false);
		expect(magnetGuideView(input({ stage: 'resting', introDone: true, holdHintSeen: true })).holdHint).toBe(false);
		expect(magnetGuideView(input({ stage: 'resting', introDone: true, canAct: false })).holdHint).toBe(false);
	});
});

describe('live bar', () => {
	it('draws a value only for a calibrated cube with a known baseline and a still phone', () => {
		const base = { profile: profile('ready'), active: true, stage: 'far' as const, moving: false };
		expect(liveBarShowsValue(base)).toBe(true);
		expect(liveBarShowsValue({ ...base, stage: 'ready_solve' })).toBe(true);
		expect(liveBarShowsValue({ ...base, stage: 'unknown' })).toBe(false);
		expect(liveBarShowsValue({ ...base, stage: 'unsupported' })).toBe(false);
		expect(liveBarShowsValue({ ...base, stage: 'off' })).toBe(false);
		expect(liveBarShowsValue({ ...base, moving: true })).toBe(false);
		expect(liveBarShowsValue({ ...base, active: false })).toBe(false);
		expect(liveBarShowsValue({ ...base, profile: profile('no_calibration') })).toBe(false);
		expect(liveBarShowsValue({ ...base, profile: null })).toBe(false);
	});

	it('fills the cube rest value to about 80 % and marks the near threshold', () => {
		const p = profile('ready', { nearMin: 150, restUt: 480 });
		const scale = liveBarScaleUt(p) as number;
		expect(scale).toBe(600);
		expect(liveBarFraction(480, scale)).toBeCloseTo(0.8);
		expect(liveBarTarget(150, scale)).toBeCloseTo(0.25);
	});

	it('clamps the fill and survives missing readings', () => {
		expect(liveBarFraction(5000, 600)).toBe(1);
		expect(liveBarFraction(-3, 600)).toBe(0);
		expect(liveBarFraction(null, 600)).toBe(0);
		expect(liveBarFraction(NaN, 600)).toBe(0);
		expect(liveBarFraction(100, 0)).toBe(0);
		expect(liveBarTarget(null, 600)).toBeNull();
		expect(liveBarTarget(150, null)).toBeNull();
	});

	it('smooths only the drawing, starting from the first reading', () => {
		expect(smoothLiveBar(null, 0.5)).toBe(0.5);
		expect(smoothLiveBar(0.5, 1)).toBeCloseTo(0.7);
		expect(smoothLiveBar(0.7, 0.7)).toBeCloseTo(0.7);
	});
});
