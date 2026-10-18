import { useEffect, useMemo, useRef, useState } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { useCubes } from '../../lib/cubes/store';
import { saveCubeCalibrationLocal } from '../../lib/cubes/sync';
import { getSetting, getSettings } from '../../db/settings/query';
import { getStore } from '../../components/store';
import { getCubeTypeInfoById } from '../cubes/util';
import { isAppVisible } from '../app-visibility';
import { hapticImpact } from '../native-plugins';
import { ITimerContext } from '../../components/timer/Timer';
import { setTimerParams } from '../../components/timer/helpers/params';
import { START_TIMEOUT, stopTimer } from '../../components/timer/helpers/timers';
import { getTimerStore } from '../store/getTimer';
import { getInspectionStartedAt, startInspection, startTimer } from '../../components/timer/helpers/events';
import { HAPTIC_MUTE_MS, MIN_DWELL_MS } from './config';
import { computeReadiness, decideOnLift, dwellMsFor, MagnetAction, TimerSide } from './controller';
import { resolveMagnetProfile, sameMagnetProfile } from './cube_profile';
import { magnetDebugLog } from './debug_log';
import { fallbackCalibrationCopies, magnetDeviceIdentity, MagnetDeviceIdentity, storedFallbackModel } from './device_model';
import { usePrefetchMagnetProbe } from './availability';
import { magnetPlatform } from './plugin';
import { magnetService, ServiceBatch } from './service';
import { markMagnetIntroDone } from './settings';
import { startBlockReason } from './start_guard';
import { getMagnetProfile, setMagnetStatus } from './status_store';
import { useMagnetTimerOwnsInput } from './useMagnetTimer';
import { magnetTelemetry } from './telemetry';
import { markMagnetAction, shouldCancelHoldOnPlacement } from './touch_guard';

const BLIND_SUBSET = /(ni|bld)$/;

function readTimerSide(ctx: ITimerContext, testMode: boolean): TimerSide {
	// Read at event time, never from the render closure: a Capacitor callback can land
	// between a store update and the re-render that would refresh a closure.
	const state = getStore()?.getState() || ({} as any);
	const timer = state.timer || {};
	const modals = state.general?.modals || [];
	const settings = getSettings();

	const guard = startBlockReason({
		timerType: settings.timer_type,
		manualEntry: !!settings.manual_entry,
		modalCount: modals.length,
		inModal: !!ctx.inModal,
		matchMode: !!ctx.matchMode,
		startEnabled: !!timer.startEnabled,
		timerDisabled: !!timer.timerDisabled,
		disabled: !!ctx.disabled || !!timer.disabled,
		editScramble: !!timer.editScramble,
		validCubeType: !!getCubeTypeInfoById(ctx.cubeType),
		visible: isAppVisible(),
		testMode,
	});

	return {
		guard,
		inspectionEnabled: !!settings.inspection,
		inInspection: !!timer.inInspection,
		dnfTime: !!timer.dnfTime,
		solving: !!timer.timeStartedAt,
		touchPriming: !!timer.spaceTimerStarted,
	};
}

function runAction(action: MagnetAction, ctx: ITimerContext): void {
	if (action.kind === 'none') return;
	// The callback comes from Capacitor, outside React 17's own batching: without this each
	// store write below would re-render the timer on its own.
	// Applied now, not at the onset: the brush the touch guard protects against follows the
	// start the user sees.
	markMagnetAction(Date.now());
	unstable_batchedUpdates(() => {
		setMagnetStatus({ green: false, orange: false });
		if (action.kind === 'startInspection') {
			startInspection(ctx);
			return;
		}
		setTimerParams({ canStart: false, spaceTimerStarted: 0 });
		startTimer(action.onset);
		if (action.addTwo !== undefined) {
			// startTimer stopped the inspection interval, so nothing overwrites this before save.
			setTimerParams({ addTwoToSolve: action.addTwo });
		}
		// A solve started by lifting the cube: the user has found the hot spot and done the
		// whole loop once, so the routine instructions under the digits go quiet (MagnetHint).
		// Inside the batch: the first time it re-renders the settings listeners.
		markMagnetIntroDone();
	});
}

