import React, {useEffect} from 'react';
import './Trainer.scss';
import PageTitle from '../common/page_title/PageTitle';
import block from '../../styles/bem';
import Header from '../layout/header/Header';
import {useLocation} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {TrainerProvider, useTrainerContext} from './TrainerContext';
import AlgorithmSelector from './panels/algorithm_selector/AlgorithmSelector';
import TrainingArea from './panels/training_area/TrainingArea';
import StatsPanel from './panels/stats_panel/StatsPanel';
import TrainerToolbar from './toolbar/TrainerToolbar';
import TrainerLanding from './TrainerLanding';
import {ensureCubingReady} from '../../util/trainer/algorithm_engine';
import {ensureKPuzzleReady} from '../../util/trainer/pattern_utils';
import {loadLLPatterns} from '../../util/trainer/ll_patterns';
import {loadPuzzlePatterns} from '../../util/trainer/puzzle_patterns';
import {loadIsometricPatterns} from '../../util/trainer/isometric_patterns';
import FeatureGuard from '../common/page_disabled/FeatureGuard';

const b = block('trainer');

function TrainerContent() {
	const {state, dispatch} = useTrainerContext();

	useEffect(() => {
		if (state.view === 'landing') return;

		const stateKey = state.view === 'training'
			? {trainerTraining: true}
			: {trainerSelection: true};

		window.history.pushState(stateKey, '');

		const handlePopState = () => {
			if (state.view === 'training') {
				dispatch({type: 'SET_VIEW', payload: 'selection'});
			} else if (state.view === 'selection') {
				dispatch({type: 'SET_VIEW', payload: 'landing'});
			}
		};

		window.addEventListener('popstate', handlePopState);
		return () => {
			window.removeEventListener('popstate', handlePopState);
		};
	}, [state.view, dispatch]);

	if (state.view === 'landing') {
		return <TrainerLanding />;
	}

	if (state.view === 'training') {
		return (
			<>
				<TrainerToolbar />
				<div className={b('training-layout')}>
					<div className={b('panel', {center: true})}>
						<TrainingArea />
					</div>
					<div className={b('panel', {right: true})}>
						<StatsPanel />
					</div>
				</div>
			</>
		);
	}

	return (
		<>
			<TrainerToolbar />
			<div className={b('selection-layout')}>
				<AlgorithmSelector />
			</div>
		</>
	);
}

export default function Trainer() {
	const {t} = useTranslation();
	const location = useLocation();

	useEffect(() => {
		ensureCubingReady();
		ensureKPuzzleReady();
		loadLLPatterns();
		loadPuzzlePatterns();
		loadIsometricPatterns();
	}, []);

	useEffect(() => {
		document.documentElement.style.overflow = 'hidden';
		document.body.style.overflow = 'hidden';
		return () => {
			document.documentElement.style.overflow = '';
			document.body.style.overflow = '';
		};
	}, []);

	return (
		<FeatureGuard feature="trainer_enabled" pageNameKey="nav.trainer">
		<TrainerProvider>
			<div className={b()}>
				<Header title={t('trainer.page_title')} path={location.pathname} />
				<PageTitle pageName="Trainer" />
				<TrainerContent />
			</div>
		</TrainerProvider>
		</FeatureGuard>
	);
}
