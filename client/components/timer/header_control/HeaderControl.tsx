import React, { useContext, useEffect, useState } from 'react';
import './HeaderControl.scss';
import { MagnifyingGlassPlus, FrameCorners, CrosshairSimple, Keyboard, Plus, X, CaretDown, Gear, List } from 'phosphor-react';
import { GlobalHotKeys } from 'react-hotkeys';
import { setCubeType, setSetting } from '../../../db/settings/update';
import CubePicker from '../../common/cube_picker/CubePicker';
import SessionSwitcher from '../../sessions/SessionPicker';
import { HOTKEY_MAP } from '../../../util/timer/hotkeys';
import CreateNewSession from '../../sessions/new_session/CreateNewSession';
import { openModal } from '../../../actions/general';
import Dropdown from '../../common/inputs/dropdown/Dropdown';
import { TimerContext } from '../Timer';
import { toggleSetting } from '../../../db/settings/update';
import { useDispatch } from 'react-redux';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { smartCubeSelected } from '../helpers/util';
import Button from '../../common/button/Button';
import block from '../../../styles/bem';
import StackMatPicker from '../../settings/stackmat_picker/StackMatPicker';
import { TIMER_INPUT_TYPE_NAMES } from '../../settings/timer/TimerSettings';
import { useSettings } from '../../../util/hooks/useSettings';
import { AllSettings, getSetting } from '../../../db/settings/query';
import { useMe } from '../../../util/hooks/useMe';
import screenfull from '../../../util/vendor/screenfull';
import { useQuickControlsModal } from '../../quick-controls/useQuickControlsModal';
import AccountDropdown from '../../layout/nav/account_dropdown/AccountDropdown';
import { NAV_LINKS } from '../../layout/nav/Nav';
import { useRouteMatch } from 'react-router-dom';
import SubsetPicker from './SubsetPicker';
import { getSubsetsForCube } from '../../../util/cubes/scramble_subsets';
import { getNewScramble } from '../helpers/scramble';
import { getCubeTypeInfoById } from '../../../util/cubes/util';
import { setTimerParam, setTimerParams } from '../helpers/params';


const b = block('timer-header-control');

export default function HeaderControl() {
	const dispatch = useDispatch();
	const quickControls = useQuickControlsModal();

	const me = useMe();
	const context = useContext(TimerContext);
	const { focusMode, cubeType, matchMode } = context;
	const headerOptions = context.headerOptions || {};
	const match = useRouteMatch();

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
		// Küp değiştiğinde subset'i sıfırla
		setSetting('scramble_subset', null);
	}

	function handleSubsetChange(subset: string | null) {
		setSetting('scramble_subset', subset);
		setTimerParam('scrambleSubset', subset);

		const ct = getCubeTypeInfoById(cubeType);
		if (ct) {
			const newScramble = getNewScramble(ct.scramble, undefined, subset);
			setTimerParams({ scramble: newScramble, originalScramble: newScramble, smartTurnOffset: 0 });
		}
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
		<div className="flex items-center gap-2">
			<CubePicker
				dropdownProps={{ openLeft: true, noMargin: true }}
				value={cubeType}
				onChange={(ct) => changeCubeType(ct.id)}
			/>
			<SubsetPicker
				subsets={getSubsetsForCube(cubeType)}
				selectedSubset={useSettings('scramble_subset')}
				onChange={handleSubsetChange}
				mobile={mobileMode}
			/>
		</div>
	);

	// Timer type dropdown moved to Quick Controls modal
	const timerTypeDropdown = null;

	const sessionSwitcher = !focusMode && !headerOptions.hideSessionSelector && <SessionSwitcher />;

	// Maç modunda gear butonunu gizle
	const gearButton = !focusMode && !matchMode && (
		<Button
			gray
			icon={<Gear weight="bold" />}
			onClick={(e) => {
				e.stopPropagation();
				quickControls.open();
			}}
		/>
	);

	// Extra features dropdown moved to Quick Controls modal, but keep focus mode exit button
	let topRightButton = null;

	if (focusMode) {
		topRightButton = <Button noMargin transparent icon={<X />} onClick={() => toggleSetting('focus_mode')} />;
	}

	// Mobile: minimal header with account dropdown on right
	if (mobileMode && !focusMode) {
		// Hamburger menu için NAV_LINKS
		const navOptions = NAV_LINKS.map((link) => ({
			link: link.link,
			text: link.name,
			icon: link.icon,
			disabled: link.match.test(match.path),
		}));

		// Maç modunda hamburger menüyü gizle
		const hamburgerMenu = !matchMode && (
			<Dropdown
				icon={<List />}
				dropdownButtonProps={{ gray: true }}
				options={navOptions}
			/>
		);

		return (
			<GlobalHotKeys handlers={handlers} keyMap={HOTKEY_MAP}>
				<div className={b()}>
					<div className={b('left-controls')}>
						{cubePicker}
						{sessionSwitcher}
						{gearButton}
						{hamburgerMenu}
					</div>
					<div />
					<div className={b('right-controls')}>
						{!matchMode && <AccountDropdown />}
					</div>
				</div>
			</GlobalHotKeys>
		);
	}

	return (
		<GlobalHotKeys handlers={handlers} keyMap={HOTKEY_MAP}>
			<div className={b()}>
				<div className={b('left-controls')}>
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