/**
 * The Magnet Timer (timer_type 'magnet'): lifting a magnetic cube off the phone's
 * magnetometer hot spot starts inspection or the solve; slam-to-stop stops it. Touch does
 * neither in this input (KeyWatcher).
 * Mounted in KeyWatcher, so it only ever runs on the /timer page. Idle and inspection
 * only: the stream pauses while a solve runs, which also resets the detector for the next
 * attempt.
 */
export function useMagnetStart(context: ITimerContext) {
	// Pro, the sensor probe and the selected input, checked when arming, not only in the
	// picker: the selection is a synced setting and outlives a subscription.
	const ownsInput = useMagnetTimerOwnsInput();
	// Any app user: the left drawer's grid then opens with its Magnet tile already decided.
	usePrefetchMagnetProbe(!context.matchMode);
	const solving = !!context.timeStartedAt;
	const inInspection = !!context.inInspection;
	const profileReady = useMagnetCubeProfile(context, ownsInput, inInspection);
	// No calibrated cube on this phone: the stream stays off and nothing can start; the guide
	// under the digits shows what is missing (owner decision: calibration is mandatory).
	const active =
		ownsInput &&
		profileReady &&
		!context.inModal &&
		!context.matchMode &&
		!solving;

	const contextRef = useRef(context);
	contextRef.current = context;
	const wasGreen = useRef(false);
	// Read by the effect cleanup below, which runs after the render that turned `active` off.
	const solvingRef = useRef(solving);
	solvingRef.current = solving;

	useEffect(() => {
		if (!active) return;

		const release = magnetService.acquire('solve');
		const unsubscribe = magnetService.subscribe((batch: ServiceBatch) => {
			const ctx = contextRef.current;
			const settings = getSettings();
			const dwellMs = dwellMsFor(settings.freeze_time, MIN_DWELL_MS);

			// A palm that landed before the cube came within reach primed a touch hold; once
			// the cube settles at the hot spot that hold was the hand placing it. Dropping it
			// here (before any decision) keeps the magnet start from being refused as
			// 'touch_priming' and keeps the palm's release from starting a solve.
			if (shouldCancelHoldOnPlacement(batch.events, !!getTimerStore('spaceTimerStarted'), batch.testMode)) {
				setTimerParams({ spaceTimerStarted: 0, canStart: false });
				stopTimer(START_TIMEOUT);
				magnetDebugLog.record('touch_hold_cancelled');
			}

			for (const { event, armed } of batch.lifts) {
				const side = readTimerSide(ctx, batch.testMode);
				const action = decideOnLift(
					{
						...side,
						now: Date.now(),
						resumeAt: batch.resumeAt,
						armed,
						dwellMs,
						exceptBld: !!getSetting('inspection_except_bld') && BLIND_SUBSET.test(ctx.scrambleSubset || ''),
						inspectionStartedAt: getInspectionStartedAt(),
						inspectionDelayMs: (settings.inspection_delay ?? 15) * 1000,
					},
					event
				);
				magnetDebugLog.record('decision', {
					action: action.kind,
					reason: action.kind === 'none' ? action.reason : undefined,
					addTwo: action.kind === 'startTimer' ? action.addTwo : undefined,
					ageMs: Math.round(Date.now() - event.onset),
				});
				if (!batch.testMode) {
					magnetTelemetry.recordLift(event, action.kind === 'none' ? `none:${action.reason}` : action.kind);
				}
				runAction(action, ctx);
			}

			const side = readTimerSide(ctx, batch.testMode);
			const r = computeReadiness({
				...side,
				phase: batch.snapshot.phase,
				hint: batch.snapshot.hint,
				nearSince: batch.snapshot.nearSince,
				lastT: batch.snapshot.lastT,
				dwellMs,
				armed: batch.armed,
				resting: batch.resting,
			});
			setMagnetStatus({ stage: r.stage, green: r.green, orange: r.orange });

			if (r.green && !wasGreen.current) {
				// Respects the haptic_feedback setting. Our own vibration shakes the field,
				// so lift triggers are muted for a moment.
				hapticImpact('light');
				magnetService.mute(HAPTIC_MUTE_MS);
			}
			wasGreen.current = r.green;
		});

		return () => {
			unsubscribe();
			// The stream pauses for the solve and resumes right after it (see RESUME_TRUST_MS).
			if (solvingRef.current) magnetService.pauseForSolve();
			release();
			wasGreen.current = false;
			setMagnetStatus({ stage: 'off', green: false, orange: false });
		};
	}, [active]);

	// An inspection that ends without a solve (swipe cancel, Escape, DNF) leaves the cube
	// wherever it is; the next idle start needs it taken away first.
	const prevInInspection = useRef(inInspection);
	useEffect(() => {
		if (prevInInspection.current && !inInspection && !context.timeStartedAt && active) {
			magnetService.disarm('inspection_ended');
		}
		prevInInspection.current = inInspection;
	}, [inInspection]);
}

