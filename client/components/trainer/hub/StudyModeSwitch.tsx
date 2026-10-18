/**
 * StudyModeSwitch: Standard / Smart Cube switch of the Algorithm Trainer (trainer-sets 2.3).
 *
 * The mode belongs to the study, not to a set: the same set runs in both. A tap sends
 * SET_STUDY_MODE, which changes only the mode (view and queue stay; a running set study re-filters
 * its cards in TrainerProvider) and remembers it as `lastMode`. Locked while the timer runs.
 *
 * Pro: for a Basic user (Pro gating on) the Smart side carries a "Pro" badge and opens the Pro
 * screen instead of switching. This is only the UI; cube tracking itself stays locked at the
 * point of consumption (TrainingArea `useSmartCube`).
 *
 * Variants: `segmented` (two separate buttons in the style of the Stats page's All / Smart Cube
 * toggle: icon tile + label, the active one filled with the primary colour; header, the mobile
 * row under the header and the set page) and `chip` (one small button in the mobile training
 * header that flips the mode).
 */
import React from 'react';
import {useDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import {Timer, BluetoothConnected} from 'phosphor-react';
import block from '../../../styles/bem';
import {useTrainerContext} from '../TrainerContext';
import {useMe} from '../../../util/hooks/useMe';
import {isPro, isProEnabled} from '../../../lib/pro';
import {smartModeAllowed} from '../../../util/trainer/study_mode';
import {openProOnlyModal} from '../../common/pro_only/openProOnlyModal';
import {studySwitchOutcome} from './hub_rules';
import type {StudyMode} from '../types';
import '../common/TrainerAccents.scss';
import './TrainerHub.scss';

const b = block('trainer-mode-switch');

interface Props {
	variant?: 'segmented' | 'chip';
	/** Stretch to the container width (mobile row, set page). */
	block?: boolean;
}

export default function StudyModeSwitch({variant = 'segmented', block: fullWidth = false}: Props) {
	const {t} = useTranslation();
	const reduxDispatch = useDispatch();
	const {state, dispatch} = useTrainerContext();
	const me = useMe();

	const proGating = isProEnabled();
	const smartAllowed = smartModeAllowed(proGating, isPro(me || undefined));
	const current: StudyMode = state.mode === 'smart' ? 'smart' : 'standard';
	const running = state.timerState === 'RUNNING';
	// The badge only means something where Smart is actually locked.
	const showPro = proGating && !smartAllowed;

	// Only the Algorithm Trainer has study modes.
	if (state.mode !== 'standard' && state.mode !== 'smart') return null;

	const pick = (target: StudyMode) => {
		const outcome = studySwitchOutcome(current, target, smartAllowed, running);
		if (outcome === 'upsell') {
			openProOnlyModal(reduxDispatch, t, 'trainer_smart_cube');
			return;
		}
		if (outcome === 'switch') dispatch({type: 'SET_STUDY_MODE', payload: target});
	};

	const runningTitle = running ? t('trainer.study_mode.running_locked') : undefined;

	if (variant === 'chip') {
		const target: StudyMode = current === 'smart' ? 'standard' : 'smart';
		const label = current === 'smart' ? t('trainer.study_mode.smart_short') : t('trainer.study_mode.standard');
		return (
			<button
				type="button"
				className={b('chip', {smart: current === 'smart'})}
				onClick={() => pick(target)}
				disabled={running}
				title={runningTitle}
				aria-label={t('trainer.study_mode.switch_to', {
					mode: target === 'smart' ? t('trainer.study_mode.smart') : t('trainer.study_mode.standard'),
				})}
			>
				{current === 'smart' ? <BluetoothConnected size={15} weight="bold" /> : <Timer size={15} weight="bold" />}
				<span>{label}</span>
				{showPro && current === 'standard' ? <span className={b('pro')}>{t('trainer.study_mode.pro')}</span> : null}
			</button>
		);
	}

	return (
		<div
			className={b({block: fullWidth, disabled: running})}
			role="radiogroup"
			aria-label={t('trainer.study_mode.label')}
			title={runningTitle}
		>
			<button
				type="button"
				role="radio"
				aria-checked={current === 'standard'}
				className={b('side', {active: current === 'standard', standard: true})}
				onClick={() => pick('standard')}
				disabled={running}
			>
				<span className={b('side-icon')}>
					<Timer size={17} weight="bold" />
				</span>
				<span className={b('side-label')}>{t('trainer.study_mode.standard')}</span>
			</button>
			<button
				type="button"
				role="radio"
				aria-checked={current === 'smart'}
				className={b('side', {active: current === 'smart', smart: true, locked: showPro})}
				onClick={() => pick('smart')}
				disabled={running}
				title={showPro ? t('trainer.study_mode.smart_locked') : undefined}
			>
				<span className={b('side-icon')}>
					<BluetoothConnected size={17} weight="bold" />
				</span>
				<span className={b('side-label')}>{t('trainer.study_mode.smart')}</span>
				{showPro ? <span className={b('pro')}>{t('trainer.study_mode.pro')}</span> : null}
			</button>
		</div>
	);
}
