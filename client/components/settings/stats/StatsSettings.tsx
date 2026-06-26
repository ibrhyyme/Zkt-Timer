import React from 'react';
import { useTranslation } from 'react-i18next';
import { setSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import { AllSettings } from '../../../db/settings/query';
import {
	TimerSettingsGroup,
	TimerSettingsSelect,
} from '../timer/TimerSettingsRow';

export default function StatsSettings() {
	const { t } = useTranslation();
	const highlightPbs = useSettings('highlight_pbs');

	function updateSetting(name: keyof AllSettings, value: any) {
		setSetting(name, value);
	}

	return (
		<div className="space-y-2">
			<TimerSettingsGroup id="stats-general" label={t('stats_settings.category_general')}>
				<TimerSettingsSelect
					label={t('stats_settings.highlight_pbs')}
					description={t('stats_settings.highlight_pbs_desc')}
					value={highlightPbs}
					options={[
						{ label: t('stats_settings.highlight_off'), value: 'off' },
						{ label: t('stats_settings.highlight_color'), value: 'color' },
						{ label: t('stats_settings.highlight_bold'), value: 'bold' },
					]}
					onChange={(v) => updateSetting('highlight_pbs', v)}
				/>
			</TimerSettingsGroup>
		</div>
	);
}
