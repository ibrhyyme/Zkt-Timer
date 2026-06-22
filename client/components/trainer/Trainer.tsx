import React, {useEffect} from 'react';
import './Trainer.scss';
import PageTitle from '../common/page_title/PageTitle';
import block from '../../styles/bem';
import Header from '../layout/header/Header';
import {useLocation} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {TrainerProvider, useTrainerContext} from './TrainerContext';
import {useTrainerUrlSync} from './hooks/useTrainerUrlSync';
import AlgorithmSelector from './panels/algorithm_selector/AlgorithmSelector';
import TrainingArea from './panels/training_area/TrainingArea';
import StatsPanel from './panels/stats_panel/StatsPanel';
import TrainerToolbar from './toolbar/TrainerToolbar';
import TrainerLanding from './TrainerLanding';
import RecognitionRoot from './recognition/RecognitionRoot';
import EfficiencyRoot from './efficiency/EfficiencyRoot';
import OllcpRoot from './ollcp/OllcpRoot';
import {ensureCubingReady} from '../../util/trainer/algorithm_engine';
import {ensureKPuzzleReady} from '../../util/trainer/pattern_utils';
import {loadLLPatterns} from '../../util/trainer/ll_patterns';
import {loadPuzzlePatterns} from '../../util/trainer/puzzle_patterns';
import {loadIsometricPatterns} from '../../util/trainer/isometric_patterns';
import FeatureGuard from '../common/page_disabled/FeatureGuard';

const b = block('trainer');

function TrainerContent() {
	const {state} = useTrainerContext();

	// URL ↔ reducer synchronization (mode + standard/smart view). Replaces old manual pushState/popstate
	// hack; back/forward, deep-link, refresh and mobile swipe-back now work correctly.
	useTrainerUrlSync();

	if (state.view === 'landing') {
		return <TrainerLanding />;
	}

	// Recognition mode manages all its own views
	if (state.mode === 'recognition') {
		return <RecognitionRoot />;
	}

	// Efficiency mode (cross/xcross/eocross) manages its own views
	if (state.mode === 'efficiency') {
		return <EfficiencyRoot />;
	}

	// OLLCP recognition mode (admin-only) manages its own views
	if (state.mode === 'ollcp') {
		return <OllcpRoot />;
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
		document.documentElement.style.touchAction = 'pan-y';
		document.body.style.touchAction = 'pan-y';
		(document.documentElement.style as any).overscrollBehavior = 'none';
		(document.body.style as any).overscrollBehavior = 'none';
		return () => {
			document.documentElement.style.overflow = '';
			document.body.style.overflow = '';
			document.documentElement.style.touchAction = '';
			document.body.style.touchAction = '';
			(document.documentElement.style as any).overscrollBehavior = '';
			(document.body.style as any).overscrollBehavior = '';
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
