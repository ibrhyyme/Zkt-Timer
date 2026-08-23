import React from 'react';
import { useTranslation } from 'react-i18next';
import { setSetting, toggleSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import {
	isMultiPhaseActive,
	MULTI_PHASE_LABEL_MAX_LENGTH,
	MULTI_PHASE_MAX_COUNT,
	MULTI_PHASE_METHODS,
	MULTI_PHASE_MIN_COUNT,
	MultiPhaseMethod,
	sanitizePhaseLabel,
} from '../../../../shared/util/solve/multiphase';
import { getPhaseLabels } from '../../../util/solve/multiphase_labels';
import {
	TimerSettingsGroup,
	TimerSettingsToggle,
	TimerSettingsNumber,
	TimerSettingsSelect,
	TimerSettingsText,
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
	const inspectionExceptBld = useSettings('inspection_except_bld');

	// Confirmations
	const confirmDeleteSolve = useSettings('confirm_delete_solve');
	const confirmDeleteSeason = useSettings('confirm_delete_season');

	// Multi-phase
	const multiPhaseCount = useSettings('multi_phase_count');
	const multiPhaseMethod = useSettings('multi_phase_method');
	const smartCubeMethod = useSettings('smart_cube_method');
	const multiPhaseCustomLabels = useSettings('multi_phase_custom_labels');
	const multiPhaseOn = isMultiPhaseActive(multiPhaseCount);
	const multiPhaseCustom = multiPhaseOn && multiPhaseMethod === 'custom';

	const phaseCountOptions = [{ label: t('timer_settings.multi_phase_off'), value: '1' }];
	for (let c = MULTI_PHASE_MIN_COUNT; c <= MULTI_PHASE_MAX_COUNT; c++) {
		phaseCountOptions.push({ label: t('timer_settings.multi_phase_count_n', { n: c }), value: String(c) });
	}

	// Preview of the labels the current pairing produces, so the effect of the choice is
	// visible without starting a solve.
	const phasePreview = multiPhaseOn
		? getPhaseLabels(t, multiPhaseCount, multiPhaseMethod, multiPhaseCustomLabels).join('  /  ')
		: '';

	function setCustomLabel(index: number, value: string) {
		const next = (multiPhaseCustomLabels || []).slice();
		while (next.length < MULTI_PHASE_MAX_COUNT) next.push('');
		next[index] = sanitizePhaseLabel(value);
		setSetting('multi_phase_custom_labels', next);
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
				<TimerSettingsToggle
					label={t('timer_settings.inspection_except_bld')}
					description={t('timer_settings.inspection_except_bld_desc')}
					isActive={inspectionExceptBld}
					hidden={!inspection}
					onClick={() => toggleSetting('inspection_except_bld')}
				/>
			</TimerSettingsGroup>

			{/* Smart cube solving method — identity, not a view preference. It is stamped
			    onto every smart solve as method_name, so it deliberately lives here rather
			    than in quick settings where a stray tap could change it. */}
			<TimerSettingsGroup id="timer-smart-method" label={t('timer_settings.category_smart_method')}>
				<TimerSettingsSelect
					label={t('timer_settings.smart_cube_method')}
					description={t('timer_settings.smart_cube_method_desc')}
					value={smartCubeMethod || 'auto'}
					options={[
						{ label: t('timer_settings.smart_cube_method_auto'), value: 'auto' },
						{ label: 'CFOP', value: 'cfop' },
						{ label: 'Roux', value: 'roux' },
						{ label: 'ZZ', value: 'zz' },
					]}
					onChange={(v) => setSetting('smart_cube_method', v)}
				/>
			</TimerSettingsGroup>

			{/* Multi-phase */}
			<TimerSettingsGroup id="timer-multi-phase" label={t('timer_settings.category_multi_phase')}>
				<TimerSettingsSelect
					label={t('timer_settings.multi_phase_count')}
					description={t('timer_settings.multi_phase_count_desc')}
					value={String(multiPhaseCount ?? 1)}
					options={phaseCountOptions}
					onChange={(v) => setSetting('multi_phase_count', parseInt(v))}
				/>
				<TimerSettingsSelect
					label={t('timer_settings.multi_phase_method')}
					description={phasePreview}
					value={multiPhaseMethod || 'cfop'}
					options={MULTI_PHASE_METHODS.map((m) => ({
						label: t(`multi_phase.method.${m}`),
						value: m,
					}))}
					hidden={!multiPhaseOn}
					onChange={(v) => setSetting('multi_phase_method', v as MultiPhaseMethod)}
				/>
				{multiPhaseCustom &&
					Array.from({ length: multiPhaseCount }).map((_, i) => (
						<TimerSettingsText
							key={i}
							label={t('timer_settings.multi_phase_label_n', { n: i + 1 })}
							value={multiPhaseCustomLabels?.[i] || ''}
							placeholder={t('multi_phase.phase_n', { n: i + 1 })}
							maxLength={MULTI_PHASE_LABEL_MAX_LENGTH}
							onChange={(v) => setCustomLabel(i, v)}
						/>
					))}
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
