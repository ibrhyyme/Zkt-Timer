/**
 * EfficiencyRoot — efficiency mode kok component.
 * Trainer.tsx, mode === 'efficiency' iken bunu render eder.
 * Sub-view'lar: trainer / settings.
 */
import React, {useEffect} from 'react';
import block from '../../../styles/bem';
import './efficiency.scss';
import {EfficiencyProvider, useEfficiencyContext} from './EfficiencyContext';
import TrainerView from './views/TrainerView';
import SettingsView from './views/SettingsView';
import {ArrowLeft, Gear} from 'phosphor-react';
import {useTranslation} from 'react-i18next';
import {useTrainerContext} from '../TrainerContext';
import type {EfficiencyView} from './types';

const b = block('trainer-efficiency');

function EfficiencyToolbar() {
	const {t} = useTranslation();
	const {state, setEfficiencyView} = useEfficiencyContext();
	const {dispatch: trainerDispatch} = useTrainerContext();

	const onBack = () => {
		if (state.view !== 'trainer') {
			setEfficiencyView('trainer');
		} else {
			trainerDispatch({type: 'SET_VIEW', payload: 'landing'});
		}
	};

	return (
		<div className={b('toolbar')}>
			<button type="button" className={b('toolbar-back')} onClick={onBack}>
				<ArrowLeft size={18} weight="bold" />
				<span>{t('trainer.efficiency.toolbar_back', {defaultValue: 'Back'})}</span>
			</button>
			<div className={b('toolbar-title')}>
				{t('trainer.efficiency.toolbar_title', {defaultValue: 'Efficiency Trainer'})}
			</div>
			<div className={b('toolbar-actions')}>
				<button
					type="button"
					className={b('toolbar-btn', {active: state.view === 'settings'})}
					onClick={() => setEfficiencyView(state.view === 'settings' ? 'trainer' : 'settings')}
					title={t('trainer.efficiency.toolbar_settings', {defaultValue: 'Settings'})}
					aria-label={t('trainer.efficiency.toolbar_settings', {defaultValue: 'Settings'})}
				>
					<Gear size={22} weight="duotone" />
				</button>
			</div>
		</div>
	);
}

function EfficiencyRouter() {
	const {state} = useEfficiencyContext();

	useEffect(() => {
		if (typeof window === 'undefined') return;
		window.history.pushState({efficiencyView: state.view}, '');
		const onPopState = () => {};
		window.addEventListener('popstate', onPopState);
		return () => window.removeEventListener('popstate', onPopState);
	}, [state.view]);

	switch (state.view as EfficiencyView) {
		case 'settings':
			return <SettingsView />;
		case 'trainer':
		default:
			return <TrainerView />;
	}
}

export default function EfficiencyRoot() {
	return (
		<EfficiencyProvider>
			<div className={b()}>
				<EfficiencyToolbar />
				<EfficiencyRouter />
			</div>
		</EfficiencyProvider>
	);
}
