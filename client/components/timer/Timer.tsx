import React, { createContext, ReactNode, useEffect, useState, useMemo } from 'react';
import { RootStateOrAny, useDispatch, useSelector, shallowEqual } from 'react-redux';
import './Timer.scss';
import HeaderControl from './header_control/HeaderControl';
import TimerFooter from './footer/TimerFooter';
import TimeDisplay from './time_display/TimeDisplay';
import TimerScramble from './time_display/timer_scramble/TimerScramble';
import KeyWatcher from './key_watcher/KeyWatcher';
import { TimerProps, TimerStore } from './@types/interfaces';
import { getStorageURL } from '../../util/storage';
import block from '../../styles/bem';
import { useGeneral } from '../../util/hooks/useGeneral';
import { useMe } from '../../util/hooks/useMe';
import { initTimer } from './helpers/init';
import { stopAllTimers, clearInspectionTimers } from './helpers/timers';
import { endTimer } from './helpers/events';
import { useSettings } from '../../util/hooks/useSettings';
import { is3x3CubeType, smartCubeSelected } from './helpers/util';
import { listenForPbEvents } from './helpers/pb';
import { useStableViewportHeight } from '../../util/hooks/useStableViewportHeight';
import SmartCube from './smart_cube/SmartCube';
import { QuickControlsProvider } from '../quick-controls/useQuickControlsModal';
import QuickControlsModal from '../quick-controls/QuickControlsModal';
import DailyGoalProgressBar from '../daily-goal/DailyGoalProgressBar';
import { keepScreenAwake, allowScreenSleep } from '../../util/native-plugins';
// New mobile layout components
import TimerControls from './TimerControls';
import Dashboard from './Dashboard';
import StatsBar from './StatsBar';
import MobileTimerScramble from './MobileTimerScramble';

const b = block('timer');

export interface ITimerContext extends TimerProps, TimerStore { }

export const TimerContext = createContext<ITimerContext>(null);

