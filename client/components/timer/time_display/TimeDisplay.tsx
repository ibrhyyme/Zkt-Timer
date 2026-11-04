import React, { useContext, useEffect, useRef, useState } from 'react';
import {useTranslation} from 'react-i18next';
import { getTimeString } from '../../../util/time';
import './TimeDisplay.scss';
import Manual from './manual/Manual';
import { preflightChecks } from '../smart_cube/preflight';
import { useSmartPuzzleMatch, smartPuzzleLabel } from '../helpers/smart_puzzle';
import { MOBILE_FONT_SIZE_MULTIPLIER } from '../../../db/settings/update';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { smartCubeSelected } from '../helpers/util';
import { virtualCubeSelected } from '../helpers/virtual_cube';
import { getSmartSolveEndTime, getTimerEndFinalTime } from '../helpers/events';
import { applySmartCubeTimeOffset, getSmartCubeTimeOffset, timerPageAppliesSmartOffset } from '../helpers/smart_time_offset';
import { TimerContext } from '../Timer';
import block from '../../../styles/bem';
import { useSettings } from '../../../util/hooks/useSettings';
import { useTimerStore } from '../../../util/hooks/useTimerStore';
import LiveTime from '../../common/live_time/LiveTime';
import { TIMER_RUNNING_SCALE, timeWidthEm } from '../../common/live_time/time_shape';
import StartInstructions from './start_instructions/StartInstructions';
import StackMat from './stackmat/StackMat';
import GanTimer from './gantimer/GanTimer';
import QiyiTimer from './qiyitimer/QiyiTimer';
import SolveDiff from './SolveDiff';
import MultiPhaseIndicator from './multi_phase/MultiPhaseIndicator';
import OfflineModeIndicator from './OfflineModeIndicator';
import MagnetGuide from './magnet/MagnetGuide';
import MagnetLiveBar from './magnet/MagnetLiveBar';
import TimerCubeLabel from './cube_label/TimerCubeLabel';
import HoldStopProgress from './magnet/HoldStopProgress';
import CameraTimer from './camera/CameraTimer';
import { useMagnetStatus } from '../../../util/magnet-start/status_store';
import { getCameraPendingStop, useCameraTimerStatus } from '../../../util/camera-timer/status_store';
import { useCameraTimerOwnsInput } from '../../../util/camera-timer/useCameraTimerOwnsInput';
import { frozenSeconds } from '../../../util/camera-timer/decision';

const b = block('time-display');
const bi = block('timer-bottom-info');

/**
 * The BLE layer's early freeze (setSmartSolveEndTime), with the smart cube time offset
 * added the same way endTimer adds it, under the same rule (timerPageAppliesSmartOffset).
 * Without it the digits would show the bare time at the stop and then jump when the
 * saved, offset one arrived; applied where endTimer does not, they would never agree.
 */
function smartFrozenSeconds(measuredSeconds: number): number {
	if (!timerPageAppliesSmartOffset()) return measuredSeconds;
	return applySmartCubeTimeOffset(measuredSeconds * 1000, getSmartCubeTimeOffset()) / 1000;
}

/**
 * The phone digits' font size: the auto-fit size, capped so the time still fits the screen
 * once it has grown by TIMER_RUNNING_SCALE. The width is the shape LiveTime draws
 * (timeWidthEm), which keeps room for two whole seconds, so the digits do not shrink at ten
 * seconds; the 0.15 em and the 32px are the side margins. Pure CSS, so the server render
 * and the first client frame agree and nothing has to be measured.
 */
function phoneDigitsSize(autoFitPx: number, text: string): string {
	const ems = TIMER_RUNNING_SCALE * (timeWidthEm(text) + 0.15);
	return `min(${autoFitPx}px, calc((100vw - 32px) / ${ems.toFixed(3)}))`;
}

/**
 * The smart cube line under the digits: scramble the cube, or turn it to start.
 *
 * A component of its own because it is the only part of the display that depends on
 * every move; reading the turn list in TimeDisplay would re-render the whole display on
 * each turn.
 */
function SmartStartHint({ scramble, cubeType, scrambleSubset }: { scramble: string; cubeType: string; scrambleSubset?: string | null }) {
	const {t} = useTranslation();
	const smartTurns = useTimerStore('smartTurns');
	const match = useSmartPuzzleMatch(cubeType, scrambleSubset);

	// The cube cannot time this session at all; saying "scramble the cube" would mislead.
	if (match.mismatch) {
		return (
			<StartInstructions>
				{t('smart_cube.puzzle_mismatch', {
					cube: smartPuzzleLabel(match.cube),
					session: smartPuzzleLabel(match.session),
				})}
			</StartInstructions>
		);
	}

	return (
		<StartInstructions>
			{preflightChecks(smartTurns, scramble, 0, match.cube)
				? t('time_display.turn_smart_cube_to_start')
				: t('time_display.scramble_smart_cube_to_start')}
		</StartInstructions>
	);
}

