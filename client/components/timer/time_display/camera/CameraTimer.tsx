import React, { useContext, useEffect, useRef, useState } from 'react';
import { createPortal, unstable_batchedUpdates } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { VideoCamera } from 'phosphor-react';
import block from '../../../../styles/bem';
import { ITimerContext, TimerContext } from '../../Timer';
import StartInstructions from '../start_instructions/StartInstructions';
import ConnectTrigger from '../../common/ConnectTrigger';
import SelectMenu from '../../../common/select_menu/SelectMenu';
import { useMe } from '../../../../util/hooks/useMe';
import { useSettings } from '../../../../util/hooks/useSettings';
import { getSetting, getSettings } from '../../../../db/settings/query';
import { getStore } from '../../../store';
import { getCubeTypeInfoById } from '../../../../util/cubes/util';
import { isAppVisible, onVisibilityChange } from '../../../../util/app-visibility';
import { getTimerStore } from '../../../../util/store/getTimer';
import { setTimerParams } from '../../helpers/params';
import { endTimer, getInspectionStartedAt, startInspection, startTimer } from '../../helpers/events';
import { canUseCameraTimer } from '../../../../lib/camera-timer-access';
import { useCameraTimerAvailability } from '../../../../util/camera-timer/availability';
import { BrainResult, CameraTimerEngine, EngineStatus, INITIAL_STATUS } from '../../../../util/camera-timer/engine';
import {
	cameraGreen,
	cameraStopApplies,
	CameraTimerSide,
	captureToEpoch,
	decideOnCameraStart,
	EARLY_LEAVE,
	padDisplacement,
	QUALITY,
	cameraMissedStop,
	stopHoldProgress,
} from '../../../../util/camera-timer/decision';
import {
	resetCameraTimerStatus,
	setCameraPendingStop,
	setCameraTimerStatus,
	useCameraTimerStatus,
} from '../../../../util/camera-timer/status_store';
import { startBlockReason } from '../../../../util/magnet-start/start_guard';
import { useCameraViewSlot } from './view_slot';
import './CameraTimer.scss';

const b = block('camera-timer');

const BLIND_SUBSET = /(ni|bld)$/;

// Hold ring radius around a palm, in hand sizes (wrist to middle knuckle): clear of the fingers.
const HOLD_RING = 1.3;

