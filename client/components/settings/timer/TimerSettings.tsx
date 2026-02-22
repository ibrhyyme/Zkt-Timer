import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import MicAccess from '../mic_access/MicAccess';
import StackMatPicker from '../stackmat_picker/StackMatPicker';
import { openModal } from '../../../actions/general';
import CubeTypes from '../cube_types/CubeTypes';
import SettingRow from '../setting/row/SettingRow';
import Dropdown from '../../common/inputs/dropdown/Dropdown';
import { useDispatch } from 'react-redux';
import SettingSection from '../setting/section/SettingSection';
import Button, { CommonType } from '../../common/button/Button';
import { setSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import { AllSettings } from '../../../db/settings/query';
import Switch from '../../common/switch/Switch';
import Input from '../../common/inputs/input/Input';
import ModalHeader from '../../common/modal/modal_header/ModalHeader';
import Checkbox from '../../common/checkbox/Checkbox';
import { useIsMobile } from '../../../util/hooks/useIsMobile';

export const TIMER_INPUT_TYPE_KEYS = {
	keyboard: 'timer_settings.input_keyboard',
	stackmat: 'timer_settings.input_stackmat',
	smart: 'timer_settings.input_smart',
	gantimer: 'timer_settings.input_gantimer',
};

// Uyarı modalı componenti
function AutoInspectionWarningModal({ onComplete }: { onComplete?: () => void }) {
	const { t } = useTranslation();
	const [dontShowAgain, setDontShowAgain] = useState(false);

	function handleClose() {
		if (dontShowAgain) {
			setSetting('stackmat_auto_inspection_warning_shown', true);
		}
		if (onComplete) {
			onComplete();
		}
	}

	return (
		<div style={{ maxWidth: '500px' }}>
			<ModalHeader
				title={t('timer_settings.stackmat_warning_title')}
				description={t('timer_settings.stackmat_warning_desc')}
			/>
			<div style={{ marginBottom: '16px', lineHeight: '1.6' }}>
				<p style={{ marginBottom: '12px' }}>
					<strong>{t('timer_settings.stackmat_warning_how_it_works')}</strong>
				</p>
				<ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>
					<li>{t('timer_settings.stackmat_warning_step1')}</li>
					<li>{t('timer_settings.stackmat_warning_step2')}</li>
					<li>{t('timer_settings.stackmat_warning_step3')}</li>
				</ul>
				<p style={{ marginBottom: '12px', padding: '10px', backgroundColor: 'rgba(255,150,0,0.15)', borderRadius: '8px', border: '1px solid rgba(255,150,0,0.3)' }}>
					<strong>{t('timer_settings.stackmat_warning_limitation_title')}</strong> {t('timer_settings.stackmat_warning_limitation_desc')}
				</p>
				<p style={{ marginTop: '12px', fontWeight: 'bold' }}>
					{t('timer_settings.stackmat_warning_protocol_note')}
				</p>
				<p style={{ marginTop: '12px', padding: '10px', backgroundColor: 'rgba(255,0,0,0.1)', color: '#d32f2f', borderRadius: '8px', border: '1px solid rgba(255,0,0,0.3)', fontWeight: 'bold' }}>
					{t('timer_settings.stackmat_warning_critical')}
				</p>
			</div>
			<div style={{ marginBottom: '16px' }}>
				<Checkbox
					checked={dontShowAgain}
					onChange={() => setDontShowAgain(!dontShowAgain)}
					text={t('timer_settings.dont_show_again')}
				/>
			</div>
			<Button
				text={t('timer_settings.understood')}
				primary
				large
				onClick={handleClose}
			/>
		</div>
	);
}

export default function TimerSettings() {
	const { t } = useTranslation();
	const dispatch = useDispatch();

	const timerDecimalPoints = useSettings('timer_decimal_points');
	const inspection = useSettings('inspection');
	const stackMatId = useSettings('stackmat_id');
	const timerType = useSettings('timer_type');
	const stackMatAutoInspection = useSettings('stackmat_auto_inspection');
	const stackMatAutoInspectionWarningShown = useSettings('stackmat_auto_inspection_warning_shown');
	const [autoInspectionDelay, setAutoInspectionDelay] = useState(String(stackMatAutoInspection || 2));
	const isMobile = useIsMobile();

	function updateSetting(name: keyof AllSettings, value: any) {
		setSetting(name, value);
	}

	function handleAutoInspectionToggle(on: boolean) {
		if (on) {
			const delay = parseInt(autoInspectionDelay) || 2;
			setSetting('stackmat_auto_inspection', delay);

			// Uyarı gösterilmediyse göster
			if (!stackMatAutoInspectionWarningShown) {
				dispatch(openModal(<AutoInspectionWarningModal />));
			}
		} else {
			setSetting('stackmat_auto_inspection', 0);
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

	function openStackMatPicker() {
		dispatch(openModal(<StackMatPicker />));
	}

	function getTimerTypeName(tt: string) {
		return t(TIMER_INPUT_TYPE_KEYS[tt]);
	}

	let inspectionBody = null;
	if (inspection) {
		inspectionBody = (
			<>
				<SettingRow title={t('timer_settings.inspection_time')} settingName="inspection_delay" isNumberInput />
				<SettingRow
					title={t('timer_settings.play_sound')}
					description={t('timer_settings.play_sound_desc')}
					settingName="play_inspection_sound"
					isSwitch
				/>
				<SettingRow
					title={t('timer_settings.inspection_auto_start')}
					description={t('timer_settings.inspection_auto_start_desc')}
					settingName="inspection_auto_start"
					isSwitch
				/>
			</>
		);
	}

	return (
		<>
			<SettingRow title={t('timer_settings.decimal_points')} description={t('timer_settings.decimal_points_desc')}>
				<Dropdown
					openLeft={isMobile}
					icon={null}
					text={`${timerDecimalPoints} ${t('timer_settings.decimal_suffix')}`}
					options={[0, 1, 2, 3].map((c) => ({
						text: String(c),
						onClick: () => updateSetting('timer_decimal_points', c),
					}))}
				/>
			</SettingRow>
			<SettingRow
				title={t('timer_settings.input_type')}
				description={t('timer_settings.input_type_desc')}
			>
				<Dropdown
					openLeft={isMobile}
					icon={null}
					text={getTimerTypeName(timerType)}
					options={['keyboard', 'stackmat', 'smart', 'gantimer'].map((c) => ({
						text: getTimerTypeName(c),
						onClick: () => updateSetting('timer_type', c),
					}))}
				/>
			</SettingRow>
			<SettingRow
				title={t('timer_settings.freeze_time')}
				description={t('timer_settings.freeze_time_desc')}
				settingName="freeze_time"
				isNumberInput
				step={0.1}
			/>
			<SettingRow loggedInOnly title={t('timer_settings.cube_types')} description={t('timer_settings.cube_types_desc')}>
				<Button theme={CommonType.GRAY} text={t('timer_settings.manage_cube_types')} onClick={toggleCubeTypes} />
			</SettingRow>
			<SettingRow
				title={t('timer_settings.use_space_with_smart_cube')}
				description={t('timer_settings.use_space_with_smart_cube_desc')}
				settingName="use_space_with_smart_cube"
				isSwitch
			/>
			<SettingRow title={t('timer_settings.hide_time_when_solving')} settingName="hide_time_when_solving" isSwitch />
			<SettingRow
				title={t('timer_settings.zero_out_time_after_solve')}
				description={t('timer_settings.zero_out_time_after_solve_desc')}
				settingName="zero_out_time_after_solve"
				isSwitch
			/>
			<SettingRow
				title={t('timer_settings.require_period')}
				description={t('timer_settings.require_period_desc')}
				settingName="require_period_in_manual_time_entry"
				isSwitch
			/>
			<SettingRow
				title={t('timer_settings.confirm_delete_solve')}
				description={t('timer_settings.confirm_delete_solve_desc')}
				settingName="confirm_delete_solve"
				isSwitch
			/>
			<SettingRow
				title={t('timer_settings.confirm_delete_season')}
				description={t('timer_settings.confirm_delete_season_desc')}
				settingName="confirm_delete_season"
				isSwitch
			/>
			<SettingRow
				title={t('timer_settings.pb_confetti')}
				description={t('timer_settings.pb_confetti_desc')}
				settingName="pb_confetti"
				isSwitch
			/>
			<SettingRow
				title={t('timer_settings.use_2d_scramble_visual')}
				description={t('timer_settings.use_2d_scramble_visual_desc')}
				settingName="use_2d_scramble_visual"
				isSwitch
			/>
			<SettingSection>
				<SettingRow
					parent
					title={t('timer_settings.inspection')}
					description={t('timer_settings.inspection_desc')}
					settingName="inspection"
					isSwitch
				/>
				{inspectionBody}
			</SettingSection>
			<SettingSection>
				<SettingRow
					parent
					title={t('timer_settings.stackmat_options')}
					description={t('timer_settings.stackmat_options_desc')}
				/>
				<SettingRow sub title={t('timer_settings.mic_access')}>
					<MicAccess />
				</SettingRow>
				<SettingRow
					sub
					title={t('timer_settings.auto_inspection_start')}
					description={t('timer_settings.auto_inspection_start_desc')}
				>
					<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
						<Switch
							on={stackMatAutoInspection > 0}
							onChange={handleAutoInspectionToggle}
						/>
						{stackMatAutoInspection > 0 && (
							<>
								<Input
									type="number"
									value={autoInspectionDelay}
									name="auto_inspection_delay"
									onChange={(e) => setAutoInspectionDelay(e.target.value)}
									style={{ width: '60px' }}
								/>
								<Button
									text={t('timer_settings.save')}
									gray
									onClick={() => {
										const delay = parseInt(autoInspectionDelay) || 2;
										setSetting('stackmat_auto_inspection', delay);
									}}
								/>
								<span style={{ fontSize: '12px', color: '#888' }}>{t('timer_settings.seconds')}</span>
							</>
						)}
					</div>
				</SettingRow>
				<SettingRow sub title={t('timer_settings.stackmat_select_device')}>
					<Button
						gray
						primary={!stackMatId}
						text={stackMatId ? t('timer_settings.stackmat_change_device') : t('timer_settings.stackmat_select')}
						onClick={openStackMatPicker}
					/>
				</SettingRow>
			</SettingSection>
		</>
	);
}
