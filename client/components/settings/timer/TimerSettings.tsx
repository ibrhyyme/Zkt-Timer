import React from 'react';
import { useTranslation } from 'react-i18next';
import MicAccess from '../mic_access/MicAccess';
import StackMatPicker from '../stackmat_picker/StackMatPicker';
import { openModal } from '../../../actions/general';
import CubeTypes from '../cube_types/CubeTypes';
import { useDispatch } from 'react-redux';
import { setSetting, toggleSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import { useGeneral } from '../../../util/hooks/useGeneral';
import InfoWarningModal from '../../common/info_warning_modal/InfoWarningModal';
import {
	TimerSettingsGroup,
	TimerSettingsToggle,
	TimerSettingsNumber,
	TimerSettingsSelect,
	TimerSettingsAction,
} from './TimerSettingsRow';

export const TIMER_INPUT_TYPE_KEYS = {
	keyboard: 'timer_settings.input_keyboard',
	stackmat: 'timer_settings.input_stackmat',
	smart: 'timer_settings.input_smart',
	gantimer: 'timer_settings.input_gantimer',
	qiyitimer: 'timer_settings.input_qiyitimer',
	moyutimer: 'timer_settings.input_moyutimer',
};

export default function TimerSettings() {
	const { t } = useTranslation();
	const dispatch = useDispatch();
	const mobileMode = useGeneral('mobile_mode');

	// General
	const timerDecimalPoints = useSettings('timer_decimal_points');
	const freezeTime = useSettings('freeze_time');
	const hideTimeWhenSolving = useSettings('hide_time_when_solving');
	const zeroOutTimeAfterSolve = useSettings('zero_out_time_after_solve');
	const pbConfetti = useSettings('pb_confetti');
	const use2dScramble = useSettings('use_2d_scramble_visual');

	// Input
	const timerType = useSettings('timer_type');
	const useSpaceWithSmartCube = useSettings('use_space_with_smart_cube');

	// Confirmations
	const confirmDeleteSolve = useSettings('confirm_delete_solve');
	const confirmDeleteSeason = useSettings('confirm_delete_season');

	// Inspection
	const inspection = useSettings('inspection');
	const inspectionDelay = useSettings('inspection_delay');
	const playInspectionSound = useSettings('play_inspection_sound');
	const inspectionAutoStart = useSettings('inspection_auto_start');

	// StackMat
	const stackMatId = useSettings('stackmat_id');
	const stackMatAutoInspection = useSettings('stackmat_auto_inspection');
	const stackMatAutoInspectionWarningShown = useSettings('stackmat_auto_inspection_warning_shown');

	// QiYi Timer
	const qiyiAutoInspection = useSettings('qiyi_auto_inspection');
	const qiyiAutoInspectionWarningShown = useSettings('qiyi_auto_inspection_warning_shown');

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
		dispatch(openModal(<StackMatPicker />, { width: 400, compact: true, title: t('stackmat.select_input'), description: t('stackmat.description'), closeButtonText: t('solve_info.done') }));
	}

	function getTimerTypeName(tt: string) {
		if (tt === 'keyboard' && mobileMode) {
			return t('timer_settings.input_touch');
		}
		return t(TIMER_INPUT_TYPE_KEYS[tt]);
	}

	return (
		<div className="space-y-2">
			{/* General */}
			<TimerSettingsGroup id="timer-general" label={t('timer_settings.category_general')}>
				<TimerSettingsSelect
					label={t('timer_settings.decimal_points')}
					description={t('timer_settings.decimal_points_desc')}
					value={String(timerDecimalPoints)}
					options={[0, 1, 2, 3].map((c) => ({
						label: `${c} ${t('timer_settings.decimal_suffix')}`,
						value: String(c),
					}))}
					onChange={(v) => setSetting('timer_decimal_points', parseInt(v))}
				/>
				<TimerSettingsNumber
					label={t('timer_settings.freeze_time')}
					description={t('timer_settings.freeze_time_desc')}
					value={freezeTime ?? 0.2}
					step={0.1}
					min={0}
					onChange={(v) => setSetting('freeze_time', v)}
				/>
				<TimerSettingsToggle
					label={t('timer_settings.hide_time_when_solving')}
					isActive={hideTimeWhenSolving}
					onClick={() => toggleSetting('hide_time_when_solving')}
				/>
				<TimerSettingsToggle
					label={t('timer_settings.zero_out_time_after_solve')}
					description={t('timer_settings.zero_out_time_after_solve_desc')}
					isActive={zeroOutTimeAfterSolve}
					onClick={() => toggleSetting('zero_out_time_after_solve')}
				/>
				<TimerSettingsToggle
					label={t('timer_settings.pb_confetti')}
					description={t('timer_settings.pb_confetti_desc')}
					isActive={pbConfetti}
					onClick={() => toggleSetting('pb_confetti')}
				/>
				<TimerSettingsToggle
					label={t('timer_settings.use_3d_scramble_visual')}
					description={t('timer_settings.use_3d_scramble_visual_desc')}
					isActive={!use2dScramble}
					onClick={() => toggleSetting('use_2d_scramble_visual')}
				/>
			</TimerSettingsGroup>

			{/* Input */}
			<TimerSettingsGroup id="timer-input" label={t('timer_settings.category_input')}>
				<TimerSettingsSelect
					label={t('timer_settings.input_type')}
					description={t('timer_settings.input_type_desc')}
					value={timerType}
					options={['keyboard', 'stackmat', 'moyutimer', 'smart', 'gantimer', 'qiyitimer'].map((c) => ({
						label: getTimerTypeName(c),
						value: c,
					}))}
					onChange={(v) => setSetting('timer_type', v as 'keyboard' | 'smart' | 'stackmat' | 'gantimer' | 'qiyitimer' | 'moyutimer')}
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

			{/* Confirmations */}
			<TimerSettingsGroup id="timer-confirmations" label={t('timer_settings.category_confirmations')}>
				<TimerSettingsToggle
					label={t('timer_settings.confirm_delete_solve')}
					description={t('timer_settings.confirm_delete_solve_desc')}
					isActive={confirmDeleteSolve}
					onClick={() => toggleSetting('confirm_delete_solve')}
				/>
				<TimerSettingsToggle
					label={t('timer_settings.confirm_delete_season')}
					description={t('timer_settings.confirm_delete_season_desc')}
					isActive={confirmDeleteSeason}
					onClick={() => toggleSetting('confirm_delete_season')}
				/>
			</TimerSettingsGroup>

			{/* Inspection */}
			<TimerSettingsGroup id="timer-inspection" label={t('timer_settings.category_inspection')}>
				<TimerSettingsToggle
					label={t('timer_settings.inspection')}
					description={t('timer_settings.inspection_desc')}
					isActive={inspection}
					onClick={() => toggleSetting('inspection')}
				/>
				<TimerSettingsNumber
					label={t('timer_settings.inspection_time')}
					value={inspectionDelay ?? 15}
					step={1}
					min={1}
					max={60}
					hidden={!inspection}
					formatValue={(v) => `${v}s`}
					onChange={(v) => setSetting('inspection_delay', v)}
				/>
				<TimerSettingsToggle
					label={t('timer_settings.play_sound')}
					description={t('timer_settings.play_sound_desc')}
					isActive={playInspectionSound}
					hidden={!inspection}
					onClick={() => toggleSetting('play_inspection_sound')}
				/>
				<TimerSettingsToggle
					label={t('timer_settings.inspection_auto_start')}
					description={t('timer_settings.inspection_auto_start_desc')}
					isActive={inspectionAutoStart}
					hidden={!inspection}
					onClick={() => toggleSetting('inspection_auto_start')}
				/>
			</TimerSettingsGroup>

			{/* StackMat */}
			<TimerSettingsGroup id="timer-stackmat" label={t('timer_settings.category_stackmat')}>
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
			<TimerSettingsGroup id="timer-qiyi" label={t('timer_settings.category_qiyi')}>
				<TimerSettingsToggle
					label={t('timer_settings.qiyi_auto_inspection')}
					description={t('timer_settings.qiyi_auto_inspection_desc')}
					isActive={qiyiAutoInspection}
					onClick={handleQiyiAutoInspectionToggle}
				/>
			</TimerSettingsGroup>
		</div>
	);
}
