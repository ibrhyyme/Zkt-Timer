// Everything the connected smart cube controls: which method a solve is read as, how
// finely it is broken down, and how the cube itself is drawn on the timer screen.
//
// Split out of the old combined "Hardware" screen. The analysis rows also exist in
// quick controls (ExtrasTab), which is the in-solve shortcut; this is where they live
// permanently, so they are reachable with no cube connected.

import React from 'react';
import { useTranslation } from 'react-i18next';
import { setSetting, toggleSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { AllSettings, getDefaultSetting } from '../../../db/settings/query';
import {
	TimerSettingsGroup,
	TimerSettingsToggle,
	TimerSettingsSelect,
	TimerSettingsSlider,
} from '../timer/TimerSettingsRow';

export default function SmartCubeSettings() {
	const { t } = useTranslation();
	const mobileMode = useGeneral('mobile_mode');

	const smartCubeMethod = useSettings('smart_cube_method');
	const analysisMode = useSettings('smart_cube_analysis_mode');
	const showRecognition = useSettings('smart_cube_show_recognition');
	const useSpaceWithSmartCube = useSettings('use_space_with_smart_cube');

	const smartCubeShow = useSettings('smart_cube_show');
	const smartCubeSize = useSettings('smart_cube_size');
	const smartCubeSizeUserDefault = useSettings('smart_cube_size_user_default');
	const smartCubeMoveOrderFix = useSettings('smart_cube_move_order_fix');
	const cubeSizeDefault = smartCubeSizeUserDefault ?? getDefaultSetting('smart_cube_size');

	const solveMethod = smartCubeMethod || 'auto';

	function updateSetting(name: keyof AllSettings, value: any) {
		setSetting(name, value);
	}

	// Same option list as quick controls, and it has to stay the same: picking a level
	// the method cannot produce leaves the breakdown empty.
	const analysisOptions = [
		{ label: t('timer_settings.smart_cube_analysis_none'), value: 'none' },
		{ label: 'CFOP', value: 'cfop' },
		{ label: 'CF+OP', value: 'cf_plus_op' }, // Multi-phase (4 steps: Cross, F2L, OLL, PLL)
		{ label: 'CFFFFOP', value: 'cffffop' }, // F2L Split (Cross, F2L1, F2L2, F2L3, F2L4, OLL, PLL)
		{ label: 'CFFFFOOPP', value: 'cffffoopp' },
	]
		.filter((opt) => !(mobileMode && opt.value === 'cffffoopp')) // On mobile, 11 lines don't fit
		// Roux and ZZ have a single ladder each, so granularity is meaningless there
		// and the list collapses to on/off. Everything else — CFOP, and Automatic,
		// which resolves to CFOP for most solvers — keeps the full set of levels.
		.filter((opt) => {
			const singleLadder = solveMethod === 'roux' || solveMethod === 'zz';
			return !singleLadder || opt.value === 'none' || opt.value === 'cffffop';
		});

	return (
		<div className="space-y-2">
			{/* Method & analysis. The method is identity, not a view preference: it is
			    stamped onto every smart solve as method_name, so it deliberately lives
			    here rather than in quick settings where a stray tap could change it. */}
			<TimerSettingsGroup
				id="smart-cube-analysis"
				label={t('timer_settings.category_smart_analysis')}
			>
				<TimerSettingsSelect
					label={t('timer_settings.smart_cube_method')}
					description={t('timer_settings.smart_cube_method_desc')}
					value={solveMethod}
					options={[
						{ label: t('timer_settings.smart_cube_method_auto'), value: 'auto' },
						{ label: 'CFOP', value: 'cfop' },
						{ label: 'Roux', value: 'roux' },
						{ label: 'ZZ', value: 'zz' },
					]}
					onChange={(v) => setSetting('smart_cube_method', v)}
				/>
				<TimerSettingsSelect
					label={t('timer_settings.smart_cube_analysis_mode')}
					description={t('timer_settings.smart_cube_analysis_mode_desc')}
					value={analysisMode || 'none'}
					options={analysisOptions}
					onChange={(v) => setSetting('smart_cube_analysis_mode', v)}
				/>
				<TimerSettingsToggle
					label={t('timer_settings.smart_cube_show_recognition')}
					description={t('timer_settings.smart_cube_show_recognition_desc')}
					isActive={!!showRecognition}
					// Desktop-only feature: the split needs a column the mobile layout
					// does not have.
					hidden={!!mobileMode}
					onClick={() => toggleSetting('smart_cube_show_recognition')}
				/>
			</TimerSettingsGroup>

			{/* Cube visual */}
			<TimerSettingsGroup
				id="smart-cube-visual"
				label={t('timer_settings.category_smart_visual')}
			>
				<TimerSettingsToggle
					label={t('timer_settings.smart_cube_show')}
					description={t('timer_settings.smart_cube_show_desc')}
					isActive={smartCubeShow}
					onClick={() => updateSetting('smart_cube_show', !smartCubeShow)}
				/>
				<TimerSettingsSlider
					label={t('timer_settings.smart_cube_size')}
					description={t('timer_settings.smart_cube_size_desc')}
					value={smartCubeSize}
					min={100}
					max={600}
					hidden={!smartCubeShow}
					showReset={smartCubeSize !== cubeSizeDefault}
					resetLabel={t('appearance.reset')}
					onReset={() => updateSetting('smart_cube_size', cubeSizeDefault)}
					restoreDefaultLabel={t('appearance.save_as_default')}
					onRestoreDefault={() => updateSetting('smart_cube_size_user_default', smartCubeSize)}
					onChange={(v) => updateSetting('smart_cube_size', v)}
				/>
			</TimerSettingsGroup>

			{/* Behaviour */}
			<TimerSettingsGroup
				id="smart-cube-behaviour"
				label={t('timer_settings.category_smart_behaviour')}
			>
				<TimerSettingsToggle
					label={t('timer_settings.use_space_with_smart_cube')}
					description={t('timer_settings.use_space_with_smart_cube_desc')}
					isActive={useSpaceWithSmartCube}
					onClick={() => toggleSetting('use_space_with_smart_cube')}
				/>
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
