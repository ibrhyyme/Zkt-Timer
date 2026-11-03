import {
	cameraStopApplies,
	CameraTimerSide,
	cameraWarnings,
	captureToEpoch,
	decideOnCameraStart,
	frozenSeconds,
	MAX_ONSET_AGE_MS,
	meanLuma,
	QUALITY,
} from '../decision';
import { parseCameraTimerManifest } from '../availability';
import { startBlockReason, StartGuardInput } from '../../magnet-start/start_guard';

const NOW = 1_000_000;

function side(over: Partial<CameraTimerSide> = {}): CameraTimerSide {
	return {
		guard: null,
		solving: false,
		inInspection: false,
		dnfTime: false,
		inspectionEnabled: false,
		exceptBld: false,
		inspectionStartedAt: null,
		inspectionDelayMs: 15000,
		now: NOW,
		...over,
	};
}

describe('decideOnCameraStart', () => {
	it('starts the solve from the backdated onset', () => {
		expect(decideOnCameraStart(side(), NOW - 300)).toEqual({ kind: 'startTimer', onset: NOW - 300 });
	});

	it('never starts a second time, and obeys the start guards', () => {
		expect(decideOnCameraStart(side({ solving: true }), NOW - 100)).toEqual({ kind: 'none', reason: 'solving' });
		expect(decideOnCameraStart(side({ guard: 'modal' }), NOW - 100)).toEqual({ kind: 'none', reason: 'modal' });
	});

	it('refuses an onset older than the touch path accepts', () => {
		expect(decideOnCameraStart(side(), NOW - MAX_ONSET_AGE_MS - 1)).toEqual({ kind: 'none', reason: 'stale' });
		// A clock skew that puts the onset in the future starts from now.
		expect(decideOnCameraStart(side(), NOW + 50)).toEqual({ kind: 'startTimer', onset: NOW });
	});

	it('opens inspection first when it is on, except on blind subsets with except-BLD', () => {
		expect(decideOnCameraStart(side({ inspectionEnabled: true }), NOW - 100)).toEqual({ kind: 'startInspection' });
		expect(decideOnCameraStart(side({ inspectionEnabled: true, exceptBld: true }), NOW - 100)).toEqual({
			kind: 'startTimer',
			onset: NOW - 100,
		});
	});

	it('judges +2 by the onset during inspection, and never starts after DNF', () => {
		const insp = { inspectionEnabled: true, inInspection: true, inspectionStartedAt: NOW - 16000 };
		// Lifted at 14.9 s: no penalty even though the event lands after 15 s.
		expect(decideOnCameraStart(side(insp), NOW - 1100)).toEqual({ kind: 'startTimer', onset: NOW - 1100, addTwo: false });
		expect(decideOnCameraStart(side(insp), NOW - 900)).toEqual({ kind: 'startTimer', onset: NOW - 900, addTwo: true });
		expect(decideOnCameraStart(side({ ...insp, dnfTime: true }), NOW - 100)).toEqual({ kind: 'none', reason: 'dnf' });
	});
});

describe('stop and display', () => {
	it('applies the camera stop only to a running solve with a time', () => {
		expect(cameraStopApplies(true, { type: 'stop', t: 1, frame: 1, timeMs: 9876 })).toBe(true);
		expect(cameraStopApplies(false, { type: 'stop', t: 1, frame: 1, timeMs: 9876 })).toBe(false);
		expect(cameraStopApplies(true, { type: 'stop', t: 1, frame: 1 })).toBe(false);
	});

	it('maps capture times onto the wall clock', () => {
		expect(captureToEpoch(1234.4, 1_700_000_000_000.3)).toBe(1_700_000_001_235);
	});

	it('freezes the digits at the pending stop, and only after the start', () => {
		expect(frozenSeconds(NOW + 12340, NOW)).toBeCloseTo(12.34, 5);
		expect(frozenSeconds(null, NOW)).toBeNull();
		expect(frozenSeconds(NOW, null)).toBeNull();
		expect(frozenSeconds(NOW - 5, NOW)).toBeNull();
	});
});

