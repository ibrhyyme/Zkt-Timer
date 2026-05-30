/**
 * EfficiencyRoot — efficiency mode kok component.
 * Trainer.tsx, mode === 'efficiency' iken bunu render eder.
 * Sub-view'lar: trainer / settings.
 */
import React from 'react';
import block from '../../../styles/bem';
import './efficiency.scss';
import {EfficiencyProvider, useEfficiencyContext} from './EfficiencyContext';
import {useEfficiencyUrlSync} from './useEfficiencyUrlSync';
import TrainerView from './views/TrainerView';
import SettingsView from './views/SettingsView';
import {Gear} from 'phosphor-react';
import {useTranslation} from 'react-i18next';
import {useTrainerContext} from '../TrainerContext';
import TrainerModeHeader from '../common/TrainerModeHeader';
import type {EfficiencyView} from './types';

const b = block('trainer-efficiency');
const bh = block('trainer-header');

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
		<TrainerModeHeader
			mode="efficiency"
			backToRoot={state.view === 'trainer'}
			onBack={onBack}
			actions={
				<button
					type="button"
					className={bh('btn', {active: state.view === 'settings'})}
					onClick={() => setEfficiencyView(state.view === 'settings' ? 'trainer' : 'settings')}
					title={t('trainer.efficiency.toolbar_settings', {defaultValue: 'Settings'})}
					aria-label={t('trainer.efficiency.toolbar_settings', {defaultValue: 'Settings'})}
				>
					<Gear size={20} weight="duotone" />
				</button>
			}
		/>
	);
}

function EfficiencyRouter() {
	const {state} = useEfficiencyContext();

	// view ↔ URL senkronu (eski manuel pushState hack'inin yerine).
	useEfficiencyUrlSync();

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
