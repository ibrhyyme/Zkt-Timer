import React, {createContext, ReactNode, useEffect, useState} from 'react';
import {RootStateOrAny, useDispatch, useSelector} from 'react-redux';
import './Timer.scss';
import {ArrowRight, CaretUp, CaretDown} from 'phosphor-react';
import HeaderControl from './header_control/HeaderControl';
import TimerFooter from './footer/TimerFooter';
import TimeDisplay from './time_display/TimeDisplay';
import TimerScramble from './time_display/timer_scramble/TimerScramble';
import KeyWatcher from './key_watcher/KeyWatcher';
import {TimerProps, TimerStore} from './@types/interfaces';
import {getStorageURL} from '../../util/storage';
import block from '../../styles/bem';
import {useGeneral} from '../../util/hooks/useGeneral';
import {useMe} from '../../util/hooks/useMe';
import {initTimer} from './helpers/init';
import {stopAllTimers} from './helpers/timers';
import {useSettings} from '../../util/hooks/useSettings';
import {listenForPbEvents} from './helpers/pb';
import {useWindowListener} from '../../util/hooks/useListener';
import SmartCube from './smart_cube/SmartCube';
import {Link} from 'react-router-dom';
import {isNotPro} from '../../util/pro';
import {QuickControlsProvider} from '../quick-controls/useQuickControlsModal';
import QuickControlsModal from '../quick-controls/QuickControlsModal';
import Button from '../common/button/Button';
import {setSetting} from '../../db/settings/update';

const b = block('timer');

export interface ITimerContext extends TimerProps, TimerStore {}

export const TimerContext = createContext<ITimerContext>(null);

export default function Timer(props: TimerProps) {
	const dispatch = useDispatch();

	const [loading, setLoading] = useState(true);
	const timerStore = useSelector((state: RootStateOrAny) => state.timer) as TimerStore;
	const mobileMode = useGeneral('mobile_mode');
	const cubeType = useSettings('cube_type');
	const hideMobileTimerFooter = useSettings('hide_mobile_timer_footer');
	const timerType = useSettings('timer_type');
	const focusMode = useSettings('focus_mode');
	let timerLayout = props.timerLayout || useSettings('timer_layout');

	const [heightSmall, setHeightSmall] = useState(false);
	const [widthSmall, setWidthSmall] = useState(false);

	// Tarayıcı çok küçükse otomatik bottom layout
	if ((timerLayout === 'left' || timerLayout === 'right') && widthSmall && !mobileMode) {
		timerLayout = 'bottom';
	}

	if (timerLayout === 'bottom' && heightSmall && !mobileMode && !widthSmall) {
		timerLayout = 'right';
	}

	if (mobileMode) {
		timerLayout = 'bottom';
	}

	const me = useMe();

	// All default values from the settings should go here
	const context: ITimerContext = {
		cubeType,
		focusMode,
		...timerStore,
		...props,
		timerLayout,
	};

	// Event listeners for single and AVG PBs
	listenForPbEvents(context);
	useWindowListener('resize', windowResize);

	// Initiating timer stuff
	useEffect(() => {
		toggleHtmlOverflow('hidden');
		initTimer(dispatch, context);
		windowResize();

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

	function windowResize() {
		// Height kontrolü
		if (window.innerHeight <= 780 && !heightSmall) {
			setHeightSmall(true);
		} else if (window.innerHeight > 780 && heightSmall) {
			setHeightSmall(false);
		}
		
		// Width kontrolü - 1200px altında bottom layout'a geç
		if (window.innerWidth <= 1200 && !widthSmall) {
			setWidthSmall(true);
		} else if (window.innerWidth > 1200 && widthSmall) {
			setWidthSmall(false);
		}
	}

	function toggleMobileHideButton() {
		setSetting('hide_mobile_timer_footer', !hideMobileTimerFooter);
	}

	let smartCubeVisual: ReactNode = null;
	if (timerType === 'smart' && cubeType === '333') {
		smartCubeVisual = <SmartCube />;
	}

	if (loading) {
		return null;
	}

	// Pro features are now available to everyone
	let timerFooterAd = null;

	// Mobile footer toggle button
	let mobileFooterToggle = null;
	if (mobileMode && !context.focusMode) {
		mobileFooterToggle = (
			<div className={b('mobile-footer-toggle')}>
				<Button
					text={hideMobileTimerFooter ? 'Çözümler Göster' : 'Çözümler Gizle'}
					icon={hideMobileTimerFooter ? <CaretUp /> : <CaretDown />}
					onClick={toggleMobileHideButton}
					white
					flat
				/>
			</div>
		);
	}

	const timeBar = (
		<div className={b('main', {mobile: mobileMode})}>
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
			{timerFooterAd}
			{mobileFooterToggle}
		</div>
	);

	let body = (
		<>
			{timerLayout === 'left' ? <TimerFooter /> : timeBar}
			{timerLayout === 'left' ? timeBar : <TimerFooter />}
		</>
	);

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
					mobile: mobileMode,
					focused: context.focusMode && !mobileMode,
					focusedWeb: context.focusMode && !mobileMode,
				})}
			>
				<TimerContext.Provider value={context}>
					<KeyWatcher>
						<HeaderControl />
						<div
							className={b('wrapper', {
								[timerLayout || 'bottom']: true,
								mobileFooterHidden: hideMobileTimerFooter && mobileMode,
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
