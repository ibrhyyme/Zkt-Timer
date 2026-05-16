import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import SettingsSection from './SettingsSection';
import SettingToggle from './SettingToggle';
import SettingSlider from './SettingSlider';
import SettingSelect from './SettingSelect';
import type {TrainerBackView, TrainerOptions} from '../types';

const b = block('trainer');

interface TrainerSettingsModalProps {
	/**
	 * Modal acildiginda kullanilan baslangic options snapshot'i.
	 * Modal Redux openModal ile App root'unda render ediliyor — TrainerProvider'in
	 * DISINDA. Dolayisiyla useTrainerContext() default no-op dispatch verir.
	 * Cozum: parent'in (TrainerToolbar) options ve onChange callback'ini prop olarak
	 * gecirmesi. Modal local state ile UI'i mirror eder, onChange ile parent'a sync eder.
	 */
	initialOptions: TrainerOptions;
	onOptionChange: <K extends keyof TrainerOptions>(key: K, value: TrainerOptions[K]) => void;
}

export default function TrainerSettingsModal({initialOptions, onOptionChange}: TrainerSettingsModalProps) {
	const {t} = useTranslation();
	const [options, setLocalOptions] = useState<TrainerOptions>(initialOptions);

	const set = <K extends keyof TrainerOptions>(key: K, value: TrainerOptions[K]) => {
		setLocalOptions((prev) => ({...prev, [key]: value}));
		onOptionChange(key, value);
	};

	return (
		<div className={b('settings-modal')}>
			<SettingsSection title={t('trainer.settings_section_practice')}>
				<SettingToggle
					label={t('trainer.option_random_order')}
					checked={options.randomOrder}
					onChange={(v) => set('randomOrder', v)}
				/>
				<SettingToggle
					label={t('trainer.option_random_auf')}
					checked={options.randomizeAUF}
					onChange={(v) => set('randomizeAUF', v)}
				/>
				<SettingToggle
					label={t('trainer.option_prioritize_slow')}
					checked={options.prioritizeSlow}
					onChange={(v) => set('prioritizeSlow', v)}
				/>
				<SettingToggle
					label={t('trainer.option_prioritize_failed')}
					checked={options.prioritizeFailed}
					onChange={(v) => set('prioritizeFailed', v)}
				/>
				<SettingToggle
					label={t('trainer.option_select_learning')}
					checked={options.selectLearning}
					onChange={(v) => set('selectLearning', v)}
				/>
				<SettingToggle
					label={t('trainer.option_auto_learn_enabled')}
					checked={options.autoLearnEnabled}
					onChange={(v) => set('autoLearnEnabled', v)}
				/>
				<SettingSlider
					label={t('trainer.option_auto_learn_threshold')}
					tooltip={t('trainer.option_auto_learn_threshold_help')}
					value={options.autoLearnThreshold}
					min={3}
					max={10}
					onChange={(v) => set('autoLearnThreshold', v)}
				/>
				<SettingToggle
					label={t('trainer.option_show_alg_name')}
					checked={options.showCaseName}
					onChange={(v) => set('showCaseName', v)}
				/>
				<SettingToggle
					label={t('trainer.option_flash_indicator')}
					checked={options.flashingError}
					onChange={(v) => set('flashingError', v)}
				/>
			</SettingsSection>

			<SettingsSection title={t('trainer.settings_section_visualization')}>
				<SettingSlider
					label={t('trainer.option_cube_size')}
					value={options.cubeSize}
					min={180}
					max={500}
					step={20}
					suffix="px"
					onChange={(v) => set('cubeSize', v)}
				/>
				<SettingSelect<TrainerBackView>
					label={t('trainer.option_back_view')}
					value={options.backView}
					options={[
						{value: 'none', label: t('trainer.option_back_view_none')},
						{value: 'side-by-side', label: t('trainer.option_back_view_side_by_side')},
						{value: 'top-right', label: t('trainer.option_back_view_top_right')},
					]}
					onChange={(v) => set('backView', v)}
				/>
				<SettingToggle
					label={t('trainer.option_white_on_bottom')}
					description={t('trainer.option_white_on_bottom_desc')}
					checked={options.whiteOnBottom}
					onChange={(v) => set('whiteOnBottom', v)}
				/>
			</SettingsSection>

			<SettingsSection title={t('trainer.settings_section_smart_cube')}>
				<SettingToggle
					label={t('trainer.option_wake_lock')}
					checked={options.wakeLockEnabled}
					onChange={(v) => set('wakeLockEnabled', v)}
				/>
				<SettingToggle
					label={t('trainer.option_show_all_ble_devices')}
					description={t('trainer.option_show_all_ble_devices_desc')}
					checked={options.showAllBleDevices}
					onChange={(v) => set('showAllBleDevices', v)}
				/>
			</SettingsSection>
		</div>
	);
}