export default function TimeDisplay() {
	const {t} = useTranslation();
	const context = useContext(TimerContext);
	// The resting and stopped time. A running solve does not go through it: LiveTime draws
	// those digits itself, once per screen frame (see readLive below).
	const [time, setTime] = useState(0);
	// The running text as of its last change in length (a new minute), reported by LiveTime,
	// so the phone auto-fit below can size the digits while React does not see the text.
	const [liveText, setLiveText] = useState('');

	const {
		disabled,
		hideTime,
		canStart,
		scramble,
		dnfTime,
		subTimerActions,
		solving,
		finalTime,
		timeStartedAt,
		spaceTimerStarted,
		inInspection,
		matchMode,
	} = context;
	// Ticks every 100 ms during inspection, so it is not in TimerContext (see
	// FAST_TIMER_FIELDS). Only this display shows it.
	const inspectionTimer = useTimerStore('inspectionTimer');

	const inspectionOn = useSettings('inspection');
	const manualEntry = useSettings('manual_entry');
	const hideTimeWhenSolving = useSettings('hide_time_when_solving');
	const timerDecimalPoints = useSettings('timer_decimal_points');
	const timerType = useSettings('timer_type');
	const stackMatOn = timerType === 'stackmat';
	const ganTimerOn = timerType === 'gantimer';
	const qiyiTimerOn = timerType === 'qiyitimer';
	// QiYi wired (QYtoys) uses the standard StackMat audio protocol (mode '')

	const mobileMode = useGeneral('mobile_mode');
	let timerTimeSize = useSettings('timer_time_size');

	// Magnet lift-to-start keeps its ready state outside canStart: KeyWatcher relies on
	// canStart never being true without a live spaceTimerStarted (a touch or Space hold).
	const magnet = useMagnetStatus();
	const magnetGreen = magnet.green && !timeStartedAt;
	const magnetOrange = magnet.orange && !timeStartedAt;
	// The Magnet Timer owns the input (Pro, sensor, selection): useMagnetStart publishes a cube
	// profile only then. The guide, the live bar and the label below all key off it.
	const magnetOwns = timerType === 'magnet' && !!magnet.profile && !context.inModal && !matchMode;
	// Kamera Timer (desktop, admins while tested): green while both hands rest on the pads,
	// kept outside canStart for the same reason as the magnet's.
	const cameraOwnsInput = useCameraTimerOwnsInput();
	const cameraStatus = useCameraTimerStatus();
	const cameraOwns = cameraOwnsInput && !context.inModal && !matchMode;
	const cameraGreen = cameraOwns && cameraStatus.green && !timeStartedAt;

	// True from a stop until the next start: the reduced-motion stop cue (TimeDisplay.scss)
	// plays once when the class appears. Derived during render, so the class lands in the
	// same commit as the frozen time and adds no render of its own.
	const wasSolvingRef = useRef(false);
	const landedRef = useRef(false);
	if (solving) landedRef.current = false;
	else if (wasSolvingRef.current) landedRef.current = true;
	wasSolvingRef.current = !!solving;

	useEffect(() => {
		if (!solving && finalTime < 0) {
			setTime(0);
		}
	}, [solving, finalTime]);

	// The stop freezes the digits at once, before Redux and React catch up: endTimer and the
	// BLE layer publish the final time first and announce it with these events. The running
	// digits already read the same values every frame (readLive); setting the state here is
	// what React shows once the run is over, so the two never disagree.
	useEffect(() => {
		const handleFreeze = () => {
			const solveEnd = getSmartSolveEndTime();
			if (solveEnd !== null && solveEnd > 0 && timeStartedAt) {
				const frozenTime = (solveEnd - timeStartedAt.getTime()) / 1000;
				if (frozenTime > 0) {
					setTime(smartFrozenSeconds(frozenTime));
				}
			}
		};
		window.addEventListener('smartSolveFreeze', handleFreeze);
		return () => window.removeEventListener('smartSolveFreeze', handleFreeze);
	}, [timeStartedAt]);

	useEffect(() => {
		const handleEndFreeze = () => {
			const endFinal = getTimerEndFinalTime();
			if (endFinal !== null && endFinal > 0) {
				setTime(endFinal / 1000);
			}
		};
		window.addEventListener('timerEndFreeze', handleEndFreeze);
		return () => window.removeEventListener('timerEndFreeze', handleEndFreeze);
	}, []);

	useEffect(() => {
		if (!timeStartedAt && !solving && finalTime >= 0) {
			setTime(finalTime / 1000);
		}
	}, [finalTime]);

	// The running digits, once per screen frame. The stop sources come first, in the order the
	// old 33 ms interval checked them, so the digits stop on the time the solve gets instead
	// of running a frame past it.
	const readLive = (): string => {
		const started = timeStartedAt.getTime();

		// Smart cube: the BLE layer saw the cube solved.
		const solveEnd = getSmartSolveEndTime();
		if (solveEnd !== null && solveEnd > 0) {
			const frozenTime = (solveEnd - started) / 1000;
			if (frozenTime > 0) return getTimeString(smartFrozenSeconds(frozenTime), timerDecimalPoints);
		}

		// Touch, keyboard and the Bluetooth timers: endTimer has the final time.
		const endFinalTime = getTimerEndFinalTime();
		if (endFinalTime !== null && endFinalTime > 0) return getTimeString(endFinalTime / 1000, timerDecimalPoints);

		// Kamera Timer: both hands are back on the pads and the stop is being confirmed.
		// Freeze at the time it will get; if the pose breaks, the clock runs on.
		const cameraFrozen = frozenSeconds(getCameraPendingStop(), started);
		if (cameraFrozen !== null) return getTimeString(cameraFrozen, timerDecimalPoints);

		return getTimeString((Date.now() - started) / 1000, timerDecimalPoints);
	};

	// The cube the next solve is stamped with (magnet-cubes 5.5). Not in rooms and
	// matches (no stamp there), not for the smart cube (its own panel names the
	// connected cube) nor the virtual cube (no physical cube). The Magnet Timer shows
	// it once a calibrated cube runs; before that the guide card names the cube.
	const cubeLabel =
		!context.onSolve &&
		!matchMode &&
		!context.inModal &&
		!smartCubeSelected(context) &&
		!virtualCubeSelected(context) &&
		(timerType !== 'magnet' || !magnet.profile || magnet.profile.status === 'ready') ? (
			<TimerCubeLabel magnetOwnsInput={magnetOwns} visible={!timeStartedAt && !inInspection} />
		) : null;

	if (manualEntry) {
		// Manual solves are stamped with the main cube too, so the label shows it here as well.
		return <Manual cubeLabel={cubeLabel} />;
	}

	let timeStr;
	let bottomInfo = null;

	if (inInspection) {
		if (inspectionTimer <= 2) {
			timeStr = '+2';
		} else {
			// İnceleme süresinde ondalık gösterme — tam sayı geri sayım
			timeStr = Math.ceil(inspectionTimer - 2).toString();
		}
	} else {
		timeStr = getTimeString(time);
	}

	if (dnfTime && inInspection) {
		timeStr = 'DNF';
	}

	if (hideTimeWhenSolving && timeStartedAt) {
		timeStr = t('time_display.solve');
	}

	// A running solve: LiveTime draws the digits every screen frame and React stays out of it.
	// Hidden time ("Solve") and inspection are plain text, so they stay with React.
	const live = !!solving && !!timeStartedAt && !inInspection && !hideTimeWhenSolving;

	// Set by the phone auto-fit below; everything else uses the size as a plain pixel value.
	let fontSize: string | null = null;

	// Mobilde karakter sayisina gore font boyutunu dinamik ayarla
	if (mobileMode) {
		const fitText = live && liveText ? liveText : timeStr;
		const charCount = fitText.length;
		// Virtual cube, before the attempt starts: the cube is what the user is
		// looking at, and a full-size clock reading 0.00 just pushes it off a short
		// phone. Once armed the chrome is gone and the digits get their size back.
		const virtualIdle =
			virtualCubeSelected(context) && !timeStartedAt && !context.virtualArmed;

		if (smartCubeSelected(context) || virtualIdle) {
			// Smart cube: container %45 genislik, daha agresif kucultme
			const maxSize = 50;
			if (charCount > 4) {
				timerTimeSize = Math.max(Math.floor(maxSize * 4 / charCount), 22);
			} else {
				timerTimeSize = maxSize;
			}
		} else {
			const maxSize = 100;
			if (charCount > 5) {
				timerTimeSize = Math.max(Math.floor(maxSize * 5 / charCount), 40);
			} else {
				timerTimeSize = maxSize;
			}
			fontSize = phoneDigitsSize(timerTimeSize, fitText);
		}
	}

	if (!fontSize) {
		fontSize = timerTimeSize + 'px';
	}

	// bottomInfo always sits under the digits, centred, on every width. StackMat's line and
	// the GAN / QiYi connect button used to move beside the digits on desktop, where they
	// read as a stray block hanging off the time (owner, 2026-10-31).
	//
	// The Bluetooth timers have a connect button: the label joins it in one row instead
	// of stacking a second control above it.
	const cubeLabelBesideConnect = ganTimerOn || qiyiTimerOn;
	// The diff sits on the module surface like the label (TimeDisplay.scss), except next to
	// the smart and virtual cubes, where the digits are small and the room tight.
	const diffChip = !smartCubeSelected(context) && !virtualCubeSelected(context);

	if (stackMatOn) {
		bottomInfo = <StackMat />;
	} else if (cameraOwns) {
		bottomInfo = <CameraTimer />;
	} else if (ganTimerOn) {
		bottomInfo = (
			<>
				{cubeLabel}
				<GanTimer />
			</>
		);
	} else if (qiyiTimerOn) {
		bottomInfo = (
			<>
				{cubeLabel}
				<QiyiTimer />
			</>
		);
	} else if (magnetOwns && !timeStartedAt) {
		// The Magnet Timer's own input (timer_type 'magnet'); the touch timer has no magnet.
		// Shown also while the stream is off: without a calibrated cube nothing can start and
		// the guide says what is missing (magnet-cubes 5.6).
		bottomInfo = <MagnetGuide canAct={!inInspection} />;
	} else if (smartCubeSelected(context) && !mobileMode) {
		if (context.smartNeedsCubeReset) {
			bottomInfo = (
				<StartInstructions>
					{t('smart_cube.solve_cube_to_start')}
				</StartInstructions>
			);
		} else {
			bottomInfo = <SmartStartHint scramble={scramble} cubeType={context.cubeType} scrambleSubset={context.scrambleSubset} />;
		}
	}

	let body = (
		<>
			<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
				<OfflineModeIndicator />
				<LiveTime
					as="h1"
					running={live}
					read={readLive}
					text={timeStr}
					onLengthChange={setLiveText}
					style={{
						fontSize,
						marginBottom: mobileMode ? '0px' : '10px', // Reduce bottom margin on mobile
						lineHeight: '1',
					}}
					className={b({
						gray: inInspection,
						green: canStart || magnetGreen || cameraGreen,
						orange: !!spaceTimerStarted || magnetOrange,
						disabled,
						// Digits grow/shrink only on this edge (armed/inspecting stay at
						// scale 1 — colour classes above already cover those states).
						// Keying off `solving` alone works for every input method
						// (keyboard, touch, StackMat, GAN/QiYi, smart cube, virtual cube)
						// since they all funnel through startTimer()/endTimer() in
						// helpers/events.ts, which is what flips this flag.
						running: solving,
						// Reduced motion only: a short colour cue on the stop (no movement).
						landed: landedRef.current,
					})}
				/>

				{/* Magnet Timer: live field bar while idle and inspecting (keeps its height
				    during the solve, so the digits do not move). */}
				{magnetOwns && <MagnetLiveBar idle={!timeStartedAt} />}

				{/* Magnet Timer: fills while a finger is held still to stop the solve. */}
				{timerType === 'magnet' && timeStartedAt && <HoldStopProgress />}

				{/* Diff underneath timer, close to it. With the cube label the two share one row
				    pinned to the digits' edges, label left and diff right, so the middle under the
				    time stays free: that is where a finger lands to start the touch timer, and a
				    press on the label never primes it (touch_target.ts). */}
				{cubeLabel && !cubeLabelBesideConnect ? (
					<div className={b('under', { mobile: mobileMode })}>
						{cubeLabel}
						{!matchMode && <SolveDiff />}
					</div>
				) : (
					<div
						className={b('diff', { chip: diffChip, mobile: mobileMode })}
						style={diffChip ? undefined : { marginTop: mobileMode ? '-5px' : '0' }}
					>
						{!matchMode && <SolveDiff />}
					</div>
				)}

				<MultiPhaseIndicator />

				{/* Mobile smart cube: SmartStats artık SOL kolonda LiveAnalysisOverlay altinda render ediliyor (SmartCube.tsx portal). */}
			</div>
			<div className={bi()}>{bottomInfo}</div>
			{subTimerActions}
		</>
	);

	if (hideTime) {
		body = null;
	}

	return (
		<div
			className={b({
				smart: smartCubeSelected(context),
			})}
		>
			{body}
		</div>
	);
}
