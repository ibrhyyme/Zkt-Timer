/**
 * SettingsView — efficiency tercihleri. MVP'de tek ayar: "tum cozumler".
 */
import React from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import Switch from '../../../common/switch/Switch';
import {useEfficiencyContext} from '../EfficiencyContext';

const b = block('trainer-efficiency');

export default function SettingsView() {
	const {t} = useTranslation();
	const {state, updateSettings} = useEfficiencyContext();

	return (
		<div className={b('settings')}>
			<div className={b('settings-card')}>
				<label className={b('toggle-row')}>
					<div className={b('toggle-text')}>
						<div className={b('toggle-title')}>
							{t('trainer.efficiency.settings_show_all', {defaultValue: 'Show all solutions'})}
						</div>
						<div className={b('toggle-desc')}>
							{t('trainer.efficiency.settings_show_all_desc', {
								defaultValue: 'Also list solutions for the other faces, sorted by move count.',
							})}
						</div>
					</div>
					<Switch
						on={state.settings.showAllSolutions}
						onChange={(on) => updateSettings({showAllSolutions: on})}
					/>
				</label>
			</div>
		</div>
	);
}