// MediaPipe's 21 hand points, joined as bones.
const BONES: [number, number][] = [
	[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11],
	[11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

function readSide(ctx: ITimerContext): CameraTimerSide {
	// Read at event time, never from the render closure: the brain's results arrive outside
	// React, between a store update and the render that would refresh a closure.
	const state = getStore()?.getState() || ({} as any);
	const timer = state.timer || {};
	const modals = state.general?.modals || [];
	const settings = getSettings();
	return {
		guard: startBlockReason({
			timerType: settings.timer_type,
			owner: 'camera',
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
			testMode: false,
		}),
		solving: !!timer.timeStartedAt,
		inInspection: !!timer.inInspection,
		dnfTime: !!timer.dnfTime,
		inspectionEnabled: !!settings.inspection,
		exceptBld: !!getSetting('inspection_except_bld') && BLIND_SUBSET.test(ctx.scrambleSubset || ''),
		inspectionStartedAt: getInspectionStartedAt(),
		inspectionDelayMs: (settings.inspection_delay ?? 15) * 1000,
		now: Date.now(),
	};
}

function handleResult(engine: CameraTimerEngine, r: BrainResult, ctx: ITimerContext): void {
	const origin = performance.timeOrigin;
	const running = !!getTimerStore('timeStartedAt');
	setCameraPendingStop(
		running && r.snap.state === 'solving' && r.snap.pendingStopT !== null
			? captureToEpoch(r.snap.pendingStopT, origin)
			: null
	);
	if (!r.events.length) {
		setCameraTimerStatus({ green: cameraGreen(r.snap, running, engine.leaveFar) });
		return;
	}

	// Worker messages are outside React 17's batching: one render for all of it.
	unstable_batchedUpdates(() => {
		for (const ev of r.events) {
			if (ev.type === 'start') {
				const action = decideOnCameraStart(readSide(ctx), captureToEpoch(ev.t, origin));
				engine.note('decision', {
					action: action.kind,
					reason: action.kind === 'none' ? action.reason : undefined,
					addTwo: action.kind === 'startTimer' ? action.addTwo : undefined,
					frame: ev.frame,
				});
				if (action.kind === 'startInspection') {
					setCameraTimerStatus({ green: false });
					startInspection(ctx, action.onset);
					// The hands go back on the pads after inspection, like on a StackMat.
					engine.reset();
				} else if (action.kind === 'startTimer') {
					setCameraTimerStatus({ green: false });
					setTimerParams({ canStart: false, spaceTimerStarted: 0 });
					startTimer(action.onset);
					if (action.addTwo !== undefined) {
						// startTimer stopped the inspection interval, so nothing overwrites this before save.
						setTimerParams({ addTwoToSolve: action.addTwo });
					}
				} else if (action.reason !== 'solving') {
					// The brain thinks a solve began and nothing did (a modal was open, DNF):
					// back to idle, or it would wait for a stop that means nothing.
					engine.reset();
				}
			} else if (ev.type === 'stop') {
				const solving = !!getTimerStore('timeStartedAt');
				if (cameraStopApplies(solving, ev)) {
					setCameraPendingStop(null);
					setCameraTimerStatus({ holdHint: false });
					endTimer(ctx, ev.timeMs, undefined, captureToEpoch(ev.t, origin));
					engine.note('stopped', { timeMs: ev.timeMs, frame: ev.frame });
				}
			}
		}
		setCameraTimerStatus({ green: cameraGreen(r.snap, !!getTimerStore('timeStartedAt'), engine.leaveFar) });
	});
}

function themeRgb(el: Element, name: string, fallback: string): string {
	const v = getComputedStyle(el).getPropertyValue(name).trim();
	return v ? `rgb(${v})` : fallback;
}

// What the timer sees: each hand's points and bones in the colour of the pad timer's state
// and, while armed, a ring around each pad: a hand leaving its ring starts the timer. While the
// hands sit in the stop pose, a ring around each hand fills over the stop confirmation: the
// digits froze, and leaving before it is full lets the time run on. Rings are ellipses because
// the timer measures in normalized image units, as the model reports.
function drawOverlay(canvas: HTMLCanvasElement, engine: CameraTimerEngine, colors: Record<string, string>): void {
	const w = canvas.clientWidth;
	const h = canvas.clientHeight;
	if (!w || !h) return;
	const dpr = window.devicePixelRatio || 1;
	if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
	}
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.clearRect(0, 0, w, h);
	const { hands, snap } = engine.latest;
	const state = snap?.state || 'idle';
	// A hand already on its way off the pad drops the green with the digits (cameraGreen).
	const d = state === 'ready' && snap ? padDisplacement(snap.pads, snap.palms) : null;
	const leaving = d !== null && d > EARLY_LEAVE * engine.leaveFar;
	const color = (leaving ? colors.idle : colors[state]) || colors.idle;
	ctx.strokeStyle = color;
	ctx.fillStyle = color;
	if (state === 'ready' && snap?.pads) {
		const r = engine.leaveFar;
		ctx.lineWidth = 2;
		ctx.setLineDash([6, 6]);
		for (const p of snap.pads) {
			ctx.beginPath();
			ctx.ellipse(p.x * w, p.y * h, r * p.scale * w, r * p.scale * h, 0, 0, Math.PI * 2);
			ctx.stroke();
		}
		ctx.setLineDash([]);
	}
	const hold = stopHoldProgress(snap, engine.stopMs);
	if (hold !== null && snap) {
		ctx.save();
		ctx.strokeStyle = colors.ready || color;
		ctx.lineWidth = 3;
		for (const p of snap.palms) {
			const rx = HOLD_RING * p.scale * w;
			const ry = HOLD_RING * p.scale * h;
			ctx.globalAlpha = 0.3;
			ctx.beginPath();
			ctx.ellipse(p.x * w, p.y * h, rx, ry, 0, 0, Math.PI * 2);
			ctx.stroke();
			ctx.globalAlpha = 1;
			ctx.beginPath();
			ctx.ellipse(p.x * w, p.y * h, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + hold * Math.PI * 2);
			ctx.stroke();
		}
		ctx.restore();
	}
	ctx.lineWidth = 2;
	for (const lm of hands) {
		ctx.beginPath();
		for (const [a, c] of BONES) {
			ctx.moveTo(lm[a * 3] * w, lm[a * 3 + 1] * h);
			ctx.lineTo(lm[c * 3] * w, lm[c * 3 + 1] * h);
		}
		ctx.stroke();
		for (let i = 0; i < 21; i++) {
			ctx.beginPath();
			ctx.arc(lm[i * 3] * w, lm[i * 3 + 1] * h, 2.5, 0, Math.PI * 2);
			ctx.fill();
		}
	}
}

function useEngineStatus(engine: CameraTimerEngine | null): EngineStatus | null {
	const [status, setStatus] = useState<EngineStatus | null>(engine ? engine.status : null);
	useEffect(() => {
		if (!engine) {
			setStatus(null);
			return;
		}
		setStatus(engine.status);
		return engine.subscribe(() => setStatus(engine.status));
	}, [engine]);
	return status;
}

/**
 * The Kamera Timer's input (timer_type 'camera', desktop, admins while it is tested): the
 * camera preview with the hands and pads drawn over it, the line saying what to do, camera
 * warnings and the camera picker. The hands leaving the pads start the solve (or inspection),
 * both hands coming back stop it; the brain that decides is a private worker (engine.ts).
 */
export default function CameraTimer() {
	const { t } = useTranslation();
	const context = useContext(TimerContext);
	const me = useMe();
	const allowed = canUseCameraTimer(me);
	const manifest = useCameraTimerAvailability(allowed);
	const inspectionOn = useSettings('inspection');
	const { holdHint } = useCameraTimerStatus();

	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	// The camera panel left of the digits, or null: then the picture stays in the box here.
	const slot = useCameraViewSlot();
	const contextRef = useRef(context);
	contextRef.current = context;

	const [engine, setEngine] = useState<CameraTimerEngine | null>(null);
	// Off until the engine exists: the video element has to be on the page before the engine
	// effect below runs, or a remembered camera permission would find no element to open into.
	const status = useEngineStatus(engine) || INITIAL_STATUS;
	const brain = manifest ? manifest.brain : null;

	useEffect(() => {
		if (!manifest) return;
		const created = new CameraTimerEngine(manifest);
		created.onResult = (r) => handleResult(created, r, contextRef.current);
		setEngine(created);
		const unsubscribe = onVisibilityChange((visible) => created.setHidden(!visible));
		created.setHidden(!isAppVisible());

		// The user picked this input; once the browser remembers the camera permission the
		// camera opens with the page. The first time it waits for the button (a permission
		// prompt nobody asked for on page load is worse than one click).
		let alive = true;
		const perms: any = (navigator as any).permissions;
		if (perms?.query) {
			perms
				.query({ name: 'camera' })
				.then((p: any) => {
					if (alive && p?.state === 'granted' && videoRef.current) created.open(videoRef.current);
				})
				.catch(() => {});
		}

		return () => {
			alive = false;
			unsubscribe();
			created.close();
			resetCameraTimerStatus();
			setEngine(null);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [brain]);

	const stage = status.stage;

	useEffect(() => {
		setCameraTimerStatus({ engaged: stage === 'running' });
	}, [stage]);

	// The video element moved (the camera panel came or went) after the camera opened:
	// the stream is still on the old element, so open it again into the new one.
	useEffect(() => {
		const video = videoRef.current;
		if (!engine || !video || engine.status.stage === 'off' || engine.status.stage === 'error') return;
		if (video.srcObject) return;
		engine.open(video, engine.status.deviceId || undefined);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [slot]);

	// A solve that ended some other way (Space, Escape) while the brain still waits for the
	// hands: back to idle so its late stop does not land on the next attempt, and tell the user
	// to hold the hands on the table next time (the camera missed the stop).
	const timeStartedAt = context.timeStartedAt;
	useEffect(() => {
		if (!engine || timeStartedAt) return;
		setCameraPendingStop(null);
		if (cameraMissedStop(engine.latest.snap?.state, !!timeStartedAt)) {
			setCameraTimerStatus({ holdHint: true });
			engine.note('missed_stop', {});
			engine.reset();
		}
	}, [timeStartedAt, engine]);

	// The overlay follows the brain's results, drawn once per new result.
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!engine || !canvas || stage !== 'running') return;
		const colors = {
			idle: themeRgb(canvas, '--text-color', '#fff'),
			ready: themeRgb(canvas, '--success-color', '#2dbd61'),
			solving: themeRgb(canvas, '--primary-color', '#246bfd'),
			stopped: themeRgb(canvas, '--text-color', '#fff'),
		};
		let raf = 0;
		let drawn = -1;
		const loop = () => {
			if (engine.latest.seq !== drawn) {
				drawn = engine.latest.seq;
				drawOverlay(canvas, engine, colors);
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
		// slot: the canvas is a different element once the picture moves into the panel.
	}, [engine, stage, slot]);

	function openCamera(deviceId?: string) {
		if (engine && videoRef.current) engine.open(videoRef.current, deviceId);
	}

	function downloadLog() {
		if (!engine) return;
		const url = URL.createObjectURL(engine.exportLog());
		const d = new Date();
		const p = (n: number) => String(n).padStart(2, '0');
		const a = document.createElement('a');
		a.href = url;
		a.download = `kamera-timer-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.json`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	// Nothing until the manifest is known (it also keeps the server render empty).
	if (!manifest) return null;

	const solving = !!context.timeStartedAt;
	const inInspection = !!context.inInspection;
	const running = stage === 'running';
	const padState = status.padState;

	let line: string | null = null;
	if (stage === 'error') {
		line = t(`camera_timer.error_${status.error || 'camera'}`);
	} else if (stage === 'off') {
		line = t('camera_timer.intro');
	} else if (stage === 'starting') {
		line = t('camera_timer.starting');
	} else if (stage === 'loading') {
		line = t('camera_timer.loading');
	} else if (!solving) {
		if (padState === 'ready') {
			line = inspectionOn && !inInspection ? t('camera_timer.ready_inspection') : t('camera_timer.ready');
		} else if (padState === 'stopped') {
			line = t('camera_timer.lift_to_rearm');
		} else {
			line = inInspection ? t('camera_timer.place_hands_inspection') : t('camera_timer.place_hands');
		}
	} else if (holdHint) {
		// The camera missed the last stop (ended by hand): say to hold the hands on the table.
		line = t('camera_timer.hold_to_stop');
	}

	const warning = running && !solving && status.warnings.length ? status.warnings[0] : null;
	const showControls = !solving && !inInspection;
	const cameraOptions = status.cameras.map((c) => ({ value: c.deviceId, label: c.label }));

	const pictureHidden = !running && stage !== 'loading';
	const aspect = status.width && status.height ? { aspectRatio: `${status.width} / ${status.height}` } : undefined;
	const media = (
		<>
			<video ref={videoRef} className={b('video')} />
			<canvas ref={canvasRef} className={b('overlay')} />
		</>
	);
	// Desktop timer: a module-style panel left of the digits, there in every state so the digits
	// never move when the camera opens. Elsewhere (no panel): its own box under the digits, only
	// while there is a picture.
	const picture = slot ? (
		createPortal(
			<div className={b('panel')}>
				<div className={b('panel-head')}>{t('camera_timer.camera')}</div>
				<div className={b('panel-body', { off: pictureHidden })} style={aspect}>
					{pictureHidden && <VideoCamera className={b('panel-placeholder')} aria-hidden="true" />}
					{media}
				</div>
			</div>,
			slot
		)
	) : (
		<div className={b('stage', { hidden: pictureHidden })} style={aspect}>
			{media}
		</div>
	);

	return (
		<div className={b()}>
			{picture}

			{line && <StartInstructions>{line}</StartInstructions>}

			{warning && (
				<div className={b('warning')}>
					{t(`camera_timer.warning_${warning}`, {
						fps: status.cameraFps,
						min: QUALITY.minFps,
						height: status.height,
						ms: status.modelMs,
					})}
				</div>
			)}

			{showControls && (
				<div className={b('controls')}>
					{(stage === 'off' || stage === 'error') && status.error !== 'unsupported' && (
						<ConnectTrigger
							state="idle"
							icon={VideoCamera}
							text={t('camera_timer.open_camera')}
							onClick={() => openCamera()}
						/>
					)}
					{running && cameraOptions.length > 1 && (
						<SelectMenu
							value={status.deviceId}
							onChange={(id) => openCamera(id)}
							options={cameraOptions}
							ariaLabel={t('camera_timer.camera')}
						/>
					)}
					{running && me?.admin && (
						<span className={b('log')} role="button" onClick={downloadLog}>
							{t('camera_timer.download_log')}
						</span>
					)}
				</div>
			)}
		</div>
	);
}
