import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import './HeaderControl.scss';
import { Gear } from 'phosphor-react';
import { GlobalHotKeys } from 'react-hotkeys';
import { setCubeType, setSetting } from '../../../db/settings/update';
import CubePicker from '../../common/cube_picker/CubePicker';
import SessionSwitcher from '../../sessions/SessionPicker';
import { HOTKEY_MAP } from '../../../util/timer/hotkeys';
import CreateNewSession from '../../sessions/new_session/CreateNewSession';
import { openModal } from '../../../actions/general';
import BottomSheetNav from '../../layout/nav/bottom_sheet_nav/BottomSheetNav';
import { TimerContext } from '../Timer';
import { toggleSetting } from '../../../db/settings/update';
import { useDispatch } from 'react-redux';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { smartCubeSelected } from '../helpers/util';
import Button from '../../common/button/Button';
import block from '../../../styles/bem';
import StackMatPicker from '../../settings/stackmat_picker/StackMatPicker';
import { TIMER_INPUT_TYPE_KEYS } from '../../settings/timer/TimerSettings';
import { useSettings } from '../../../util/hooks/useSettings';
import { AllSettings, getSetting } from '../../../db/settings/query';
import { useMe } from '../../../util/hooks/useMe';
import { useQuickControlsModal } from '../../quick-controls/useQuickControlsModal';
import AccountDropdown from '../../layout/nav/account_dropdown/AccountDropdown';
import SubsetPicker from './SubsetPicker';
import { getSubsetsForCube } from '../../../util/cubes/scramble_subsets';
import { getNewScrambleAsync } from '../helpers/scramble';
import { getCubeTypeInfoById } from '../../../util/cubes/util';
import { setTimerParam, setTimerParams } from '../helpers/params';


const b = block('timer-header-control');

export default function HeaderControl() {
	const { t } = useTranslation();
	const dispatch = useDispatch();
	const quickControls = useQuickControlsModal();

	const me = useMe();
	const context = useContext(TimerContext);
	const { cubeType, matchMode } = context;
	const headerOptions = context.headerOptions || {};


	const mobileMode = useGeneral('mobile_mode');
	const manualEntry = useSettings('manual_entry');
	const inspection = useSettings('inspection');
	const timerType = useSettings('timer_type');

	function toggleCreateNewSession() {
		dispatch(openModal(<CreateNewSession />, {
			compact: true,
			width: 420,
			title: t('sessions.create_new_session_title'),
			description: t('sessions.create_new_session_desc'),
			closeButtonText: t('solve_info.done'),
		}));
	}

	function changeCubeType(cubeTypeId: string) {
		setCubeType(cubeTypeId);

		const ct = getCubeTypeInfoById(cubeTypeId);
		if (!ct) return;

		// Yeni cube type'in ilk non-header subset'ini default olarak sec
		const subsets = getSubsetsForCube(cubeTypeId);
		const defaultSubset = subsets.find(s => !s.isHeader);
		const newSubset = defaultSubset ? defaultSubset.id : null;

		setSetting('scramble_subset', newSubset);
		setTimerParam('scrambleSubset', newSubset);

		setTimerParams({ scramble: '', originalScramble: '', smartTurnOffset: 0 });
		getNewScrambleAsync(ct.scramble, newSubset ?? undefined).then((newScramble) => {
			setTimerParams({ scramble: newScramble, originalScramble: newScramble, smartTurnOffset: 0 });
		}).catch((e) => { console.error('[scramble] changeCubeType failed:', e); });
	}

	function handleSubsetChange(subset: string | null) {
		setSetting('scramble_subset', subset);
		setTimerParam('scrambleSubset', subset);

		const ct = getCubeTypeInfoById(cubeType);
		if (ct) {
			setTimerParams({ scramble: '', originalScramble: '', smartTurnOffset: 0 });
			getNewScrambleAsync(ct.scramble, subset).then((newScramble) => {
				setTimerParams({ scramble: newScramble, originalScramble: newScramble, smartTurnOffset: 0 });
			}).catch((e) => { console.error('[scramble] handleSubsetChange failed:', e); });
		}
	}

	function selectTimerType(timerType: AllSettings['timer_type']) {
		setSetting('timer_type', timerType);
	}

	function openStackMat() {
		dispatch(openModal(<StackMatPicker />, { width: 400, compact: true, title: t('stackmat.select_input'), description: t('stackmat.description'), closeButtonText: t('solve_info.done') }));
	}

	const handlers = {
		TOGGLE_INSPECTION_MODE: () => toggleSetting('inspection'),
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

	const timerTypeName = t(TIMER_INPUT_TYPE_KEYS[timerType]);

	let manualDisabled = false;
	if (smartCubeSelected(context)) {
		manualDisabled = true;
	}

	const cubePicker = !headerOptions.hideCubeType && (
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

	const sessionSwitcher = !headerOptions.hideSessionSelector && <SessionSwitcher />;

	// Maç modunda gear butonunu gizle
	const gearButton = !matchMode && (
		<Button
			gray
			icon={<Gear weight="bold" />}
			onClick={(e) => {
				e.stopPropagation();
				quickControls.open();
			}}
		/>
	);

	// Mobile: minimal header with account dropdown on right
	if (mobileMode) {
		return (
			<GlobalHotKeys handlers={handlers} keyMap={HOTKEY_MAP}>
				<div className={b()}>
					<div className={b('left-controls')}>
						{cubePicker}
						{sessionSwitcher}
						{gearButton}
					</div>
					<div />
					<div className={b('right-controls')}>
						{!matchMode && <AccountDropdown />}
					</div>
				</div>
				{!matchMode && <BottomSheetNav />}
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
				</div>
			</div>
		</GlobalHotKeys>
	);
}
