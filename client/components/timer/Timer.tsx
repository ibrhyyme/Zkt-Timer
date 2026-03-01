import React, { createContext, ReactNode, useEffect, useState, useMemo } from 'react';
import { RootStateOrAny, useDispatch, useSelector, shallowEqual } from 'react-redux';
import './Timer.scss';
import { ArrowRight, CaretUp, CaretDown } from 'phosphor-react';
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
import { smartCubeSelected } from './helpers/util';
import { listenForPbEvents } from './helpers/pb';
import { useStableViewportHeight } from '../../util/hooks/useStableViewportHeight';
import SmartCube from './smart_cube/SmartCube';
import { Link } from 'react-router-dom';
import { isNotPro } from '../../util/pro';
import { QuickControlsProvider } from '../quick-controls/useQuickControlsModal';
import QuickControlsModal from '../quick-controls/QuickControlsModal';
import Button from '../common/button/Button';
import { setSetting } from '../../db/settings/update';
// Yeni mobil layout componentleri
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
	const focusMode = useSettings('focus_mode');
	const useSpaceWithSmartCube = useSettings('use_space_with_smart_cube');
	const scrambleSubset = useSettings('scramble_subset');
	let timerLayout = props.timerLayout || useSettings('timer_layout');

	const me = useMe();

	// All default values from the settings should go here - Memoized to prevent re-renders
	const context: ITimerContext = useMemo(() => ({
		cubeType,
		focusMode,
		scrambleSubset,
		...timerStore,
		...props,
		timerLayout,
	}), [cubeType, focusMode, scrambleSubset, timerStore, props, timerLayout]);

	// Event listeners for single and AVG PBs
	listenForPbEvents(context);

	// Initiating timer stuff
	useEffect(() => {
		toggleHtmlOverflow('hidden');
		initTimer(dispatch, context);

		setLoading(false);

		// Go back to the default settings when user leaves page
		return () => {
			stopAllTimers();
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

	let smartCubeVisual: ReactNode = null;
	if (timerType === 'smart' && cubeType === '333') {
		smartCubeVisual = <SmartCube />;
	}

	if (loading) {
		return null;
	}

	// Masaüstü için ana timer alanı
	const timeBar = (
		<div className={b('main', { mobile: mobileMode })}>
			<div className={b('main-center')}>
				<TimerScramble />
				<div
					className={b('main-time', {
						smart: timerType === 'smart' && cubeType === '333',
					})}
				>
					<TimeDisplay />
					{smartCubeVisual}
				</div>
			</div>
		</div>
	);

	// Mobil için yeni vertical layout
	const mobileTimeBar = (
		<div className={b('mobile-container')}>
			{/* Scroll edilebilir içerik alanı */}
			<div className={b('mobile-layout')}>
				{/* Scramble alanı - sadece metin, tıkla kopyala */}
				<MobileTimerScramble />

				{/* Akıllı küp modunda timer ve küp yan yana, normal modda sadece timer */}
				{timerType === 'smart' && cubeType === '333' ? (
					<div className={b('mobile-smart-row')}>
						{/* Timer alanı - sol taraf */}
						<div className={`${b('mobile-timer', { smart: true })} ${b('main', { mobile: true })}`}>
							<TimeDisplay />
						</div>
						{/* SmartCube alanı - sağ taraf */}
						<div className={b('mobile-smart-cube')}>
							{smartCubeVisual}
						</div>
					</div>
				) : (
					/* Normal mod - timer tam genişlik */
					<div className={`${b('mobile-timer')} ${b('main', { mobile: true })}`}>
						<TimeDisplay />
					</div>
				)}

				{/* Mobile Smart Phases Portal Container */}
				{mobileMode && timerType === 'smart' && (
					<div id="mobile-smart-phases-container" style={{ width: '100%', padding: '0 10px' }}></div>
				)}

				{/* Kontrol çubuğu */}
				<TimerControls />

				{/* Orta panel - Son çözümler ve Scramble görseli */}
				<Dashboard />
			</div>

			{/* Sabit alt istatistik çubuğu */}
			<StatsBar />
		</div>
	);

	// Mobil modda her zaman TimeBar üstte, Footer altta olmalı
	const renderFirst = (mobileMode || timerLayout !== 'left') ? timeBar : <TimerFooter />;
	const renderSecond = (mobileMode || timerLayout !== 'left') ? <TimerFooter /> : timeBar;

	let body = (
		<>
			{renderFirst}
			{renderSecond}
		</>
	);

	// Mobil modda yeni layout'u kullan (maç modunda PC layout kullan)
	if (mobileMode && !props.inModal) {
		body = mobileTimeBar;
	}

	if (context.focusMode) {
		body = timeBar;
	}

	let background: ReactNode = null;
	const backgroundPath = me?.timer_background?.storage_path;

	if (backgroundPath) {
		const backgroundUrl = getStorageURL(backgroundPath);
		background = <img alt="Timer background" src={backgroundUrl} className={b('background')} />;
	}

	return (
		<QuickControlsProvider>
			<div
				className={b({
					started: !!context.timeStartedAt,
					mobile: mobileMode && !props.inModal,
					focused: context.focusMode && !mobileMode,
					focusedWeb: context.focusMode && !mobileMode,
				})}
			>
				<TimerContext.Provider value={context}>
					<KeyWatcher>
						<HeaderControl />
						<HeaderControl />
						{/* Timer çalışırken mobilde tüm ekrana dokunarak durdurma overlay'i ve Inspection iptali */}
						{mobileMode && (
							<div
								className={b('touch-overlay', { active: !!context.timeStartedAt || !!context.inInspection })}
								onTouchStart={(e) => {
									if (context.inInspection) {
										// Swipe için başlangıç noktasını kaydet
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
										// Swipe yukarı algıla
										// @ts-ignore
										const startY = e.target.touchStartY;
										const endY = e.changedTouches[0].clientY;
										if (startY - endY > 50) { // 50px yukarı kaydırma
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