describe('cameraWarnings', () => {
	const good = {
		cameraFps: 60,
		width: 1280,
		height: 720,
		brightness: 120,
		modelMs: 20,
		sinceHandsMs: 100,
		runningMs: 10000,
	};

	it('stays quiet for a good camera and while readings settle', () => {
		expect(cameraWarnings(good)).toEqual([]);
		expect(cameraWarnings({ ...good, cameraFps: 10, brightness: 5, runningMs: QUALITY.settleMs - 1 })).toEqual([]);
	});

	it('names each problem, most important first', () => {
		expect(
			cameraWarnings({ ...good, cameraFps: 15, brightness: 30, height: 360, modelMs: 80, sinceHandsMs: 7000 })
		).toEqual(['low_fps', 'dark', 'low_res', 'slow', 'no_hands']);
	});

	it('counts the hands as missing from the start when none was ever seen', () => {
		expect(cameraWarnings({ ...good, sinceHandsMs: null, runningMs: QUALITY.noHandsMs + 1 })).toEqual(['no_hands']);
		expect(cameraWarnings({ ...good, sinceHandsMs: null, runningMs: QUALITY.noHandsMs - 1 })).toEqual([]);
	});

	it('ignores readings that are not known yet', () => {
		expect(cameraWarnings({ ...good, cameraFps: 0, height: 0, brightness: null, modelMs: 0 })).toEqual([]);
	});
});

describe('meanLuma', () => {
	it('averages RGBA pixels by luma', () => {
		expect(meanLuma([255, 255, 255, 255, 0, 0, 0, 255])).toBeCloseTo(127.5, 5);
		expect(meanLuma([])).toBeNull();
	});
});

describe('parseCameraTimerManifest', () => {
	it('accepts the manifest build-brain writes', () => {
		expect(parseCameraTimerManifest({ v: 1, brain: 'brain-541a7b2b7911.js', mediapipe: '0.10.35', builtAt: 'x' })).toEqual({
			v: 1,
			brain: 'brain-541a7b2b7911.js',
			mediapipe: '0.10.35',
		});
	});

	it('rejects anything the worker URL could not safely be built from', () => {
		for (const bad of [
			null,
			'x',
			{ v: 2, brain: 'brain-abc123.js' },
			{ v: 1 },
			{ v: 1, brain: '../brain-abc123.js' },
			{ v: 1, brain: 'https://evil.example/brain-abc123.js' },
			{ v: 1, brain: 'brain-abc123.mjs' },
			{ v: 1, brain: 'brain-xyz.js' },
		]) {
			expect(parseCameraTimerManifest(bad)).toBeNull();
		}
	});
});

describe('start guard for the camera', () => {
	const base: StartGuardInput = {
		timerType: 'camera',
		owner: 'camera',
		manualEntry: false,
		modalCount: 0,
		inModal: false,
		matchMode: false,
		startEnabled: true,
		timerDisabled: false,
		disabled: false,
		editScramble: false,
		validCubeType: true,
		visible: true,
		testMode: false,
	};

	it('lets only the camera start the Kamera Timer', () => {
		expect(startBlockReason(base)).toBeNull();
		expect(startBlockReason({ ...base, timerType: 'keyboard' })).toBe('timer_type');
		// The magnet keeps its default owner.
		expect(startBlockReason({ ...base, owner: undefined })).toBe('timer_type');
		expect(startBlockReason({ ...base, timerType: 'magnet', owner: undefined })).toBeNull();
	});

	it('blocks a start behind a modal or while hidden', () => {
		expect(startBlockReason({ ...base, modalCount: 1 })).toBe('modal');
		expect(startBlockReason({ ...base, visible: false })).toBe('hidden');
	});
});
