/**
 * TrainerView — oyun ekrani. Cube, guide hint, klavye/buton, results sidebar/modal.
 */
import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import Button, {CommonType} from '../../../common/button/Button';
import PllPic from '../components/PllPic';
import GuideHint from '../components/GuideHint';
import Note from '../components/Note';
import OnScreenKeyboard from '../components/OnScreenKeyboard';
import ResultsList from '../components/ResultsList';
import ResultsModal from '../components/ResultsModal';
import {useRecognitionContext, useCurrentCase} from '../RecognitionContext';
import {useTrainerKeyboard} from '../hooks/useTrainerKeyboard';
import {useBreakpoint} from '../hooks/useBreakpoint';
import {GameState} from '../../../../util/trainer/recognition/game_constants';
import {aufByDturn} from '../../../../util/trainer/recognition/pll_constants';
import {caseToKey} from '../../../../util/trainer/recognition/pll_cases';
import {randomRotationOffset, type Rotation, type ColorScheme} from '../../../../util/trainer/recognition/cube_display';
import {mutateColorScheme} from '../../../../util/trainer/recognition/colors';
import {isMobile} from '../../../../util/trainer/recognition/device';

const b = block('trainer-recognition');

export default function TrainerView() {
	const {t} = useTranslation();
	const {state, pausePlay, resumePlay, giveUpOnCase, setInitial, setRecognitionView, setNote, dispatch} =
		useRecognitionContext();
	const currentCase = useCurrentCase();
	const isXl = useBreakpoint('(min-width: 1200px)');
	const isMobileViewport = useBreakpoint('(max-width: 767px)');
	const {pendingKey} = useTrainerKeyboard();
	const cubeSize = isMobileViewport ? 240 : isXl ? 400 : 320;

	const [varianceRotation, setVarianceRotation] = useState<Rotation[] | null>(null);
	const [varianceColorScheme, setVarianceColorScheme] = useState<ColorScheme | null>(null);

	useEffect(() => {
		setInitial();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (state.session.state === GameState.EvaluationDone) {
			setRecognitionView('results');
		}
	}, [state.session.state, setRecognitionView]);

	useEffect(() => {
		if (currentCase) {
			setVarianceRotation(
				state.settings.angleVariance ? randomRotationOffset(state.settings.puzzleRotations) : null
			);
			setVarianceColorScheme(state.settings.colorVariance ? mutateColorScheme(state.settings.colorScheme) : null);
		} else {
			setVarianceRotation(null);
			setVarianceColorScheme(null);
		}
	}, [
		currentCase,
		state.settings.angleVariance,
		state.settings.colorVariance,
		state.settings.puzzleRotations,
		state.settings.colorScheme,
	]);

	const session = state.session;
	const showMistake = session.state === GameState.Playing && !!session.mistake;
	const auf = useMemo(() => (currentCase ? aufByDturn(currentCase.dTurn) : ''), [currentCase]);

	const totalCases = useMemo(
		() => session.queue.length + session.results.length - (session.mistake === '' ? 0 : 1),
		[session.queue.length, session.results.length, session.mistake]
	);
	const completed = session.results.length;
	const progressPercent = totalCases > 0 ? (completed / totalCases) * 100 : 0;

	const keyPressHint = useMemo(() => {
		if (session.state === GameState.Playing && pendingKey) {
			return `${pendingKey}_ ...`;
		}
		if (session.state === GameState.Playing && session.mistake) {
			const correctName = state.settings.fullNameMode ? currentCase?.name : currentCase?.name[0];
			return state.settings.showOnScreenKeyboard
				? t('trainer.recognition.trainer_hint_continue_click', {name: correctName, defaultValue: `Click ${correctName} to continue`})
				: t('trainer.recognition.trainer_hint_continue', {name: correctName, defaultValue: `Press ${correctName} to continue, Esc to pause`});
		}
		if (session.state === GameState.Playing && !session.mistake) {
			return state.settings.showOnScreenKeyboard
				? t('trainer.recognition.trainer_hint_which_pll', {defaultValue: 'Which PLL case is this?'})
				: t('trainer.recognition.trainer_hint_enter_pll', {defaultValue: 'Enter PLL case name. Press Esc to pause'});
		}
		if (session.state === GameState.Paused) {
			return state.settings.showOnScreenKeyboard
				? ''
				: session.results.length === 0
				? t('trainer.recognition.trainer_hint_press_space_start', {defaultValue: 'Press space to start'})
				: t('trainer.recognition.trainer_hint_press_space_resume', {defaultValue: 'Press space to resume'});
		}
		return t('trainer.recognition.trainer_hint_press_esc', {defaultValue: 'Press Esc to pause'});
	}, [session.state, session.mistake, session.results.length, pendingKey, currentCase, state.settings, t]);

	const cubePic = currentCase ? (
		<PllPic
			pllCase={currentCase}
			viewType={session.mistake ? 'cube-pll' : 'cube'}
			size={cubeSize}
			clickable={false}
			rotationOverride={varianceRotation}
			colorSchemeOverride={varianceColorScheme}
			puzzleRotations={state.settings.puzzleRotations}
			strokeWidth={state.settings.strokeWidth}
			colorScheme={state.settings.colorScheme}
		/>
	) : null;

	const noteKey = currentCase ? caseToKey(currentCase) : '';
	const noteValue = noteKey ? state.notes.notes[noteKey] || '' : '';

	const mistakeBlock = showMistake && currentCase ? (
		<>
			<h2 className={b('game-case-title')}>
				{t('trainer.recognition.trainer_perm_label', {name: currentCase.name, defaultValue: `${currentCase.name} perm`})}
				{auf && (
					<span className={b('game-auf-badge')} title="AUF">
						+{auf}
					</span>
				)}
			</h2>
			<GuideHint pllCase={currentCase} />
			<div style={{marginTop: 10}}>
				<Note
					value={noteValue}
					onChange={(v) => setNote(noteKey, v)}
					enableHotkeys={true}
					addLabel={t('trainer.recognition.notes_add', {defaultValue: 'Add note'})}
					editLabel={t('trainer.recognition.notes_edit_title', {defaultValue: 'Edit note'})}
					saveHint={t('trainer.recognition.notes_save_hint', {defaultValue: 'Press Enter to save'})}
				/>
			</div>
		</>
	) : null;

	return (
		<div className={b('layout')}>
			<div className={b('layout-main')}>
				<div className={b('game')}>
					<div className={b('game-progress')}>
						<div className={b('game-progress-bar')} style={{width: `${progressPercent}%`}} />
						<span className={b('game-progress-text')}>
							{completed}/{totalCases}
						</span>
					</div>

					<div className={b('game-cube-zone')}>
						<div className={b('game-side', {left: true})}>{isXl && showMistake ? mistakeBlock : null}</div>
						<div className={b('game-center')}>{cubePic}</div>
						<div className={b('game-side', {right: true})} />
					</div>

					{(isXl || !showMistake) && <div className={b('game-hint')}>{keyPressHint}</div>}

					{!isXl && showMistake && <div className={b('game-mistake-section')}>{mistakeBlock}</div>}

					{session.state === GameState.Paused && (
						<div className={b('game-start-row')}>
							<Button
								primary
								large
								text={
									session.results.length === 0
										? t('trainer.recognition.trainer_start', {defaultValue: 'Start'}) +
										  (!isMobile ? ' (Space)' : '')
										: t('trainer.recognition.trainer_resume', {defaultValue: 'Resume'}) +
										  (!isMobile ? ' (Space)' : '')
								}
								onClick={resumePlay}
							/>
						</div>
					)}

					{!isXl && showMistake && <div className={b('game-hint')}>{keyPressHint}</div>}

					<OnScreenKeyboard />

					{session.state === GameState.Playing && (
						<div className={b('game-actions')}>
							{isMobile && (
								<Button
									theme={CommonType.GRAY}
									text={t('trainer.recognition.trainer_pause', {defaultValue: 'Pause'})}
									onClick={pausePlay}
								/>
							)}
							{!session.mistake && (
								<Button
									theme={CommonType.GRAY}
									text={
										t('trainer.recognition.trainer_give_up', {defaultValue: 'Give up'}) +
										(!isMobile ? ' (S/?)' : '')
									}
									onClick={giveUpOnCase}
								/>
							)}
						</div>
					)}
				</div>
			</div>

			<div className={b('layout-sidebar')}>
				<div className={b('sidebar-card')}>
					<div className={b('sidebar-title')}>
						{t('trainer.recognition.trainer_results_title', {defaultValue: 'Results'})} ({completed}/{totalCases})
					</div>
					<hr className={b('sidebar-divider')} />
					<div className={b('sidebar-scroll')}>
						<ResultsList results={session.results} pictureSize={70} showNotes={false} />
					</div>
				</div>
			</div>

			{session.showResultsModal && (
				<ResultsModal
					results={session.results}
					totalCases={totalCases}
					onClose={() => dispatch({type: 'SESSION_SET_RESULTS_MODAL', payload: false})}
				/>
			)}
		</div>
	);
}
