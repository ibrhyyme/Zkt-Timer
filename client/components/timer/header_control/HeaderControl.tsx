import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import './HeaderControl.scss';
import { GlobalHotKeys } from 'react-hotkeys';
import { setCubeType, setSetting } from '../../../db/settings/update';
import CubePicker from '../../common/cube_picker/CubePicker';
import SessionSwitcher from '../../sessions/SessionPicker';
import { HOTKEY_MAP } from '../../../util/timer/hotkeys';
import CreateNewSession from '../../sessions/new_session/CreateNewSession';
import { openModal } from '../../../actions/general';
import BottomSheetNav from '../../layout/nav/bottom_sheet_nav/BottomSheetNav';
import LeftSettingsDrawer from '../../layout/nav/left_settings_drawer/LeftSettingsDrawer';
import { TimerContext } from '../Timer';
import { toggleSetting } from '../../../db/settings/update';
import { useDispatch } from 'react-redux';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { smartCubeSelected } from '../helpers/util';
import block from '../../../styles/bem';
import StackMatPicker from '../../settings/stackmat_picker/StackMatPicker';
import { TIMER_INPUT_TYPE_KEYS } from '../../settings/timer/TimerSettings';
import { useSettings } from '../../../util/hooks/useSettings';
import { AllSettings, getSetting } from '../../../db/settings/query';
import { useMe } from '../../../util/hooks/useMe';
import AccountDropdown from '../../layout/nav/account_dropdown/AccountDropdown';
import SubsetPicker from './SubsetPicker';
import CrossColorPicker from './CrossColorPicker';
import TimerTypePicker from './TimerTypePicker';
import SettingsDropdown from '../../quick-controls/SettingsDropdown';
import { getSubsetsForCube } from '../../../util/cubes/scramble_subsets';
import { getNewScrambleAsync } from '../helpers/scramble';
import { getCubeTypeInfoById } from '../../../util/cubes/util';
import { setTimerParam, setTimerParams } from '../helpers/params';
import { setScrambleTopColor } from '../../../db/settings/update';
import { applyTopColorTransform, isTopColorAvailable, isTopColorFace, TopColorFace } from '../../../util/scramble_transform';


const b = block('timer-header-control');

export default function HeaderControl() {
	const { t } = useTranslation();
	const dispatch = useDispatch();

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

	const scrambleTopColorSetting = useSettings('scramble_top_color');

	/**
	 * Top color selection is only active for 3x3 CFOP + PLL/OLL/f2l subsets.
	 * If not active, returns null — applyTopColorTransform returns raw scramble.
	 */
	function getEffectiveTopColor(ct: string, sub: string | null | undefined): TopColorFace | null {
		if (!isTopColorAvailable(ct, sub)) return null;
		return isTopColorFace(scrambleTopColorSetting) ? scrambleTopColorSetting : null;
	}

	async function generateAndSet(scrambleType: string, subset: string | null | undefined, topColor: TopColorFace | null) {
		try {
			const raw = await getNewScrambleAsync(scrambleType, subset ?? undefined);
			const transformed = await applyTopColorTransform(raw, topColor);
			setTimerParams({ scramble: transformed, originalScramble: transformed, smartTurnOffset: 0 });
		} catch (e) {
			console.error('[scramble] generateAndSet failed:', e);
		}
	}

	function changeCubeType(cubeTypeId: string) {
		setCubeType(cubeTypeId);

		const ct = getCubeTypeInfoById(cubeTypeId);
		if (!ct) return;

		// Select the first non-header subset of the new cube type as default
		const subsets = getSubsetsForCube(cubeTypeId);
		const defaultSubset = subsets.find(s => !s.isHeader);
		const newSubset = defaultSubset ? defaultSubset.id : null;

		setSetting('scramble_subset', newSubset);
		setTimerParam('scrambleSubset', newSubset);

		setTimerParams({ scramble: '', originalScramble: '', smartTurnOffset: 0 });
		const topColor = getEffectiveTopColor(cubeTypeId, newSubset);
		generateAndSet(ct.scramble, newSubset, topColor);
	}

	function handleSubsetChange(subset: string | null) {
		setSetting('scramble_subset', subset);
		setTimerParam('scrambleSubset', subset);

		const ct = getCubeTypeInfoById(cubeType);
		if (ct) {
			setTimerParams({ scramble: '', originalScramble: '', smartTurnOffset: 0 });
			const topColor = getEffectiveTopColor(cubeType, subset);
			generateAndSet(ct.scramble, subset, topColor);
		}
	}

	function handleColorChange(color: TopColorFace) {
		setScrambleTopColor(color);

		const ct = getCubeTypeInfoById(cubeType);
		const curSubset = getSetting('scramble_subset') as string | null | undefined;
		if (ct) {
			setTimerParams({ scramble: '', originalScramble: '', smartTurnOffset: 0 });
			const topColor = isTopColorAvailable(cubeType, curSubset) ? color : null;
			generateAndSet(ct.scramble, curSubset, topColor);
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

	const currentScrambleSubset = useSettings('scramble_subset');
	const showCrossColorPicker = isTopColorAvailable(cubeType, currentScrambleSubset);
	const currentTopColor: TopColorFace | null = isTopColorFace(scrambleTopColorSetting)
		? scrambleTopColorSetting
		: null;

	const cubePicker = !headerOptions.hideCubeType && (
		<div className="flex items-center gap-2">
			<CubePicker
				dropdownProps={{ openLeft: true, noMargin: true }}
				value={cubeType}
				onChange={(ct) => changeCubeType(ct.id)}
			/>
			<SubsetPicker
				subsets={getSubsetsForCube(cubeType)}
				selectedSubset={currentScrambleSubset}
				onChange={handleSubsetChange}
				mobile={mobileMode}
				cubeTypeId={cubeType}
			/>
			{showCrossColorPicker && (
				<CrossColorPicker
					value={currentTopColor}
					onChange={handleColorChange}
					mobile={mobileMode}
				/>
			)}
		</div>
	);

	// Timer type dropdown: on desktop in header TimerTypePicker (left group, before gear).
	// On mobile hidden — modal's Timer tab is used (TimerTypePicker.scss media query).
	const timerTypeDropdown = !matchMode && <TimerTypePicker />;

	const sessionSwitcher = !headerOptions.hideSessionSelector && <SessionSwitcher />;

	// Desktop gear: SettingsDropdown (Popover panel + tab switcher).
	// Mobile gear: kaldirildi — sol drawer (LeftSettingsDrawer) bunun yerini aldi.
	const gearButtonDesktop = !matchMode && <SettingsDropdown />;

	// Mobile: minimal header with account dropdown on right
	if (mobileMode) {
		return (
			<GlobalHotKeys handlers={handlers} keyMap={HOTKEY_MAP}>
				<div className={b()}>
					<div className={b('left-controls')}>
						{cubePicker}
						{sessionSwitcher}
					</div>
					<div />
					<div className={b('right-controls')}>
						{!matchMode && <AccountDropdown />}
					</div>
				</div>
				{!matchMode && <BottomSheetNav />}
				{!matchMode && <LeftSettingsDrawer />}
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
					{timerTypeDropdown}
					{gearButtonDesktop}
				</div>
				<div />
				<div>
					{headerOptions?.customHeadersRight}
				</div>
			</div>
		</GlobalHotKeys>
	);
}
