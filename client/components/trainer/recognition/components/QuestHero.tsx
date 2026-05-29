/**
 * QuestHero — 13 step roadmap (dots + connectors), phase grouping, current step card, completed steps.
 */
import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {MapTrifold, ArrowRight, Trophy, Lightning, Check} from 'phosphor-react';
import Button, {CommonType} from '../../../common/button/Button';
import GuideGroupCard from './GuideGroupCard';
import StickerPattern from './StickerPattern';
import {getGuideGroup, getGuideData} from '../../../../util/trainer/recognition/guide_lookup';
import {QUEST_PHASES, QUEST_STEPS, keysForStep, type QuestStep} from '../../../../util/trainer/recognition/quest';
import {formatAccuracy} from '../../../../util/trainer/recognition/formatters';
import type {QuestStepStatus} from '../hooks/useQuestProgress';

const b = block('trainer-recognition');

interface QuestHeroProps {
	stepStatuses: QuestStepStatus[];
	currentStep: QuestStep | null;
	currentStepIndex: number;
	masteredCount: number;
	questComplete: boolean;
	loading: boolean;
	onStartStep: (step: QuestStep) => void;
	onFreePractice: () => void;
}

export default function QuestHero({
	stepStatuses,
	currentStep,
	currentStepIndex,
	masteredCount,
	questComplete,
	loading,
	onStartStep,
	onFreePractice,
}: QuestHeroProps) {
	const {t} = useTranslation();
	const [showCompleted, setShowCompleted] = useState(false);

	const currentGuideGroup = useMemo(() => {
		if (!currentStep || currentStep.isCombo) return null;
		return getGuideGroup(currentStep.groups![0]);
	}, [currentStep]);

	const comboGroups = useMemo(() => {
		if (!currentStep || !currentStep.isCombo || !currentStep.groups) return [];
		return currentStep.groups.map((id) => getGuideGroup(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
	}, [currentStep]);

	const caseCount = currentStep ? keysForStep(currentStep).length : 0;
	const completedSteps = useMemo(() => stepStatuses.filter((s) => s.mastered), [stepStatuses]);

	const phaseSteps = useMemo(
		() =>
			QUEST_PHASES.map((phase) => ({
				phase,
				steps: QUEST_STEPS.filter((s) => s.phase === phase.id).map((s) => {
					const status = stepStatuses.find((st) => st.step.id === s.id);
					return {
						step: s,
						mastered: status ? status.mastered : false,
						isCurrent: !!currentStep && s.id === currentStep.id,
					};
				}),
			})),
		[stepStatuses, currentStep]
	);

	return (
		<section className={b('quest-hero')}>
			<div className={b('quest-header')}>
				<h4 className={b('quest-title')}>
					<MapTrifold style={{color: 'rgb(var(--primary-color))', marginRight: 6}} />
					{t('trainer.recognition.quest_journey_title', {defaultValue: 'Your Journey'})}
				</h4>
				<Button
					theme={CommonType.TRANSPARENT}
					small
					text={t('trainer.recognition.quest_free_practice', {defaultValue: 'Free Practice'})}
					icon={<ArrowRight />}
					iconFirst={false}
					className={b('btn-pill')}
					onClick={onFreePractice}
					noMargin
				/>
			</div>

			{!loading && (
				<>
					<div className={b('quest-roadmap')}>
						{phaseSteps.map((pg, pi) => (
							<React.Fragment key={pg.phase.id}>
								{pi > 0 && <div className={b('quest-phase-gap')} />}
								<div className={b('quest-phase')}>
									{pg.steps.map((s, si) => (
										<React.Fragment key={s.step.id}>
											{si > 0 && (
												<div
													className={b('quest-connector', {
														mastered: pg.steps[si - 1].mastered && s.mastered,
													})}
												/>
											)}
											<div
												className={b('quest-dot', {
													mastered: s.mastered,
													current: s.isCurrent,
													combo: s.step.isCombo,
													locked: !s.mastered && !s.isCurrent,
												})}
												title={s.step.label}
											>
												{s.mastered ? <Check weight="bold" /> : null}
											</div>
										</React.Fragment>
									))}
								</div>
							</React.Fragment>
						))}
					</div>
					<div className={b('quest-progress-text')}>
						{t('trainer.recognition.quest_steps_completed', {
							done: masteredCount,
							total: stepStatuses.length,
							defaultValue: `${masteredCount} / ${stepStatuses.length} steps completed`,
						})}
					</div>
				</>
			)}

			{questComplete && (
				<div style={{textAlign: 'center', padding: '1rem'}}>
					<h3 style={{color: 'rgb(var(--success-color))', fontWeight: 700, margin: 0}}>
						<Trophy weight="fill" />{' '}
						{t('trainer.recognition.quest_journey_complete', {defaultValue: 'Journey Complete!'})}
					</h3>
					<p style={{opacity: 0.75, margin: '8px 0 12px'}}>
						{t('trainer.recognition.quest_journey_complete_desc', {
							defaultValue: 'You have mastered all 21 PLL cases across every pattern group.',
						})}
					</p>
					<Button
						primary
						large
						icon={<Lightning weight="fill" />}
						text={t('trainer.recognition.quest_free_practice', {defaultValue: 'Free Practice'})}
						onClick={onFreePractice}
					/>
				</div>
			)}

			{!questComplete && currentStep && !loading && (
				<>
					<div className={b('quest-step-info')}>
						{t('trainer.recognition.quest_step_of', {
							n: currentStepIndex + 1,
							total: stepStatuses.length,
							defaultValue: `Step ${currentStepIndex + 1} of ${stepStatuses.length}`,
						})}
						{currentStep.isCombo && (
							<span className={b('quest-combo-badge')}>
								{t('trainer.recognition.quest_combo_badge', {defaultValue: 'Combo'})}
							</span>
						)}
					</div>

					{!currentStep.isCombo && currentGuideGroup && (
						<div className={b('quest-guide-wrap')}>
							<GuideGroupCard
								group={currentGuideGroup}
								defaultPatternColumns={getGuideData().layout.defaultPatternColumns}
							/>
						</div>
					)}

					{currentStep.isCombo && comboGroups.length > 0 && (
						<div className={b('card')}>
							<h6 style={{margin: '0 0 8px 0', fontWeight: 700}}>{currentStep.label}</h6>
							<div className={b('quest-combo-grid')}>
								{comboGroups.map((g) => (
									<div key={g.id} className={b('quest-combo-cell')}>
										<StickerPattern layers={g.header.layers} cellSize={18} minColumns={6} />
										<div className={b('quest-combo-label')}>{g.title}</div>
									</div>
								))}
							</div>
							<div style={{textAlign: 'center', marginTop: 8}}>
								<span className={b('preset-card-cases-badge')}>
									{t('trainer.recognition.quest_case_count', {count: caseCount, defaultValue: `${caseCount} cases`})}
								</span>
							</div>
						</div>
					)}

					{currentStep.id === 13 && (
						<div className={b('quest-finale')}>
							<h5 className={b('quest-finale-title')}>
								<Trophy /> {t('trainer.recognition.quest_grand_finale', {defaultValue: 'Grand Finale'})}
							</h5>
							<p className={b('quest-finale-desc')}>
								{t('trainer.recognition.quest_grand_finale_desc', {
									defaultValue: 'All 21 PLL cases, all pattern groups combined.',
								})}
							</p>
						</div>
					)}

					<div className={b('quest-cta')}>
						<Button
							primary
							large
							icon={<Lightning weight="fill" />}
							text={t('trainer.recognition.quest_practice_button', {label: currentStep.label, defaultValue: `Practice ${currentStep.label}`})}
							onClick={() => onStartStep(currentStep)}
						/>
						<div className={b('quest-cta-hint')}>
							{t('trainer.recognition.quest_case_count', {count: caseCount, defaultValue: `${caseCount} cases`})}
						</div>
					</div>
				</>
			)}

			{completedSteps.length > 0 && !loading && (
				<div>
					<button
						type="button"
						onClick={() => setShowCompleted((v) => !v)}
						className={b('quest-completed-toggle')}
					>
						<Check style={{color: 'rgb(var(--success-color))', marginRight: 4}} />
						{t('trainer.recognition.quest_mastered_count', {
							count: completedSteps.length,
							defaultValue: `${completedSteps.length} step${completedSteps.length === 1 ? '' : 's'} mastered`,
						})}
						<span style={{marginLeft: 6}}>{showCompleted ? '▲' : '▼'}</span>
					</button>
					{showCompleted && (
						<div className={b('quest-completed-list')}>
							{completedSteps.map((s) => (
								<div key={s.step.id} className={b('quest-completed-item')}>
									<Check style={{color: 'rgb(var(--success-color))'}} />
									<span>{s.step.label}</span>
									{s.bestAccuracy !== null && (
										<span className={b('quest-completed-item-accuracy')}>
											{formatAccuracy(s.bestAccuracy)}
										</span>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</section>
	);
}
