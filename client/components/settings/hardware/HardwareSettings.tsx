import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import MicAccess from '../mic_access/MicAccess';
import StackMatPicker, { getAudioPickerModalProps } from '../stackmat_picker/StackMatPicker';
import CubeTypes from '../cube_types/CubeTypes';
import { openModal } from '../../../actions/general';
import { setSetting, toggleSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { AllSettings, getDefaultSetting } from '../../../db/settings/query';
import InfoWarningModal from '../../common/info_warning_modal/InfoWarningModal';
import {
	TimerSettingsGroup,
	TimerSettingsToggle,
	TimerSettingsNumber,
	TimerSettingsSelect,
	TimerSettingsAction,
	TimerSettingsSlider,
} from '../timer/TimerSettingsRow';
import { VIRTUAL_PROGRESS_METHODS } from '../../../../shared/util/solve/virtual_progress';
import { timerTypeSupportsBucket } from '../../timer/helpers/timer_type_support';
import { KEYBOARD_LAYOUTS } from '../../../util/virtual_cube/key_mapping';
import { TIMER_INPUT_TYPE_KEYS, TIMER_INPUT_TYPES } from './timer_input_types';

/**
 * cstimer's `vrcSpeed` options. The stored value is the duration of one move in
 * milliseconds; the label is the rate, which is what cstimer puts on screen.
 *
 * The labels are kept identical to cstimer's on purpose: a user comparing the two
 * side by side has to be able to set the same number in both, and a raw "100 ms"
 * cannot be matched against cstimer's "10" without doing arithmetic.
 */
const VIRTUAL_CUBE_SPEEDS: { value: number; label: string }[] = [
	{ value: 0, label: '' }, // labelled "instant" from i18n below
	{ value: 50, label: '20' },
	{ value: 100, label: '10' },
	{ value: 200, label: '5' },
	{ value: 500, label: '2' },
	{ value: 1000, label: '1' },
];

// Shared by HeaderControl to render the active timer type name, and by the help page to
// list the inputs. Moved to timer_input_types.ts so the help page does not have to import
// this whole settings screen; re-exported here for the callers that already had it.
export { TIMER_INPUT_TYPE_KEYS };

export default function HardwareSettings() {
	const { t } = useTranslation();
	const dispatch = useDispatch();
	const mobileMode = useGeneral('mobile_mode');

	// Input
	const timerType = useSettings('timer_type');
	const cubeType = useSettings('cube_type');
	const scrambleSubset = useSettings('scramble_subset');
	const useSpaceWithSmartCube = useSettings('use_space_with_smart_cube');

	// StackMat
	const stackMatId = useSettings('stackmat_id');
	const stackMatAutoInspection = useSettings('stackmat_auto_inspection');
	const stackMatAutoInspectionWarningShown = useSettings('stackmat_auto_inspection_warning_shown');

	// QiYi Timer
	const qiyiAutoInspection = useSettings('qiyi_auto_inspection');
	const qiyiAutoInspectionWarningShown = useSettings('qiyi_auto_inspection_warning_shown');

	// Virtual cube. Its rows only appear while it is the selected input, since the
	// options are meaningless for any other one.
	const virtualCubeSpeed = useSettings('virtual_cube_speed');
	const virtualCubeOrientation = useSettings('virtual_cube_orientation');
	const virtualCubeMultiPhase = useSettings('virtual_cube_multi_phase');
	const virtualCubeKeyboardLayout = useSettings('virtual_cube_keyboard_layout');
	const virtualCubeSize = useSettings('virtual_cube_size');
	const isVirtual = timerType === 'virtual';

	// Smart Cube
	const smartCubeShow = useSettings('smart_cube_show');
	const smartCubeSize = useSettings('smart_cube_size');
	const smartCubeSizeUserDefault = useSettings('smart_cube_size_user_default');
	const smartCubeMoveOrderFix = useSettings('smart_cube_move_order_fix');
	const cubeSizeDefault = smartCubeSizeUserDefault ?? getDefaultSetting('smart_cube_size');

	function updateSetting(name: keyof AllSettings, value: any) {
		setSetting(name, value);
	}

	function showStackmatWarning() {
		dispatch(
			openModal(
				<InfoWarningModal
					stepsHeading={t('timer_settings.stackmat_warning_how_it_works')}
					steps={[
						t('timer_settings.stackmat_warning_step1'),
						t('timer_settings.stackmat_warning_step2'),
						t('timer_settings.stackmat_warning_step3'),
					]}
					warning={{
						title: t('timer_settings.stackmat_warning_limitation_title'),
						text: t('timer_settings.stackmat_warning_limitation_desc'),
					}}
					protocolNote={t('timer_settings.stackmat_warning_protocol_note')}
					critical={t('timer_settings.stackmat_warning_critical')}
					showAgainKey="stackmat_auto_inspection_warning_shown"
				/>,
				{
					title: t('timer_settings.stackmat_warning_title'),
					description: t('timer_settings.stackmat_warning_desc'),
				},
			),
		);
	}

	function showQiyiWarning() {
		dispatch(
			openModal(
				<InfoWarningModal
					stepsHeading={t('timer_settings.qiyi_warning_how_it_works')}
					steps={[
						t('timer_settings.qiyi_warning_step1'),
						t('timer_settings.qiyi_warning_step2'),
					]}
					critical={t('timer_settings.qiyi_warning_critical')}
					showAgainKey="qiyi_auto_inspection_warning_shown"
				/>,
				{
					title: t('timer_settings.qiyi_warning_title'),
					description: t('timer_settings.qiyi_warning_desc'),
				},
			),
		);
	}

	function handleAutoInspectionToggle() {
		if (stackMatAutoInspection > 0) {
			setSetting('stackmat_auto_inspection', 0);
		} else {
			setSetting('stackmat_auto_inspection', 2);
			if (!stackMatAutoInspectionWarningShown) {
				showStackmatWarning();
			}
		}
	}

	function handleQiyiAutoInspectionToggle() {
		const next = !qiyiAutoInspection;
		setSetting('qiyi_auto_inspection', next);
		// Only warn when OPENING, not on closing, to avoid bad habits
		if (next && !qiyiAutoInspectionWarningShown) {
			showQiyiWarning();
		}
	}

	function toggleCubeTypes() {
		dispatch(
			openModal(<CubeTypes />, {
				title: t('timer_settings.manage_cube_types'),
				description: t('timer_settings.manage_cube_types_desc'),
			})
		);
	}

	function openStackMatPickerModal() {
		const { title, description } = getAudioPickerModalProps(t);
		dispatch(openModal(<StackMatPicker />, { width: 400, compact: true, title, description, closeButtonText: t('solve_info.done') }));
	}

	function getTimerTypeName(tt: string) {
		if (tt === 'keyboard' && mobileMode) {
			return t('timer_settings.input_touch');
		}
		return t(TIMER_INPUT_TYPE_KEYS[tt]);
	}

	return (
		<div className="space-y-2">
			{/* Input */}
			<TimerSettingsGroup id="hardware-input" label={t('timer_settings.category_input')}>
				<TimerSettingsSelect
					label={t('timer_settings.input_type')}
					description={t('timer_settings.input_type_desc')}
					value={timerType}
					// Inputs the current puzzle cannot drive are not offered. Without this
					// the settings screen was the one place that could still set an
					// unsupported input, which the timer would then immediately reset.
					options={TIMER_INPUT_TYPES.filter((c) =>
						timerTypeSupportsBucket(c, cubeType, scrambleSubset)
					).map((c) => ({
						label: getTimerTypeName(c),
						value: c,
					}))}
					onChange={(v) => setSetting('timer_type', v as AllSettings['timer_type'])}
				/>
				<TimerSettingsAction
					label={t('timer_settings.cube_types')}
					description={t('timer_settings.cube_types_desc')}
				>
					<button
						type="button"
						onClick={toggleCubeTypes}
						className="px-3 py-1.5 rounded-lg text-sm font-medium bg-button border border-text/[0.1] text-text hover:bg-button hover:border-text/[0.15] transition-all duration-200 cursor-pointer"
					>
						{t('timer_settings.manage_cube_types')}
					</button>
				</TimerSettingsAction>
				<TimerSettingsToggle
					label={t('timer_settings.use_space_with_smart_cube')}
					description={t('timer_settings.use_space_with_smart_cube_desc')}
					isActive={useSpaceWithSmartCube}
					onClick={() => toggleSetting('use_space_with_smart_cube')}
				/>
			</TimerSettingsGroup>

			{/* Virtual cube */}
			<TimerSettingsGroup
				id="hardware-virtual-cube"
				label={t('timer_settings.category_virtual_cube')}
			>
				<TimerSettingsSelect
					label={t('timer_settings.virtual_cube_speed')}
					description={t('timer_settings.virtual_cube_speed_desc')}
					value={String(virtualCubeSpeed)}
					options={VIRTUAL_CUBE_SPEEDS.map((s) => ({
						label: s.value === 0 ? t('timer_settings.virtual_cube_speed_instant') : s.label,
						value: String(s.value),
					}))}
					hidden={!isVirtual}
					onChange={(v) => setSetting('virtual_cube_speed', parseInt(v, 10))}
				/>
				<TimerSettingsSelect
					label={t('timer_settings.virtual_cube_orientation')}
					description={t('timer_settings.virtual_cube_orientation_desc')}
					value={virtualCubeOrientation}
					options={[
						{label: 'UF', value: '6,12'},
						{label: 'URF', value: '10,11'},
					]}
					hidden={!isVirtual}
					onChange={(v) => setSetting('virtual_cube_orientation', v)}
				/>
				<TimerSettingsSelect
					label={t('timer_settings.virtual_cube_multi_phase')}
					description={t('timer_settings.virtual_cube_multi_phase_desc')}
					value={virtualCubeMultiPhase}
					options={VIRTUAL_PROGRESS_METHODS.map((m) => ({
						label: t(`timer_settings.vrc_mp_${m}`),
						value: m,
					}))}
					hidden={!isVirtual}
					onChange={(v) => setSetting('virtual_cube_multi_phase', v)}
				/>
				<TimerSettingsSelect
					label={t('timer_settings.virtual_cube_keyboard_layout')}
					description={t('timer_settings.virtual_cube_keyboard_layout_desc')}
					value={virtualCubeKeyboardLayout}
					options={Object.keys(KEYBOARD_LAYOUTS).map((l) => ({label: l, value: l}))}
					hidden={!isVirtual}
					onChange={(v) => setSetting('virtual_cube_keyboard_layout', v)}
				/>
				<TimerSettingsSlider
					label={t('timer_settings.virtual_cube_size')}
					description={t('timer_settings.virtual_cube_size_desc')}
					value={virtualCubeSize}
					min={120}
					max={700}
					hidden={!isVirtual}
					showReset={virtualCubeSize !== getDefaultSetting('virtual_cube_size')}
					resetLabel={t('appearance.reset')}
					onReset={() =>
						setSetting('virtual_cube_size', getDefaultSetting('virtual_cube_size') as number)
					}
					onChange={(v) => setSetting('virtual_cube_size', v)}
				/>
			</TimerSettingsGroup>

			{/* StackMat */}
			<TimerSettingsGroup id="hardware-stackmat" label={t('timer_settings.category_stackmat')}>
				<TimerSettingsAction label={t('timer_settings.mic_access')}>
					<MicAccess />
				</TimerSettingsAction>
				<TimerSettingsToggle
					label={t('timer_settings.auto_inspection_start')}
					description={t('timer_settings.auto_inspection_start_desc')}
					isActive={stackMatAutoInspection > 0}
					onClick={handleAutoInspectionToggle}
				/>
				<TimerSettingsNumber
					label={t('timer_settings.stackmat_auto_inspection')}
					description={t('timer_settings.seconds')}
					value={stackMatAutoInspection || 2}
					step={1}
					min={1}
					max={10}
					hidden={stackMatAutoInspection <= 0}
					formatValue={(v) => `${v}s`}
					onChange={(v) => setSetting('stackmat_auto_inspection', v)}
				/>
				<TimerSettingsAction label={t('timer_settings.stackmat_select_device')}>
					<button
						type="button"
						onClick={openStackMatPickerModal}
						className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 cursor-pointer ${stackMatId
							? 'bg-button border-text/[0.1] text-text hover:bg-button hover:border-text/[0.15]'
							: 'bg-primary border-primary text-white hover:bg-primary/80'
							}`}
					>
						{stackMatId ? t('timer_settings.stackmat_change_device') : t('timer_settings.stackmat_select')}
					</button>
				</TimerSettingsAction>
			</TimerSettingsGroup>

			{/* QiYi Timer */}
			<TimerSettingsGroup id="hardware-qiyi" label={t('timer_settings.category_qiyi')}>
				<TimerSettingsToggle
					label={t('timer_settings.qiyi_auto_inspection')}
					description={t('timer_settings.qiyi_auto_inspection_desc')}
					isActive={qiyiAutoInspection}
					onClick={handleQiyiAutoInspectionToggle}
				/>
			</TimerSettingsGroup>

			{/* Smart Cube */}
			<TimerSettingsGroup id="hardware-smartcube" label={t('appearance.category_smart_cube')}>
				<TimerSettingsToggle
					label={t('appearance.smart_cube_show')}
					description={t('appearance.smart_cube_show_desc')}
					isActive={smartCubeShow}
					onClick={() => updateSetting('smart_cube_show', !smartCubeShow)}
				/>
				{smartCubeShow && (
					<TimerSettingsSlider
						label={t('appearance.smart_cube_size')}
						description={t('appearance.smart_cube_size_desc')}
						value={smartCubeSize}
						min={100}
						max={600}
						showReset={smartCubeSize !== cubeSizeDefault}
						resetLabel={t('appearance.reset')}
						onReset={() => updateSetting('smart_cube_size', cubeSizeDefault)}
						restoreDefaultLabel={t('appearance.save_as_default')}
						onRestoreDefault={() => updateSetting('smart_cube_size_user_default', smartCubeSize)}
						onChange={(v) => updateSetting('smart_cube_size', v)}
					/>
				)}
				<TimerSettingsToggle
					label={t('timer_settings.smart_cube_move_order_fix')}
					description={t('timer_settings.smart_cube_move_order_fix_desc')}
					isActive={smartCubeMoveOrderFix}
					onClick={() => updateSetting('smart_cube_move_order_fix', !smartCubeMoveOrderFix)}
				/>
			</TimerSettingsGroup>
		</div>
	);
}
