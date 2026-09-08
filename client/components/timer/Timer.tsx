import React, { createContext, ReactNode, useEffect, useState, useMemo, useRef } from 'react';
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
import { canUseStreamerMode } from '../../lib/streamer-mode';
import { initTimer } from './helpers/init';
import { stopAllTimers, clearInspectionTimers } from './helpers/timers';
import { useSettings } from '../../util/hooks/useSettings';
import { is3x3CubeType } from './helpers/util';
import { useNormalizeTimerType } from './helpers/timer_type_support';
import { virtualCubeSupports } from '../../util/virtual_cube/size';
import { useVirtualCubeSize } from '../../util/virtual_cube/useVirtualCubeSize';
import VirtualCube from './virtual_cube/VirtualCube';
import { listenForPbEvents } from './helpers/pb';
import { useStableViewportHeight } from '../../util/hooks/useStableViewportHeight';
import SmartCube from './smart_cube/SmartCube';
import DailyGoalProgressBar from '../daily-goal/DailyGoalProgressBar';
import { keepScreenAwake, allowScreenSleep } from '../../util/native-plugins';
// New mobile layout components
import TimerControls from './TimerControls';
import Dashboard from './Dashboard';
import StatsBar from './StatsBar';
import MobileTimerScramble from './MobileTimerScramble';
import { isCancelSwipe } from './helpers/touch_gesture';
import StreamerOverlay from './streamer/StreamerOverlay';

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
	const scrambleSubset = useSettings('scramble_subset');
	const scrambleTopColor = useSettings('scramble_top_color');
	const streamerMode = useSettings('streamer_mode');
	let timerLayout = props.timerLayout || useSettings('timer_layout');

	const me = useMe();

	// Where the finger landed on the full-screen overlay, for the swipe-up that cancels
	// inspection. Kept in a ref rather than stamped onto the DOM node, so a value left
	// over from an earlier gesture can never be read as this one's starting point.
	const overlayTouchStart = useRef<{ x: number; y: number } | null>(null);

	// Streamer Mode strips the page down to scramble + giant timer + corner
	// mini-history. Gate the live flag once so the root class, the body class
	// (used to hide chrome that lives OUTSIDE this component) and the overlay all
	// agree.
	const isStreamer = !!streamerMode && canUseStreamerMode(me);

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

	// Switching to a puzzle the selected input cannot handle resets the input to the
	// keyboard, so the pickers always show something real as selected. SmartCube
	// disconnects in its own unmount cleanup once the setting flips.
	useNormalizeTimerType(cubeType, scrambleSubset);

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

	// Toggle a body class while Streamer Mode is on. The desktop header nav and the
	// portaled mobile edge-drawers live OUTSIDE this component's DOM subtree, so a
	// class on the timer root can't reach them — a body-level signal can.
	useEffect(() => {
		document.body.classList.toggle('streamer-mode-active', isStreamer);
		return () => {
			document.body.classList.remove('streamer-mode-active');
		};
	}, [isStreamer]);

	// Desktop-only immersive background: when the user has a Pro timer background image,
	// let it bleed up behind the global HeaderNav (which lives OUTSIDE this component's
	// subtree, so only a body-level class can reach it) — makes the whole screen feel
	// covered instead of the image starting below the nav bar. Mobile is handled
	// separately by the timer's own in-subtree header, so scope this to desktop.
	const hasBackgroundImage = !!me?.timer_background?.storage_path;
	useEffect(() => {
		const immersive = hasBackgroundImage && !mobileMode;
		document.body.classList.toggle('timer-immersive-bg', immersive);
		return () => {
			document.body.classList.remove('timer-immersive-bg');
		};
	}, [hasBackgroundImage, mobileMode]);

	const smartActive = timerType === 'smart' && is3x3CubeType(cubeType, scrambleSubset) && !manualEntry;
	// The virtual cube only implements NxN, so a non-cube bucket falls back to the
	// plain timer exactly as an unsupported smart cube bucket already does.
	const virtualActive =
		timerType === 'virtual' && virtualCubeSupports(cubeType, scrambleSubset) && !manualEntry;

	let smartCubeVisual: ReactNode = null;
	if (smartActive) {
		smartCubeVisual = <SmartCube />;
	}

	const virtualFocus = virtualActive && (!!context.virtualArmed || !!context.timeStartedAt);
	const virtualCubeSize = useVirtualCubeSize(mobileMode, virtualFocus);

	let virtualCubeVisual: ReactNode = null;
	if (virtualActive) {
		virtualCubeVisual = <VirtualCube />;
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
						virtual: virtualActive,
					})}
					// The layout places the digits against the cube's left edge, so it
					// needs the cube's actual size. Same number the cube renders at,
					// from the same helper, so the two can never drift apart.
					style={
						virtualActive
							? ({ '--zt-vc-size': `${virtualCubeSize}px` } as React.CSSProperties)
							: undefined
					}
				>
					<TimeDisplay />
					{smartCubeVisual}
					{virtualCubeVisual}
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
				) : virtualActive ? (
					/* Virtual cube uses the SAME wrapper the desktop layout does, and
					   carries the same size variable. One set of rules then covers both
					   platforms — mounting it somewhere else meant none of the virtual
					   cube's layout rules matched on mobile at all. */
					<div
						className={`${b('main-time', { virtual: true })} ${b('main', { mobile: true })}`}
						style={{ '--zt-vc-size': `${virtualCubeSize}px` } as React.CSSProperties}
					>
						<TimeDisplay />
						{virtualCubeVisual}
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

	// Desktop: timer + daily-goal bar travel together as a single "timer side" so the
	// row layouts (left/right) stay a clean 2-column flex (timer-side | footer) and the
	// full-width daily-goal bar never wedges itself between the columns.
	const timerSide = (
		<div className={b('timer-side')}>
			{timeBar}
			<DailyGoalProgressBar cubeType={cubeType} scrambleSubset={scrambleSubset} />
		</div>
	);

	// In mobile mode, TimeBar should always be at top, Footer at bottom.
	// In 'left' layout the footer column comes first (left), timer side second (right).
	const renderFirst = (mobileMode || timerLayout !== 'left') ? timerSide : <TimerFooter />;
	const renderSecond = (mobileMode || timerLayout !== 'left') ? <TimerFooter /> : timerSide;

	let body = (
		<>
			{renderFirst}
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
		<>
			<h1 className="sr-only">Rubik's Cube Timer - Zkt Timer</h1>
			<div
				className={b({
					// Arming the virtual cube counts as started. Once Space applies the
					// scramble the attempt has effectively begun, and the solver should
					// be looking at the cube and nothing else — same chrome-free screen
					// the running timer already produces.
					started: !!context.timeStartedAt || (virtualActive && !!context.virtualArmed),
					mobile: mobileMode && !props.inModal,
					streamerMode: isStreamer,
					// 'left' layout mirrors the header selectors to the right (above the timer column)
					layoutLeft: timerLayout === 'left' && !mobileMode && !props.inModal,
				})}
			>
				<TimerContext.Provider value={context}>
					<KeyWatcher>
						<HeaderControl />
						{isStreamer && <StreamerOverlay />}
						{/* Mobile: catches touches across the whole screen while the timer runs or
							inspection counts down, so KeyWatcher sees them wherever they land. Its
							own handler does one thing: the swipe that abandons inspection. */}
						{mobileMode && (
							<div
								// Never active for the virtual cube. This overlay is a full-screen
								// pointer-events trap at z-index 9999, and for a cube you turn with
								// your finger it is wrong in both states it covers: during the solve
								// it swallows every move, and during inspection it blocks the very
								// rotations inspection exists for. Its own handler only implements
								// the swipe that abandons inspection, and stopping is KeyWatcher's
								// job — which already stands down for this input.
								className={b('touch-overlay', {
									active: (!!context.timeStartedAt || !!context.inInspection) && !virtualActive,
								})}
								onTouchStart={(e) => {
									if (context.inInspection) {
										// Store start point for swipe
										overlayTouchStart.current = {
											x: e.touches[0].clientX,
											y: e.touches[0].clientY,
										};
									}
								}}
								onTouchEnd={(e) => {
									const start = overlayTouchStart.current;
									overlayTouchStart.current = null;

									// Stopping is NOT handled here. KeyWatcher already ends the solve
									// on touchstart, and it is the only place that knows about phase
									// splits: this handler used to end the solve on the release of the
									// very press KeyWatcher had just consumed as a split, so on mobile
									// the first phase press finished the whole solve.
									if (context.inInspection && start) {
										// Swipe up to abandon the inspection, at the same distance that
										// drops a primed hold (see helpers/touch_gesture).
										const end = e.changedTouches[0];
										if (isCancelSwipe(end.clientX - start.x, end.clientY - start.y)) {
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
				</TimerContext.Provider>
				{background}
			</div>
		</>
	);
}
