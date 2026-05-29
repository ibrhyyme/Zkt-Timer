/**
 * SettingsView — efficiency tercihleri. MVP'de tek ayar: "tum cozumler".
 */
import React from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
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
					<span className={b('switch', {on: state.settings.showAllSolutions})}>
						<input
							type="checkbox"
							className={b('switch-input')}
							checked={state.settings.showAllSolutions}
							onChange={(e) => updateSettings({showAllSolutions: e.target.checked})}
						/>
						<span className={b('switch-knob')} />
					</span>
				</label>
			</div>
		</div>
	);
}
