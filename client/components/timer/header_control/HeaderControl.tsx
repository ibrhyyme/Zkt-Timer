import React, {useContext, useEffect, useState} from 'react';
import './HeaderControl.scss';
import {MagnifyingGlassPlus, FrameCorners, CrosshairSimple, Keyboard, Plus, X, CaretDown} from 'phosphor-react';
import {GlobalHotKeys} from 'react-hotkeys';
import {setCubeType, setSetting} from '../../../db/settings/update';
import CubePicker from '../../common/cube_picker/CubePicker';
import SessionSwitcher from '../../sessions/SessionPicker';
import {HOTKEY_MAP} from '../../../util/timer/hotkeys';
import CreateNewSession from '../../sessions/new_session/CreateNewSession';
import {openModal} from '../../../actions/general';
import Dropdown from '../../common/inputs/dropdown/Dropdown';
import {TimerContext} from '../Timer';
import {toggleSetting} from '../../../db/settings/update';
import {useDispatch} from 'react-redux';
import {useGeneral} from '../../../util/hooks/useGeneral';
import {smartCubeSelected} from '../helpers/util';
import Button from '../../common/button/Button';
import block from '../../../styles/bem';
import StackMatPicker from '../../settings/stackmat_picker/StackMatPicker';
import {TIMER_INPUT_TYPE_NAMES} from '../../settings/timer/TimerSettings';
import {useSettings} from '../../../util/hooks/useSettings';
import {AllSettings} from '../../../db/settings/query';
import {useMe} from '../../../util/hooks/useMe';
import screenfull from '../../../util/vendor/screenfull';
import {useQuickControlsModal} from '../../quick-controls/useQuickControlsModal';

const b = block('timer-header-control');

export default function HeaderControl() {
	const dispatch = useDispatch();
	const quickControls = useQuickControlsModal();

	const me = useMe();
	const context = useContext(TimerContext);
	const {focusMode, cubeType} = context;
	const headerOptions = context.headerOptions || {};

	const mobileMode = useGeneral('mobile_mode');
	const manualEntry = useSettings('manual_entry');
	const inspection = useSettings('inspection');
	const timerType = useSettings('timer_type');

	const [fullScreenMode, setFullScreenMode] = useState(false);
	if (screenfull.isEnabled) {
		useEffect(() => {
			const updateFullScreenState = () => setFullScreenMode(screenfull.isFullscreen);
			updateFullScreenState();
			screenfull.on('change', updateFullScreenState);
			return () => screenfull.off('change', updateFullScreenState);
		}, []);
	}

	function toggleCreateNewSession() {
		dispatch(openModal(<CreateNewSession />));
	}

	function changeCubeType(cubeTypeId: string) {
		setCubeType(cubeTypeId);
	}

	function selectTimerType(timerType: AllSettings['timer_type']) {
		setSetting('timer_type', timerType);
	}

	function openStackMat() {
		dispatch(openModal(<StackMatPicker />));
	}

	const handlers = {
		TOGGLE_INSPECTION_MODE: () => toggleSetting('inspection'),
		TOGGLE_FOCUS_MODE: () => toggleSetting('focus_mode'),
		CHANGE_CUBE_222: () => changeCubeType('222'),
		CHANGE_CUBE_333: () => changeCubeType('333'),
		CHANGE_CUBE_444: () => changeCubeType('444'),
		CHANGE_CUBE_555: () => changeCubeType('555'),
		CHANGE_CUBE_666: () => changeCubeType('666'),
		CHANGE_CUBE_777: () => changeCubeType('777'),
		CHANGE_CUBE_PYRAM: () => changeCubeType('pyram'),
		CHANGE_CUBE_MINX: () => changeCubeType('minx'),
		CHANGE_CUBE_CLOCK: () => changeCubeType('clock'),
		CHANGE_CUBE_SKEWB: () => changeCubeType('skewb'),
		CHANGE_CUBE_OTHER: () => changeCubeType('other'),
	};

	const timerTypeName = TIMER_INPUT_TYPE_NAMES[timerType];

	let manualDisabled = false;
	if (smartCubeSelected(context)) {
		manualDisabled = true;
	}

	const cubePicker = !focusMode && !headerOptions.hideCubeType && (
		<CubePicker
			dropdownProps={{openLeft: true, noMargin: true}}
			value={cubeType}
			onChange={(ct) => changeCubeType(ct.id)}
		/>
	);

	// Timer type dropdown moved to Quick Controls modal
	const timerTypeDropdown = null;

	const sessionSwitcher = !focusMode && !headerOptions.hideSessionSelector && <SessionSwitcher />;

	const gearButton = !focusMode && (
		<button
			type="button"
			aria-label="Ayarlar"
			className="ml-3 inline-flex items-center gap-2 h-9 px-3 rounded-lg border transition transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 hover:-translate-y-[1px] active:translate-y-0 text-white/90 hover:text-white bg-white/5 hover:bg-white/10 border-white/10"
			onClick={(e) => {
				e.stopPropagation();
				quickControls.open();
			}}
		>
			{/* Gear icon SVG */}
			<svg className="h-4 w-4 transition-transform hover:rotate-90 duration-300" fill="currentColor" viewBox="0 0 20 20">
				<path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
			</svg>
		</button>
	);

	// Extra features dropdown moved to Quick Controls modal, but keep focus mode exit button
	let topRightButton = null;

	if (focusMode) {
		topRightButton = <Button noMargin transparent icon={<X />} onClick={() => toggleSetting('focus_mode')} />;
	}

	return (
		<GlobalHotKeys handlers={handlers} keyMap={HOTKEY_MAP}>
			<div className={b()}>
				<div>
					{headerOptions?.customHeadersLeft}
					{cubePicker}
					{sessionSwitcher}
					{gearButton}
				</div>
				<div />
				<div>
					{headerOptions?.customHeadersRight}
					{timerTypeDropdown}
					{topRightButton}
				</div>
			</div>
		</GlobalHotKeys>
	);
}
