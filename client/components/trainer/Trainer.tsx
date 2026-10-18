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
import AccountRequired from '../common/account_required/AccountRequired';
import {useMe} from '../../util/hooks/useMe';
import RecognitionRoot from './recognition/RecognitionRoot';
import EfficiencyRoot from './efficiency/EfficiencyRoot';
import OllcpRoot from './ollcp/OllcpRoot';
import {ensureCubingReady} from '../../util/trainer/algorithm_engine';
import {ensureKPuzzleReady} from '../../util/trainer/pattern_utils';
import {loadLLPatterns} from '../../util/trainer/ll_patterns';
import {loadPuzzlePatterns} from '../../util/trainer/puzzle_patterns';
import {loadIsometricPatterns} from '../../util/trainer/isometric_patterns';
import FeatureGuard from '../common/page_disabled/FeatureGuard';
import {useGeneral} from '../../util/hooks/useGeneral';
import StudyModeSwitch from './hub/StudyModeSwitch';
import {accountRequiredKey, isPublicTrainerView, studySwitchPlacement} from './hub/hub_rules';
import {MySets, CommunitySets, AlgSetPage, SetPicker, CommunityBanner} from './sets';
import './common/TrainerAccents.scss';
import './hub/TrainerHub.scss';

const b = block('trainer');
const bh = block('trainer-hub');

function TrainerContent() {
	const {state} = useTrainerContext();
	const me = useMe();
	const mobileMode = useGeneral('mobile_mode');

	// URL ↔ reducer synchronization (mode + standard/smart view). Replaces old manual pushState/popstate
	// hack; back/forward, deep-link, refresh and mobile swipe-back now work correctly.
	useTrainerUrlSync();

	if (state.view === 'landing' || state.view === 'modes') {
		return <TrainerLanding />;
	}

	const otherTrainer = state.mode === 'recognition' || state.mode === 'efficiency' || state.mode === 'ollcp';

	// The hub and the Trainers page stay open to everyone (an SEO surface), but a training
	// session records attempts against an account, so this is where the line is.
	// The Community Sets list and a shared set's page stay open too (trainer-sets 2.4); the rest
	// says what it needs inside the shell, and My Sets keeps its Community Sets entry for visitors.
	if (!me && otherTrainer) {
		return <AccountRequired descriptionKey="account_required.trainer" />;
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

	// ── Algorithm Trainer (Standard / Smart Cube) ──
	const locked = !me && !isPublicTrainerView(state.view);
	const accountRequired = <AccountRequired descriptionKey={accountRequiredKey(state.view)} />;

	if (state.view === 'training') {
		if (locked) {
			return (
				<>
					<TrainerToolbar />
					<div className={bh('scroll')}>{accountRequired}</div>
				</>
			);
		}
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

	// Algorithm Sets: My Sets (with the Community Sets entry on top, visitors included) and
	// Community Sets. Each scrolls in its own container (the page body is locked below).
	if (state.view === 'sets') {
		return (
			<>
				<TrainerToolbar />
				<div className={bh('scroll')}>
					<CommunityBanner />
					{locked ? accountRequired : <MySets />}
				</div>
			</>
		);
	}

	if (state.view === 'community') {
		return (
			<>
				<TrainerToolbar />
				<div className={bh('scroll')}>
					<CommunitySets />
				</div>
			</>
		);
	}

	// A set's page (open to visitors, read only) and its algorithm picker (owner only; the
	// picker owns its layout and scrolling, it has a selection bar at the bottom).
	if (state.view === 'set') {
		return (
			<>
				<TrainerToolbar />
				<div className={bh('scroll')}>
					<AlgSetPage />
				</div>
			</>
		);
	}

	if (state.view === 'set-add') {
		return (
			<>
				<TrainerToolbar />
				{locked ? <div className={bh('scroll')}>{accountRequired}</div> : <div className={bh('pane')}><SetPicker /></div>}
			</>
		);
	}

	// Algorithm selector
	const switchRow = !locked && studySwitchPlacement(state.view, mobileMode) === 'row';
	return (
		<>
			<TrainerToolbar />
			{switchRow ? (
				<div className={bh('switch-row')}>
					<StudyModeSwitch block />
				</div>
			) : null}
			{locked ? (
				<div className={bh('scroll')}>{accountRequired}</div>
			) : (
				<div className={b('selection-layout')}>
					<AlgorithmSelector />
				</div>
			)}
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
