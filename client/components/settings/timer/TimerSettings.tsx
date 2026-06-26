import React from 'react';
import { useTranslation } from 'react-i18next';
import { setSetting, toggleSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import {
	TimerSettingsGroup,
	TimerSettingsToggle,
	TimerSettingsNumber,
	TimerSettingsSelect,
} from './TimerSettingsRow';

export default function TimerSettings() {
	const { t } = useTranslation();

	// General
	const timerDecimalPoints = useSettings('timer_decimal_points');
	const freezeTime = useSettings('freeze_time');
	const hideTimeWhenSolving = useSettings('hide_time_when_solving');
	const zeroOutTimeAfterSolve = useSettings('zero_out_time_after_solve');
	const pbConfetti = useSettings('pb_confetti');

	// Inspection
	const inspection = useSettings('inspection');
	const inspectionDelay = useSettings('inspection_delay');
	const playInspectionSound = useSettings('play_inspection_sound');
	const inspectionAutoStart = useSettings('inspection_auto_start');

	// Confirmations
	const confirmDeleteSolve = useSettings('confirm_delete_solve');
	const confirmDeleteSeason = useSettings('confirm_delete_season');

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
		</div>
	);
}
