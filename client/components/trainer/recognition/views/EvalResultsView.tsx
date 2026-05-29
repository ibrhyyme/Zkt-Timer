/**
 * EvalResultsView — session sonu ekrani. Stats kart + CTA + ResultsList.
 * PB/quest mastery durumunda confetti tetiklenir.
 * Referans `src/views/EvalResults.vue` portu.
 */
import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {useDispatch as useReduxDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {Star} from 'phosphor-react';
import EvalCtaButtons from '../components/EvalCtaButtons';
import ResultsList from '../components/ResultsList';
import CaseVariationsModal from '../components/CaseVariationsModal';
import {useRecognitionContext} from '../RecognitionContext';
import {resultsToEvalResults, evalQueueSize, type ResultRecord} from '../../../../util/trainer/recognition/evaluation';
import {msToHumanReadable} from '../../../../util/trainer/recognition/time_formatter';
import {formatAccuracy} from '../../../../util/trainer/recognition/formatters';
import {caseToKey} from '../../../../util/trainer/recognition/pll_cases';
import {useSessionPB} from '../hooks/usePersonalBests';
import {QUEST_STEPS, MASTERY_ACCURACY, keysForStep, type QuestStep} from '../../../../util/trainer/recognition/quest';
import {buildSessionPool, SIZE_MEDIUM} from '../../../../util/trainer/recognition/session_sizing';
import {openModal} from '../../../../actions/general';

const b = block('trainer-recognition');

let _confetti: ((opts?: object) => void) | null = null;
let _confettiLoadPromise: Promise<void> | null = null;
async function ensureConfetti(): Promise<void> {
	if (_confetti || typeof window === 'undefined') return;
	if (!_confettiLoadPromise) {
		_confettiLoadPromise = import('canvas-confetti').then((m: any) => {
			_confetti = m.default || m;
		});
	}
	await _confettiLoadPromise;
}

function fireCelebration() {
	ensureConfetti().then(() => {
		if (!_confetti) return;
		_confetti({particleCount: 150, spread: 70, origin: {y: 0.6}, startVelocity: 50});
	});
}

export default function EvalResultsView() {
	const {t} = useTranslation();
	const reduxDispatch = useReduxDispatch();
	const {state, startSession, startPersonalized, updateSettings, setRecognitionView, setNote} = useRecognitionContext();
	const session = state.session;

	const openVariations = useCallback(
		(result: ResultRecord) => {
			if (!result.pllCase) return;
			const key = caseToKey(result.pllCase);
			const initialNote = state.notes.notes[key] || '';
			reduxDispatch(
				openModal(
					<CaseVariationsModal
						pllCase={result.pllCase}
						puzzleRotations={state.settings.puzzleRotations}
						strokeWidth={state.settings.strokeWidth}
						colorScheme={state.settings.colorScheme}
						initialNote={initialNote}
						onNoteChange={(v) => setNote(key, v)}
						labels={{
							crossColor: t('trainer.recognition.variations_cross_color', {defaultValue: 'Cross color'}),
							noteAdd: t('trainer.recognition.notes_add', {defaultValue: 'Add note'}),
							noteEdit: t('trainer.recognition.notes_edit_title', {defaultValue: 'Edit note'}),
							noteSaveHint: t('trainer.recognition.notes_save_hint', {defaultValue: 'Press Enter to save'}),
						}}
					/>,
					{
						title: `${result.pllCase.name} perm`,
						width: 760,
						compact: true,
						closeButtonText: t('solve_info.done', {defaultValue: 'Done'}),
					}
				)
			);
		},
		[reduxDispatch, state.notes.notes, state.settings, setNote, t]
	);

	const evalResults = useMemo(() => resultsToEvalResults(session.results), [session.results]);

	const totalTimeSpent = useMemo(() => {
		let ms = 0;
		session.results.forEach((r) => {
			ms += new Date(r.finished).getTime() - new Date(r.started).getTime();
		});
		return ms;
	}, [session.results]);

	const numCorrect = useMemo(() => session.results.filter((r) => r.mistake === '').length, [session.results]);
	const accuracy = session.results.length > 0 ? numCorrect / session.results.length : 0;
	const avgTimeMs = session.results.length > 0 ? totalTimeSpent / session.results.length : 0;

	const personalizedCount = useMemo(() => evalQueueSize(evalResults, session.pool), [evalResults, session.pool]);

	const activeQuestStepId = state.settings.activeQuestStepId;
	const questStep = useMemo<QuestStep | null>(
		() => (activeQuestStepId ? QUEST_STEPS.find((s) => s.id === activeQuestStepId) || null : null),
		[activeQuestStepId]
	);
	const isQuestSession = questStep !== null;
	const questMastered = isQuestSession && accuracy >= MASTERY_ACCURACY;
	const nextQuestStep = useMemo<QuestStep | null>(
		() => (questStep ? QUEST_STEPS.find((s) => s.id === questStep.id + 1) || null : null),
		[questStep]
	);

	const {pb, sessionNumber, isNewBestAccuracy, isNewBestTime} = useSessionPB(session.pool, session.sizeOption, accuracy, avgTimeMs);

	const celebratedRef = useRef(false);
	useEffect(() => {
		if (celebratedRef.current) return;
		if (isNewBestAccuracy || isNewBestTime || questMastered) {
			celebratedRef.current = true;
			fireCelebration();
		}
	}, [isNewBestAccuracy, isNewBestTime, questMastered]);

	const startQuestStep = useCallback(
		(step: QuestStep) => {
			const keys = keysForStep(step);
			const pool = step.groups ? buildSessionPool(keys, SIZE_MEDIUM) : null;
			startSession(pool, SIZE_MEDIUM, step.label);
			updateSettings({activeQuestStepId: step.id});
			setRecognitionView('trainer');
		},
		[startSession, updateSettings, setRecognitionView]
	);

	const repeatSession = useCallback(() => {
		startSession(session.pool, session.sizeOption, session.presetLabel);
		setRecognitionView('trainer');
	}, [startSession, setRecognitionView, session.pool, session.sizeOption, session.presetLabel]);

	const handlePersonalized = useCallback(() => {
		startPersonalized();
		setRecognitionView('trainer');
	}, [startPersonalized, setRecognitionView]);

	const subtitle1 = t('trainer.recognition.results_subtitle1', {
		correct: numCorrect,
		total: session.results.length,
		time: msToHumanReadable(totalTimeSpent),
		defaultValue: `${numCorrect}/${session.results.length} cases in ${msToHumanReadable(totalTimeSpent)}`,
	});
	const subtitle2 = t('trainer.recognition.results_subtitle2', {
		avg: msToHumanReadable(avgTimeMs),
		defaultValue: `${msToHumanReadable(avgTimeMs)} per case`,
	});

	return (
		<div className={b('eval')}>
			<h2 style={{margin: 0}}>{t('trainer.recognition.results_title', {defaultValue: 'Results'})}</h2>
			<p style={{opacity: 0.75, margin: 0}}>
				{subtitle1} · {subtitle2}
			</p>

			<div className={b('eval-layout')}>
				<div className={b('eval-summary')}>
			{sessionNumber > 0 && (
				<div className={b('eval-stats')}>
					<div className={b('eval-stats-header')}>
						{t('trainer.recognition.results_session_number', {
							n: sessionNumber,
							label: session.presetLabel || 'All Cases',
							defaultValue: `Session #${sessionNumber} · ${session.presetLabel || 'All Cases'}`,
						})}
					</div>

					{!pb && (
						<div className={b('eval-stats-first')}>
							{t('trainer.recognition.results_first_session', {defaultValue: 'First session of this type!'})}
						</div>
					)}

					{pb && (
						<>
							<div className={b('eval-stats-row')}>
								<div className={b('eval-stats-block')}>
									<div className={b('eval-stats-label')}>
										{t('trainer.recognition.results_accuracy', {defaultValue: 'Accuracy'})}
									</div>
									<div
										className={b('eval-stats-value')}
										style={isNewBestAccuracy ? {color: 'rgb(var(--success-color))'} : undefined}
									>
										{formatAccuracy(accuracy)}
										{isNewBestAccuracy && <Star weight="fill" style={{marginLeft: 4, verticalAlign: '-0.1em'}} />}
									</div>
									{!isNewBestAccuracy && (
										<div className={b('eval-stats-pb')}>(PB: {formatAccuracy(pb.bestAccuracy)})</div>
									)}
								</div>
								<div className={b('eval-stats-block')}>
									<div className={b('eval-stats-label')}>
										{t('trainer.recognition.results_avg_time', {defaultValue: 'Avg time'})}
									</div>
									<div
										className={b('eval-stats-value')}
										style={isNewBestTime ? {color: 'rgb(var(--success-color))'} : undefined}
									>
										{msToHumanReadable(avgTimeMs)}
										{isNewBestTime && <Star weight="fill" style={{marginLeft: 4, verticalAlign: '-0.1em'}} />}
									</div>
									{!isNewBestTime && (
										<div className={b('eval-stats-pb')}>(PB: {msToHumanReadable(pb.bestAvgTimeMs)})</div>
									)}
								</div>
							</div>
							{(isNewBestAccuracy || isNewBestTime) && (
								<div className={b('eval-stats-first')}>
									<Star weight="fill" style={{marginRight: 6}} />
									{t('trainer.recognition.results_new_pb', {defaultValue: 'New personal best!'})}
								</div>
							)}
						</>
					)}

					{isQuestSession && questStep && (
						<>
							<hr className={b('eval-stats-divider')} />
							<div className={b('eval-stats-quest')}>
								<div className={b('eval-stats-quest-label')}>
									{t('trainer.recognition.results_journey_label', {label: questStep.label, defaultValue: `Journey · ${questStep.label}`})}
								</div>
								{questMastered ? (
									<span className={b('eval-stats-quest-mastered')}>
										{t('trainer.recognition.results_step_mastered', {defaultValue: 'Step mastered!'})}
									</span>
								) : (
									<span className={b('eval-stats-quest-need')}>
										{t('trainer.recognition.results_need_to_advance', {
											accuracy: formatAccuracy(accuracy),
											target: formatAccuracy(MASTERY_ACCURACY),
											defaultValue: `${formatAccuracy(accuracy)} — need ${formatAccuracy(MASTERY_ACCURACY)} to advance`,
										})}
									</span>
								)}
							</div>
						</>
					)}
				</div>
			)}

					<div className={b('eval-cta')}>
						<EvalCtaButtons
							isQuestSession={isQuestSession}
							questMastered={questMastered}
							nextQuestStep={nextQuestStep}
							personalizedCount={personalizedCount}
							showDescription={true}
							onStartNext={() => nextQuestStep && startQuestStep(nextQuestStep)}
							onRetry={() => questStep && startQuestStep(questStep)}
							onPersonalized={handlePersonalized}
							onRepeat={repeatSession}
							onNewSession={() => setRecognitionView('setup')}
							onJourneyComplete={() => setRecognitionView('home')}
						/>
					</div>
				</div>

				<div className={b('eval-detail')}>
					<p className={b('eval-results-hint')}>
						{t('trainer.recognition.results_click_to_view_variations', {
							defaultValue: 'Click any cube picture to view all color and AUF variations.',
						})}
					</p>
					<div className={b('eval-results')}>
						<ResultsList
							results={evalResults}
							pictureSize={220}
							showNotes={true}
							showTopPicture={true}
							cardLayout={true}
							onItemPicClick={openVariations}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
