/**
 * RecognitionRoot — recognition mode kok component.
 * Recognition modu seciliyse Trainer.tsx bunu render eder.
 * Kendi 7 sub-view'ini (home/setup/trainer/results/settings/history/glossary) yonetir.
 */
import React from 'react';
import block from '../../../styles/bem';
import './recognition.scss';
import {RecognitionProvider, useRecognitionContext} from './RecognitionContext';
import {useRecognitionUrlSync} from './useRecognitionUrlSync';
import HomeView from './views/HomeView';
import SessionSetupView from './views/SessionSetupView';
import TrainerView from './views/TrainerView';
import EvalResultsView from './views/EvalResultsView';
import SettingsView from './views/SettingsView';
import HistoryView from './views/HistoryView';
import GlossaryView from './views/GlossaryView';
import {Gear, ClockClockwise, House, BookOpen} from 'phosphor-react';
import {useTranslation} from 'react-i18next';
import {useTrainerContext} from '../TrainerContext';
import TrainerModeHeader from '../common/TrainerModeHeader';
import type {RecognitionView} from './types';

const b = block('trainer-recognition');
const bh = block('trainer-header');

interface ToolbarIconBtnProps {
	icon: React.ReactNode;
	title: string;
	active?: boolean;
	onClick: () => void;
}

function ToolbarIconBtn({icon, title, active, onClick}: ToolbarIconBtnProps) {
	return (
		<button
			type="button"
			className={bh('btn', {active})}
			onClick={onClick}
			title={title}
			aria-label={title}
		>
			{icon}
		</button>
	);
}

function RecognitionToolbar() {
	const {t} = useTranslation();
	const {state, setRecognitionView, updateSettings} = useRecognitionContext();
	const {dispatch: trainerDispatch} = useTrainerContext();

	const onBack = () => {
		if (state.view === 'home') {
			trainerDispatch({type: 'SET_VIEW', payload: 'landing'});
		} else {
			// Home'a donerken aktif quest adimini temizle — quest step'in "aktif"
			// kalmamasi icin (eski inline "Yolculuga Don" butonunun davranisi buraya tasindi).
			if (state.settings.activeQuestStepId) {
				updateSettings({activeQuestStepId: null});
			}
			setRecognitionView('home');
		}
	};

	return (
		<TrainerModeHeader
			mode="recognition"
			backToRoot={state.view === 'home'}
			onBack={onBack}
			actions={
				<>
					<ToolbarIconBtn
						icon={<BookOpen size={20} weight="duotone" />}
						title={t('trainer.recognition.toolbar_glossary', {defaultValue: 'Glossary'})}
						active={state.view === 'glossary'}
						onClick={() => setRecognitionView('glossary')}
					/>
					<ToolbarIconBtn
						icon={<House size={20} weight="duotone" />}
						title={t('trainer.recognition.toolbar_home', {defaultValue: 'Home'})}
						active={state.view === 'home'}
						onClick={() => setRecognitionView('home')}
					/>
					<ToolbarIconBtn
						icon={<ClockClockwise size={20} weight="duotone" />}
						title={t('trainer.recognition.toolbar_history', {defaultValue: 'History'})}
						active={state.view === 'history'}
						onClick={() => setRecognitionView('history')}
					/>
					<ToolbarIconBtn
						icon={<Gear size={20} weight="duotone" />}
						title={t('trainer.recognition.toolbar_settings', {defaultValue: 'Settings'})}
						active={state.view === 'settings'}
						onClick={() => setRecognitionView('settings')}
					/>
				</>
			}
		/>
	);
}

function RecognitionRouter() {
	const {state} = useRecognitionContext();

	// view ↔ URL senkronu (eski manuel pushState hack'inin yerine).
	useRecognitionUrlSync();

	switch (state.view as RecognitionView) {
		case 'home':
			return <HomeView />;
		case 'setup':
			return <SessionSetupView />;
		case 'trainer':
			return <TrainerView />;
		case 'results':
			return <EvalResultsView />;
		case 'settings':
			return <SettingsView />;
		case 'history':
			return <HistoryView />;
		case 'glossary':
			return <GlossaryView />;
		default:
			return <HomeView />;
	}
}

export default function RecognitionRoot() {
	return (
		<RecognitionProvider>
			<div className={b()}>
				<RecognitionToolbar />
				<RecognitionRouter />
			</div>
		</RecognitionProvider>
	);
}
