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

// Shared by HeaderControl to render the active timer type name.
export const TIMER_INPUT_TYPE_KEYS = {
	keyboard: 'timer_settings.input_keyboard',
	stackmat: 'timer_settings.input_stackmat',
	smart: 'timer_settings.input_smart',
	gantimer: 'timer_settings.input_gantimer',
	qiyitimer: 'timer_settings.input_qiyitimer',
	qiyiwired: 'timer_settings.input_qytoys',
};

export default function HardwareSettings() {
	const { t } = useTranslation();
	const dispatch = useDispatch();
	const mobileMode = useGeneral('mobile_mode');

	// Input
	const timerType = useSettings('timer_type');
	const useSpaceWithSmartCube = useSettings('use_space_with_smart_cube');

	// StackMat
	const stackMatId = useSettings('stackmat_id');
	const stackMatAutoInspection = useSettings('stackmat_auto_inspection');
	const stackMatAutoInspectionWarningShown = useSettings('stackmat_auto_inspection_warning_shown');

	// QiYi Timer
	const qiyiAutoInspection = useSettings('qiyi_auto_inspection');
	const qiyiAutoInspectionWarningShown = useSettings('qiyi_auto_inspection_warning_shown');

	// Smart Cube
	const smartCubeShow = useSettings('smart_cube_show');
	const smartCubeSize = useSettings('smart_cube_size');
	const smartCubeSizeUserDefault = useSettings('smart_cube_size_user_default');
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
		const target = timerType === 'qiyiwired' ? 'qiyiwired' : 'stackmat';
		const { title, description } = getAudioPickerModalProps(target, t);
		dispatch(openModal(<StackMatPicker targetTimerType={target} />, { width: 400, compact: true, title, description, closeButtonText: t('solve_info.done') }));
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
					options={['keyboard', 'stackmat', 'qiyiwired', 'smart', 'gantimer', 'qiyitimer'].map((c) => ({
						label: getTimerTypeName(c),
						value: c,
					}))}
					onChange={(v) => setSetting('timer_type', v as 'keyboard' | 'smart' | 'stackmat' | 'gantimer' | 'qiyitimer' | 'qiyiwired')}
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
			</TimerSettingsGroup>
		</div>
	);
}
