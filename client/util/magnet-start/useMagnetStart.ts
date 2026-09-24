import { useEffect, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { useMe } from '../hooks/useMe';
import { useSettings } from '../hooks/useSettings';
import { getSetting, getSettings } from '../../db/settings/query';
import { getStore } from '../../components/store';
import { getCubeTypeInfoById } from '../cubes/util';
import { isAppVisible } from '../app-visibility';
import { hapticImpact } from '../native-plugins';
import { canUseMagnetStart } from '../../lib/magnet-start-access';
import { ITimerContext } from '../../components/timer/Timer';
import { setTimerParams } from '../../components/timer/helpers/params';
import { getInspectionStartedAt, startInspection, startTimer } from '../../components/timer/helpers/events';
import { HAPTIC_MUTE_MS, MIN_DWELL_MS } from './config';
import { computeReadiness, decideOnLift, dwellMsFor, MagnetAction, TimerSide } from './controller';
import { magnetDebugLog } from './debug_log';
import { magnetService, ServiceBatch } from './service';
import { useMagnetStartSettings } from './settings';
import { startBlockReason } from './start_guard';
import { setMagnetStatus } from './status_store';
import { useMagnetAvailability } from './availability';

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
	});
}

/**
 * Magnet lift-to-start for the touch timer: lifting a magnetic cube off the phone's
 * magnetometer hot spot starts inspection or the solve; slam-to-stop (or a tap) stops it.
 * Mounted in KeyWatcher, so it only ever runs on the /timer page. Idle and inspection
 * only: the stream pauses while a solve runs, which also resets the detector for the next
 * attempt.
 */
export function useMagnetStart(context: ITimerContext) {
	const me = useMe();
	const { enabled } = useMagnetStartSettings();
	const timerType = useSettings('timer_type');
	const manualEntry = useSettings('manual_entry');

	// Checked when arming, not only when showing the toggle: the switch lives in
	// localStorage and outlives the permission (mirrors useSlamToStop's proAllowed).
	const allowed = canUseMagnetStart(me);
	const caps = useMagnetAvailability(allowed && enabled);
	const solving = !!context.timeStartedAt;
	const active =
		!!caps &&
		allowed &&
		enabled &&
		timerType === 'keyboard' &&
		!manualEntry &&
		!context.inModal &&
		!context.matchMode &&
		!solving;

	const contextRef = useRef(context);
	contextRef.current = context;
	const wasGreen = useRef(false);

	useEffect(() => {
		if (!active) return;

		const release = magnetService.acquire('solve');
		const unsubscribe = magnetService.subscribe((batch: ServiceBatch) => {
			const ctx = contextRef.current;
			const settings = getSettings();
			const dwellMs = dwellMsFor(settings.freeze_time, MIN_DWELL_MS);

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
			release();
			wasGreen.current = false;
			setMagnetStatus({ stage: 'off', green: false, orange: false });
		};
	}, [active]);

	// An inspection that ends without a solve (swipe cancel, Escape, DNF) leaves the cube
	// wherever it is; the next idle start needs it taken away first.
	const inInspection = !!context.inInspection;
	const prevInInspection = useRef(inInspection);
	useEffect(() => {
		if (prevInInspection.current && !inInspection && !context.timeStartedAt && active) {
			magnetService.disarm('inspection_ended');
		}
		prevInInspection.current = inInspection;
	}, [inInspection]);
}