/**
 * The cube the Magnet Timer runs with (design 4.7): the main cube of the timer's puzzle and its
 * calibration on this phone model, turned into detector thresholds. Publishes the result to the
 * status store (the guide reads why nothing can start) and to the service. Returns whether a
 * calibrated cube is in place.
 *
 * Never changed during inspection: a new detector would forget the placement the solve is
 * about to start from. The change lands when the inspection ends.
 */
function useMagnetCubeProfile(context: ITimerContext, ownsInput: boolean, inInspection: boolean): boolean {
	const cubes = useCubes();
	const platform = ownsInput ? magnetPlatform() : null;
	const [identity, setIdentity] = useState<MagnetDeviceIdentity | null | undefined>(undefined);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		if (!platform) return;
		let alive = true;
		magnetDeviceIdentity(platform)
			.then((id) => {
				if (alive) setIdentity(id);
			})
			.catch(() => {
				if (alive) setIdentity(null);
			});
		return () => {
			alive = false;
		};
	}, [platform]);

	// A binary with the Device plugin replaced the screen fallback key: carry this phone's
	// calibrations over to the real model key once (device_model.ts). Idempotent.
	useEffect(() => {
		if (!platform || !identity || identity.isFallback || !identity.deviceModel) return;
		const fallback = storedFallbackModel(platform);
		if (!fallback) return;
		for (const row of fallbackCalibrationCopies(cubes, platform, fallback, identity.deviceModel)) {
			saveCubeCalibrationLocal(row);
		}
	}, [platform, identity, cubes]);

	const deviceModel = identity === undefined ? undefined : identity ? identity.deviceModel : null;
	const profile = useMemo(
		() =>
			ownsInput
				? resolveMagnetProfile({
					state: cubes,
					bucket: { cube_type: context.cubeType, scramble_subset: context.scrambleSubset },
					platform,
					deviceModel,
				})
				: null,
		[ownsInput, cubes, context.cubeType, context.scrambleSubset, platform, deviceModel]
	);

	useEffect(() => {
		if (inInspection) return;
		if (!sameMagnetProfile(getMagnetProfile(), profile)) setMagnetStatus({ profile });
		const isReady = !!profile && profile.status === 'ready';
		magnetService.setCubeProfile(
			isReady
				? {
					cubeId: profile.cubeId as string,
					puzzle: profile.puzzle as string,
					nearMin: profile.nearMin as number,
					farMax: profile.farMax as number,
				}
				: null
		);
		setReady(isReady);
	}, [profile, inInspection]);

	return ready;
}
