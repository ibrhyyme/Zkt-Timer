import React, {useEffect} from 'react';
import './Trainer.scss';
import {Cube, Lightning, Clock} from 'phosphor-react';
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
import {ensureCubingReady} from '../../util/trainer/algorithm_engine';
import {ensureKPuzzleReady} from '../../util/trainer/pattern_utils';
import {loadLLPatterns} from '../../util/trainer/ll_patterns';
import {loadPuzzlePatterns} from '../../util/trainer/puzzle_patterns';
import {useMe} from '../../util/hooks/useMe';
import {isProEnabled, isPro} from '../../lib/pro';

const b = block('trainer');

function TrainerContent() {
	const {t} = useTranslation();
	const {state} = useTrainerContext();

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

function ComingSoonContent() {
	const {t} = useTranslation();

	return (
		<div className={b('coming-soon')}>
			<div className={b('cs-hero')}>
				{/* Küp */}
				<div className={b('cs-cube-ring')}>
						<Cube size={64} weight="duotone" className={b('cs-cube-icon')} />
				</div>

				{/* Başlık */}
				<div className={b('cs-heading')}>
					<h1 className={b('cs-title')}>{t('trainer.title')}</h1>
					<h2 className={b('cs-subtitle')}>{t('trainer.coming_soon')}</h2>
				</div>

				<p className={b('cs-description')}>{t('trainer.description')}</p>

				{/* Feature kartları */}
				<div className={b('cs-cards')}>
					<div className={b('cs-card')}>
						<div className={b('cs-card__icon', {blue: true})}>
							<Cube size={24} weight="duotone" />
						</div>
						<h3 className={b('cs-card__title')}>{t('trainer.feature_algorithms_title')}</h3>
						<p className={b('cs-card__desc')}>{t('trainer.feature_algorithms_desc')}</p>
					</div>

					<div className={b('cs-card')}>
						<div className={b('cs-card__icon', {purple: true})}>
							<Lightning size={24} weight="duotone" />
						</div>
						<h3 className={b('cs-card__title')}>{t('trainer.feature_smart_cube_title')}</h3>
						<p className={b('cs-card__desc')}>{t('trainer.feature_smart_cube_desc')}</p>
					</div>

					<div className={b('cs-card')}>
						<div className={b('cs-card__icon', {green: true})}>
							<Clock size={24} weight="duotone" />
						</div>
						<h3 className={b('cs-card__title')}>{t('trainer.feature_performance_title')}</h3>
						<p className={b('cs-card__desc')}>{t('trainer.feature_performance_desc')}</p>
					</div>
				</div>

				{/* Progress */}
				<div className={b('cs-progress')}>
					<div className={b('cs-progress__track')}>
						<div className={b('cs-progress__fill')} />
					</div>
					<span className={b('cs-progress__label')}>{t('trainer.progress_text')}</span>
				</div>

				<p className={b('cs-footer')}>{t('trainer.footer')}</p>
			</div>
		</div>
	);
}

export default function Trainer() {
	const {t} = useTranslation();
	const location = useLocation();
	const me = useMe();

	const showFullTrainer = !isProEnabled() || isPro(me);

	useEffect(() => {
		if (showFullTrainer) {
			ensureCubingReady();
			ensureKPuzzleReady();
			loadLLPatterns();
			loadPuzzlePatterns();
		}
	}, [showFullTrainer]);

	useEffect(() => {
		document.documentElement.style.overflow = 'hidden';
		document.body.style.overflow = 'hidden';
		return () => {
			document.documentElement.style.overflow = '';
			document.body.style.overflow = '';
		};
	}, []);

	if (!showFullTrainer) {
		return (
			<div className={b()}>
				<Header title={t('trainer.page_title')} path={location.pathname} />
				<PageTitle pageName="Trainer" />
				<ComingSoonContent />
			</div>
		);
	}

	return (
		<TrainerProvider>
			<div className={b()}>
				<Header title={t('trainer.page_title')} path={location.pathname} />
				<PageTitle pageName="Trainer" />
				<TrainerContent />
			</div>
		</TrainerProvider>
	);
}
