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
import { onVisibilityChange } from '../../../util/app-visibility';
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
import { useMagnetStatus } from '../../../util/magnet-start/status_store';

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
	const [time, setTime] = useState(0);
	const timerCounter = useRef<NodeJS.Timeout>(null);
	const timerLocked = useRef<boolean>(false);

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
	const timerFontFamily = useSettings('timer_font_family');
	const timerType = useSettings('timer_type');
	const stackMatOn = timerType === 'stackmat';
	const ganTimerOn = timerType === 'gantimer';
	const qiyiTimerOn = timerType === 'qiyitimer';
	// QiYi wired (QYtoys) uses the standard StackMat audio protocol (mode '')
	const zeroOutTimeAfterSolve = useSettings('zero_out_time_after_solve');

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

	// True from a stop until the next start: the reduced-motion stop cue (TimeDisplay.scss)
	// plays once when the class appears. Derived during render, so the class lands in the
	// same commit as the frozen time and adds no render of its own.
	const wasSolvingRef = useRef(false);
	const landedRef = useRef(false);
	if (solving) landedRef.current = false;
	else if (wasSolvingRef.current) landedRef.current = true;
	wasSolvingRef.current = !!solving;

	useEffect(() => {
		if (timerCounter.current && !solving) {
			stopInterval();
		} else if (!timerCounter.current && timeStartedAt) {
			startInterval();
		}
		if (!solving && finalTime < 0) {
			setTime(0);
		}
	}, [solving, finalTime, timeStartedAt]);

	// Smart cube: BLE solved tespiti anında display'i dondur (33ms interval tick'ini bekleme)
	// Bu olmadan timer "ileri kaçıp geri düşme" efekti yaşanır
	useEffect(() => {
		const handleFreeze = () => {
			const solveEnd = getSmartSolveEndTime();
			if (solveEnd !== null && solveEnd > 0 && timeStartedAt) {
				const frozenTime = (solveEnd - timeStartedAt.getTime()) / 1000;
				if (frozenTime > 0) {
					setTime(smartFrozenSeconds(frozenTime));
					// Interval'ı durdur — artık ticking gereksiz
					if (timerCounter.current) {
						clearInterval(timerCounter.current);
						timerCounter.current = null;
					}
				}
			}
		};
		window.addEventListener('smartSolveFreeze', handleFreeze);
		return () => window.removeEventListener('smartSolveFreeze', handleFreeze);
	}, [timeStartedAt]);

	// Touch/keyboard: endTimer aninda display'i dondur ve interval'i temizle
	useEffect(() => {
		const handleEndFreeze = () => {
			const endFinal = getTimerEndFinalTime();
			if (endFinal !== null && endFinal > 0) {
				setTime(endFinal / 1000);
				if (timerCounter.current) {
					clearInterval(timerCounter.current);
					timerCounter.current = null;
				}
			}
		};
		window.addEventListener('timerEndFreeze', handleEndFreeze);
		return () => window.removeEventListener('timerEndFreeze', handleEndFreeze);
	}, []);

	// Arka plana gecildiginde timer display interval'ini durdur
	useEffect(() => {
		const unsub = onVisibilityChange((visible) => {
			if (!visible && timerCounter.current) {
				clearInterval(timerCounter.current);
				timerCounter.current = null;
			} else if (visible && !timerCounter.current && timeStartedAt && solving) {
				startInterval();
			}
		});
		return unsub;
	}, [solving, timeStartedAt]);

	useEffect(() => {
		if (!timeStartedAt && !solving && finalTime >= 0) {
			setTime(finalTime / 1000);
		}
	}, [finalTime]);

	function stopInterval() {
		// Smart cube: freeze handler interval'ı zaten temizledi
		// finalTime ile display'i doğru değere güncelle (freeze yaklaşık, linear fit doğru)
		if (!timerCounter.current && getSmartSolveEndTime() !== null) {
			if (finalTime > 0) {
				setTime(finalTime / 1000);
			}
			return;
		}

		timerLocked.current = true;

		if (!finalTime || finalTime <= 0) {
			setTime(0);
		} else {
			setTime(finalTime / 1000);
		}

		if (timerCounter.current) {
			clearInterval(timerCounter.current);
		}
		timerCounter.current = null;
		timerLocked.current = false;

		if (zeroOutTimeAfterSolve && finalTime > 0) {
			setTime(0);
		}
	}

	function startInterval() {
		if (timerCounter.current) {
			return;
		}
		timerCounter.current = setInterval(() => {
			const now = new Date();

			if (timerLocked.current || (!solving && !finalTime) || !timeStartedAt) {
				return;
			}

			// Smart cube: BLE katmanında solved tespit edildiyse display'i dondur
			const solveEnd = getSmartSolveEndTime();
			if (solveEnd !== null && solveEnd > 0) {
				const frozenTime = (solveEnd - timeStartedAt.getTime()) / 1000;
				if (frozenTime > 0) {
					setTime(smartFrozenSeconds(frozenTime));
					return;
				}
			}

			// Touch/keyboard: endTimer cagrildiginda display'i dondur
			// Redux dispatch ve React re-render beklemeden overshoot'u engeller
			const endFinalTime = getTimerEndFinalTime();
			if (endFinalTime !== null && endFinalTime > 0) {
				setTime(endFinalTime / 1000);
				return;
			}

			const runningTime = (now.getTime() - timeStartedAt.getTime()) / 1000;
			setTime(runningTime);
		}, 33);
	}

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
		timeStr = getTimeString(time, (mobileMode && solving) ? 1 : undefined);
	}

	if (dnfTime && inInspection) {
		timeStr = 'DNF';
	}

	if (hideTimeWhenSolving && timeStartedAt) {
		timeStr = t('time_display.solve');
	}

	// Mobilde karakter sayisina gore font boyutunu dinamik ayarla
	if (mobileMode) {
		const charCount = timeStr.length;
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
		}
	}

	// bottomInfo always sits under the digits, centred, on every width. StackMat's line and
	// the GAN / QiYi connect button used to move beside the digits on desktop, where they
	// read as a stray block hanging off the time (owner, 2026-10-31).
	//
	// The Bluetooth timers have a connect button: the label joins it in one row instead
	// of stacking a second control above it.
	const cubeLabelBesideConnect = ganTimerOn || qiyiTimerOn;

	if (stackMatOn) {
		bottomInfo = <StackMat />;
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
				<h1
					style={{
						fontSize: timerTimeSize + 'px',
						fontFamily: timerFontFamily + ', monospace',
						marginBottom: mobileMode ? '0px' : '10px', // Reduce bottom margin on mobile
						lineHeight: '1',
					}}
					className={b({
						gray: inInspection,
						green: canStart || magnetGreen,
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
				>
					{timeStr}
				</h1>

				{/* Magnet Timer: live field bar while idle and inspecting (keeps its height
				    during the solve, so the digits do not move). */}
				{magnetOwns && <MagnetLiveBar idle={!timeStartedAt} />}

				{/* Magnet Timer: fills while a finger is held still to stop the solve. */}
				{timerType === 'magnet' && timeStartedAt && <HoldStopProgress />}

				{/* Diff underneath timer, close to it */}
				<div style={{ marginTop: mobileMode ? '-5px' : '0' }}>
					{!matchMode && <SolveDiff />}
				</div>

				<MultiPhaseIndicator />

				{!cubeLabelBesideConnect && cubeLabel}

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
