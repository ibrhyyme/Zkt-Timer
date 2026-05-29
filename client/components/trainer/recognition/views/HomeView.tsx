/**
 * HomeView — landing/home view. Hero + PllShowcase + GuideGroupCard 9'lu grid.
 * Quest mode aktifse QuestHero on plana cikar.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {Lightning, MapTrifold} from 'phosphor-react';
import Button from '../../../common/button/Button';
import GuideGroupCard from '../components/GuideGroupCard';
import QuestHero from '../components/QuestHero';
import PllShowcase from '../components/PllShowcase';
import {useRecognitionContext} from '../RecognitionContext';
import {useKeydown} from '../hooks/useKeydown';
import {useQuestProgress} from '../hooks/useQuestProgress';
import {getGuideData, getGuideGroup} from '../../../../util/trainer/recognition/guide_lookup';
import {keysForStep, type QuestStep} from '../../../../util/trainer/recognition/quest';
import {buildSessionPool, SIZE_MEDIUM} from '../../../../util/trainer/recognition/session_sizing';
import {isMobile} from '../../../../util/trainer/recognition/device';

const b = block('trainer-recognition');

export default function HomeView() {
	const {t} = useTranslation();
	const {state, updateSettings, startSession, setRecognitionView} = useRecognitionContext();
	const quest = useQuestProgress();
	// Hydration flag: ilk render'da localStorage'dan gelen settings'in
	// SSR default'la celismesini bekle ki hero kismi flicker etmesin.
	const [hydrated, setHydrated] = useState(false);
	useEffect(() => setHydrated(true), []);
	const questActive = hydrated && state.settings.questMode && state.settings.questStarted;

	const guideData = getGuideData();

	const startQuestStep = useCallback(
		(step: QuestStep) => {
			const keys = keysForStep(step);
			const pool = step.groups ? buildSessionPool(keys, SIZE_MEDIUM) : null;
			startSession(pool, SIZE_MEDIUM, step.label);
			updateSettings({activeQuestStepId: step.id, questStarted: true});
			setRecognitionView('trainer');
		},
		[startSession, updateSettings, setRecognitionView]
	);

	const startJourney = useCallback(() => {
		updateSettings({questStarted: true});
	}, [updateSettings]);

	useKeydown((e) => {
		if (e.code === 'Space' && !e.repeat) {
			const target = e.target as HTMLElement;
			if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
			e.preventDefault();
			if (questActive && quest.currentStep && !quest.questComplete) {
				startQuestStep(quest.currentStep);
			} else {
				setRecognitionView('setup');
			}
		}
	});

	const renderHero = () => {
		if (questActive) {
			return (
				<QuestHero
					stepStatuses={quest.stepStatuses}
					currentStep={quest.currentStep}
					currentStepIndex={quest.currentStepIndex}
					masteredCount={quest.masteredCount}
					questComplete={quest.questComplete}
					loading={quest.loading}
					onStartStep={startQuestStep}
					onFreePractice={() => setRecognitionView('setup')}
				/>
			);
		}
		if (state.settings.questMode) {
			return (
				<section className={b('home-hero')}>
					<h1 className={b('home-hero-title')}>
						{t('trainer.recognition.home_title', {defaultValue: 'PLL Recognition Trainer'})}
					</h1>
					<p className={b('home-hero-subtitle')}>
						<strong className={b('home-hero-primary')}>
							{t('trainer.recognition.home_distinct_patterns', {defaultValue: '73 distinct patterns'})}
						</strong>{' '}
						{t('trainer.recognition.home_subtitle', {
							defaultValue:
								'hide inside 21 PLL cases — each one can show up in any color combo and from any angle. The trainer adapts to your weaknesses.',
						})}
					</p>
					<div className={b('home-cta-row')}>
						<Button
							primary
							large
							icon={<MapTrifold />}
							text={t('trainer.recognition.home_start_journey', {defaultValue: 'Start Journey'})}
							onClick={startJourney}
						/>
						<Button
							gray
							large
							text={t('trainer.recognition.home_free_practice', {defaultValue: 'Free Practice'})}
							onClick={() => setRecognitionView('setup')}
						/>
					</div>
					{!isMobile && (
						<div className={b('home-cta-hint')}>
							{t('trainer.recognition.home_press_space', {defaultValue: 'Press Space to start'})}
						</div>
					)}
				</section>
			);
		}
		return (
			<section className={b('home-hero')}>
				<h1 className={b('home-hero-title')}>
					{t('trainer.recognition.home_title', {defaultValue: 'PLL Recognition Trainer'})}
				</h1>
				<p className={b('home-hero-subtitle')}>
					<strong className={b('home-hero-primary')}>
						{t('trainer.recognition.home_distinct_patterns', {defaultValue: '73 distinct patterns'})}
					</strong>{' '}
					{t('trainer.recognition.home_subtitle_short', {
						defaultValue: 'hide inside 21 PLL cases.',
					})}
				</p>
				<div className={b('home-cta-row')}>
					<Button
						primary
						large
						icon={<Lightning weight="fill" />}
						text={t('trainer.recognition.home_start_training', {defaultValue: 'Start Training'})}
						onClick={() => setRecognitionView('setup')}
					/>
				</div>
			</section>
		);
	};

	// Hem ilk mount hem useQuestProgress (Dexie async) yuklenmeden render etme —
	// QuestHero'nun yari-bos hali ile dolu hali arasi flicker'i onler.
	const questGateRequired = state.settings.questMode && state.settings.questStarted;
	if (!hydrated || (questGateRequired && quest.loading)) {
		return (
			<div className={b('home')}>
				<div className={b('home-hero-skeleton')} />
			</div>
		);
	}

	return (
		<div className={b('home')}>
			{renderHero()}

			<PllShowcase />

			<div className={b('home-cta-row')}>
				<Button
					primary
					large
					icon={<Lightning weight="fill" />}
					text={t('trainer.recognition.home_start_training', {defaultValue: 'Start Training'})}
					onClick={() => setRecognitionView('setup')}
				/>
			</div>

			<section className={b('home-section')}>
				<h3 className={b('home-section-title')}>
					{t('trainer.recognition.home_guide_section_title', {defaultValue: 'Two-Sided PLL Recognition Guide'})}
				</h3>
				<p className={b('home-section-intro')}>
					{t('trainer.recognition.home_guide_intro', {
						defaultValue:
							'Scan the two visible faces in order: 3-bar → lights → 2-bar → bookends. Match the first pattern, then identify the case.',
					})}
				</p>
				<div className={b('home-guide-grid')}>
					{guideData.layout.rows.flat().map((groupId) => {
						const group = getGuideGroup(groupId);
						if (!group) return null;
						const stepStatus = quest.stepStatuses.find(
							(s) => !s.step.isCombo && s.step.groups?.[0] === groupId
						);
						return (
							<GuideGroupCard
								key={groupId}
								group={group}
								defaultPatternColumns={guideData.layout.defaultPatternColumns}
								showPracticeButton={true}
								mastered={stepStatus?.mastered || false}
								bestAccuracy={stepStatus?.bestAccuracy ?? null}
								onPractice={() => setRecognitionView('setup')}
								practiceLabel={t('trainer.recognition.guide_practice_button', {defaultValue: 'Practice'})}
							/>
						);
					})}
				</div>
			</section>
		</div>
	);
}
