/**
 * RecognitionRoot — recognition mode kok component.
 * Recognition modu seciliyse Trainer.tsx bunu render eder.
 * Kendi 7 sub-view'ini (home/setup/trainer/results/settings/history/glossary) yonetir.
 */
import React, {useEffect} from 'react';
import block from '../../../styles/bem';
import './recognition.scss';
import {RecognitionProvider, useRecognitionContext} from './RecognitionContext';
import HomeView from './views/HomeView';
import SessionSetupView from './views/SessionSetupView';
import TrainerView from './views/TrainerView';
import EvalResultsView from './views/EvalResultsView';
import SettingsView from './views/SettingsView';
import HistoryView from './views/HistoryView';
import GlossaryView from './views/GlossaryView';
import {ArrowLeft, Gear, ClockClockwise, House, BookOpen} from 'phosphor-react';
import {useTranslation} from 'react-i18next';
import {useTrainerContext} from '../TrainerContext';
import type {RecognitionView} from './types';

const b = block('trainer-recognition');

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
			className={b('toolbar-btn', {active})}
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
	const {state, setRecognitionView} = useRecognitionContext();
	const {dispatch: trainerDispatch} = useTrainerContext();

	const onBack = () => {
		if (state.view === 'home') {
			trainerDispatch({type: 'SET_VIEW', payload: 'landing'});
		} else {
			setRecognitionView('home');
		}
	};

	const backLabel =
		state.view === 'home'
			? t('trainer.recognition.toolbar_trainer', {defaultValue: 'Trainer'})
			: t('trainer.recognition.toolbar_back', {defaultValue: 'Back'});

	return (
		<div className={b('toolbar')}>
			<button type="button" className={b('toolbar-back')} onClick={onBack}>
				<ArrowLeft size={18} weight="bold" />
				<span>{backLabel}</span>
			</button>
			<div className={b('toolbar-title')}>
				{t('trainer.landing_recognition_title', {defaultValue: 'PLL Recognition'})}
			</div>
			<div className={b('toolbar-actions')}>
				<ToolbarIconBtn
					icon={<BookOpen size={22} weight="duotone" />}
					title={t('trainer.recognition.toolbar_glossary', {defaultValue: 'Glossary'})}
					active={state.view === 'glossary'}
					onClick={() => setRecognitionView('glossary')}
				/>
				<ToolbarIconBtn
					icon={<House size={22} weight="duotone" />}
					title={t('trainer.recognition.toolbar_home', {defaultValue: 'Home'})}
					active={state.view === 'home'}
					onClick={() => setRecognitionView('home')}
				/>
				<ToolbarIconBtn
					icon={<ClockClockwise size={22} weight="duotone" />}
					title={t('trainer.recognition.toolbar_history', {defaultValue: 'History'})}
					active={state.view === 'history'}
					onClick={() => setRecognitionView('history')}
				/>
				<ToolbarIconBtn
					icon={<Gear size={22} weight="duotone" />}
					title={t('trainer.recognition.toolbar_settings', {defaultValue: 'Settings'})}
					active={state.view === 'settings'}
					onClick={() => setRecognitionView('settings')}
				/>
			</div>
		</div>
	);
}

function RecognitionRouter() {
	const {state} = useRecognitionContext();

	useEffect(() => {
		if (typeof window === 'undefined') return;
		window.history.pushState({recognitionView: state.view}, '');
		const onPopState = () => {};
		window.addEventListener('popstate', onPopState);
		return () => window.removeEventListener('popstate', onPopState);
	}, [state.view]);

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
