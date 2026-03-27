import React from 'react';
import { useTranslation } from 'react-i18next';
import { useBattle } from './BattleContext';
import { X, ArrowsDownUp, ArrowClockwise, Trash, ArrowCounterClockwise } from 'phosphor-react';
import block from '../../styles/bem';

const b = block('battle');

export default function BattleMenu() {
	const { t } = useTranslation();
	const { state, dispatch } = useBattle();
	const { settings, menuOpen } = state;

	if (!menuOpen) return null;

	const toggleSetting = (key: keyof typeof settings) => {
		dispatch({ type: 'UPDATE_SETTINGS', settings: { [key]: !settings[key] } });
	};

	return (
		<div className={b('overlay')}>
			<div className={b('overlay-header')}>
				<h2>{t('battle.menu')}</h2>
				<button className={b('overlay-close')} onClick={() => dispatch({ type: 'TOGGLE_MENU' })}>
					<X size={24} />
				</button>
			</div>

			{/* Actions */}
			<div className={b('section-label')}>{t('battle.settings')}</div>
			<div className={b('menu-actions')}>
				<button className={b('menu-action')} onClick={() => { dispatch({ type: 'SWITCH_SIDES' }); dispatch({ type: 'TOGGLE_MENU' }); }}>
					<ArrowsDownUp size={18} />
					{t('battle.switch_sides')}
				</button>
				<button className={b('menu-action')} onClick={() => { dispatch({ type: 'CHANGE_SCRAMBLE' }); dispatch({ type: 'TOGGLE_MENU' }); }}>
					<ArrowClockwise size={18} />
					{t('battle.change_scramble')}
				</button>
				<button className={b('menu-action')} onClick={() => { dispatch({ type: 'DELETE_LAST_ROUND' }); dispatch({ type: 'TOGGLE_MENU' }); }}>
					<ArrowCounterClockwise size={18} />
					{t('battle.delete_last')}
				</button>
				<button className={b('menu-action', { danger: true })} onClick={() => dispatch({ type: 'RESET' })}>
					<Trash size={18} />
					{t('battle.new_battle')}
				</button>
			</div>

			{/* Toggles */}
			<div className={b('section-label')}>{t('battle.display')}</div>
			<div className={b('toggles')}>
				<ToggleRow label={t('battle.show_time')} value={settings.showTimeWhenSolving} onChange={() => toggleSetting('showTimeWhenSolving')} />
				<ToggleRow label={t('battle.show_scramble')} value={settings.showScramble} onChange={() => toggleSetting('showScramble')} />
				<ToggleRow label={t('battle.show_names')} value={settings.showPlayerNames} onChange={() => toggleSetting('showPlayerNames')} />
				<ToggleRow label={t('battle.show_stats')} value={settings.showStatistics} onChange={() => toggleSetting('showStatistics')} />
				<ToggleRow label={t('battle.show_score')} value={settings.showScore} onChange={() => toggleSetting('showScore')} />
				<ToggleRow label={t('battle.streak')} value={settings.showWinStreak} onChange={() => toggleSetting('showWinStreak')} />
			</div>
		</div>
	);
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) {
	return (
		<div className={b('toggle-row')} onClick={onChange}>
			<span className={b('toggle-label')}>{label}</span>
			<div className={b('toggle-track', { on: value })}>
				<div className={b('toggle-thumb', { on: value })} />
			</div>
		</div>
	);
}