export default function Timer(props: TimerProps) {
	useStableViewportHeight();
	const dispatch = useDispatch();
	const _mobileMode = useGeneral('mobile_mode');
	const mobileMode = props.forceMobileLayout ?? _mobileMode;

	const [loading, setLoading] = useState(true);
	const timerStore = useSelector((state: RootStateOrAny) => state.timer, shallowEqual) as TimerStore;
	const cubeType = useSettings('cube_type');
	const hideMobileTimerFooter = useSettings('hide_mobile_timer_footer');
	const timerType = useSettings('timer_type');
	const manualEntry = useSettings('manual_entry');
	const useSpaceWithSmartCube = useSettings('use_space_with_smart_cube');
	const scrambleSubset = useSettings('scramble_subset');
	const scrambleTopColor = useSettings('scramble_top_color');
	let timerLayout = props.timerLayout || useSettings('timer_layout');

	const me = useMe();

	// All default values from the settings should go here - Memoized to prevent re-renders
	const context: ITimerContext = useMemo(() => ({
		cubeType,
		scrambleSubset,
		scrambleTopColor,
		...timerStore,
		...props,
		timerLayout,
	}), [cubeType, scrambleSubset, scrambleTopColor, timerStore, props, timerLayout]);

	// Event listeners for single and AVG PBs
	listenForPbEvents(context);

	// Initiating timer stuff
	useEffect(() => {
		toggleHtmlOverflow('hidden');
		initTimer(dispatch, context);
		keepScreenAwake();

		setLoading(false);

		// Go back to the default settings when user leaves page
		return () => {
			stopAllTimers();
			allowScreenSleep();
			dispatch({
				type: 'RESET_TIMER_PARAMS',
			});
			toggleHtmlOverflow('unset');
		};
	}, []);

	function toggleHtmlOverflow(value: string) {
		const html = document.querySelector('html');

		if (html) {
			html.style.overflow = value;
		}
	}

	const smartActive = timerType === 'smart' && is3x3CubeType(cubeType, scrambleSubset) && !manualEntry;

	let smartCubeVisual: ReactNode = null;
	if (smartActive) {
		smartCubeVisual = <SmartCube />;
	}

	if (loading) {
		return null;
	}

	// Main timer area for desktop
	const timeBar = (
		<div className={b('main', { mobile: mobileMode })}>
			<div className={b('main-center')}>
				<TimerScramble />
				<div
					className={b('main-time', {
						smart: smartActive,
					})}
				>
					<TimeDisplay />
					{smartCubeVisual}
				</div>
			</div>
		</div>
	);

	// New vertical layout for mobile
	const mobileTimeBar = (
		<div className={b('mobile-container')}>
			{/* Scrollable content area */}
			<div className={b('mobile-layout', { manual: manualEntry })}>
				{/* Scramble area - text only, click to copy */}
				<MobileTimerScramble />

				{/* Notification zone — only render when notification exists (don't waste space) */}
				{timerStore.notification && (
					<div className={b('notification-zone')}>
						{timerStore.notification}
					</div>
				)}

				{/* Smart cube: LEFT=narrow analysis portal, RIGHT=cube+timer stuck together */}
				{smartActive ? (
					<div className={b('mobile-smart-grid')}>
						<div className={b('mobile-smart-grid-left')}>
							<div id="mobile-smart-phases-container"></div>
						</div>
						<div className={b('mobile-smart-grid-right')}>
							<div className={b('mobile-smart-grid-cube')}>
								{smartCubeVisual}
							</div>
							<div className={`${b('mobile-smart-grid-time')} ${b('main', { mobile: true })}`}>
								<TimeDisplay />
							</div>
						</div>
					</div>
				) : (
					/* Normal mode - timer full width */
					<div className={`${b('mobile-timer', { manual: manualEntry })} ${b('main', { mobile: true })}`}>
						<TimeDisplay />
					</div>
				)}

				{/* Smart cube NOT active - portal in old spot (timer_type=smart but not 3x3 or manual entry) */}
				{mobileMode && timerType === 'smart' && !smartActive && (
					<div id="mobile-smart-phases-container" style={{ width: '100%', padding: '0 10px' }}></div>
				)}

				{/* Control bar */}
				<TimerControls />

				{/* Daily goal progress bar */}
				<DailyGoalProgressBar cubeType={cubeType} scrambleSubset={scrambleSubset} compact />

				{/* Middle panel - Last solves and Scramble visual */}
				<Dashboard />
			</div>

			{/* Fixed bottom stats bar */}
			<StatsBar />
		</div>
	);

	// In mobile mode, TimeBar should always be at top, Footer at bottom
	const renderFirst = (mobileMode || timerLayout !== 'left') ? timeBar : <TimerFooter />;
	const renderSecond = (mobileMode || timerLayout !== 'left') ? <TimerFooter /> : timeBar;

	let body = (
		<>
			{renderFirst}
			<DailyGoalProgressBar cubeType={cubeType} scrambleSubset={scrambleSubset} />
			{renderSecond}
		</>
	);

	// In mobile mode, use new layout (use PC layout in match mode)
	if (mobileMode && !props.inModal) {
		body = mobileTimeBar;
	}

	let background: ReactNode = null;
	const backgroundPath = me?.timer_background?.storage_path;

	if (backgroundPath) {
		const backgroundUrl = getStorageURL(backgroundPath);
		background = <img alt="Timer background" src={backgroundUrl} className={b('background')} />;
	}

	return (
		<QuickControlsProvider>
			<h1 className="sr-only">Rubik's Cube Timer - Zkt Timer</h1>
			<div
				className={b({
					started: !!context.timeStartedAt,
					mobile: mobileMode && !props.inModal,
				})}
			>
				<TimerContext.Provider value={context}>
					<KeyWatcher>
						<HeaderControl />
						{/* On mobile, while timer running, tap entire screen to stop or cancel Inspection */}
						{mobileMode && (
							<div
								className={b('touch-overlay', { active: !!context.timeStartedAt || !!context.inInspection })}
								onTouchStart={(e) => {
									if (context.inInspection) {
										// Store start point for swipe
										// @ts-ignore
										e.target.touchStartY = e.touches[0].clientY;
									}
								}}
								onTouchEnd={(e) => {
									if (context.timeStartedAt) {
										// Don't stop timer on touch when smart cube auto-detect is active
										const isSmartAutoDetect = smartCubeSelected(context) && !useSpaceWithSmartCube;
										if (!isSmartAutoDetect) {
											endTimer(context);
										}
									} else if (context.inInspection) {
										// Detect swipe up
										// @ts-ignore
										const startY = e.target.touchStartY;
										const endY = e.changedTouches[0].clientY;
										if (startY - endY > 50) { // 50px upward swipe
											clearInspectionTimers(true, true);
										}
									}
								}}
							/>
						)}
						<div
							className={b('wrapper', {
								[timerLayout || 'bottom']: true,
								mobileFooterHidden: hideMobileTimerFooter && mobileMode,
								mobileNewLayout: mobileMode,
							})}
						>
							{body}
							</div>
						</KeyWatcher>
					<QuickControlsModal />
				</TimerContext.Provider>
				{background}
			</div>
		</QuickControlsProvider>
	);
}
