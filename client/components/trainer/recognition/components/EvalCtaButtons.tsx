/**
 * EvalCtaButtons — sonuc ekranindaki CTA butonlari (polymorphic: quest vs free mode).
 */
import React from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {ArrowCounterClockwise, ArrowRight, Lightning, PlusCircle, Trophy} from 'phosphor-react';
import Button, {CommonType} from '../../../common/button/Button';
import type {QuestStep} from '../../../../util/trainer/recognition/quest';

const b = block('trainer-recognition');

interface EvalCtaButtonsProps {
	isQuestSession: boolean;
	questMastered: boolean;
	nextQuestStep: QuestStep | null;
	personalizedCount: number;
	showDescription: boolean;
	onStartNext: () => void;
	onRetry: () => void;
	onPersonalized: () => void;
	onRepeat: () => void;
	onNewSession: () => void;
	onJourneyComplete: () => void;
}

export default function EvalCtaButtons({
	isQuestSession,
	questMastered,
	nextQuestStep,
	personalizedCount,
	showDescription,
	onStartNext,
	onRetry,
	onPersonalized,
	onRepeat,
	onNewSession,
	onJourneyComplete,
}: EvalCtaButtonsProps) {
	const {t} = useTranslation();

	const primaryButton = () => {
		if (isQuestSession) {
			if (questMastered && nextQuestStep) {
				return (
					<Button
						primary
						large
						glow
						fullWidth
						icon={<ArrowRight weight="fill" />}
						text={t('trainer.recognition.results_cta_next_step', {label: nextQuestStep.label, defaultValue: `Next: ${nextQuestStep.label}`})}
						onClick={onStartNext}
					/>
				);
			}
			if (questMastered && !nextQuestStep) {
				return (
					<Button
						success
						large
						glow
						fullWidth
						icon={<Trophy weight="fill" />}
						text={t('trainer.recognition.results_cta_journey_complete', {defaultValue: 'Journey Complete!'})}
						onClick={onJourneyComplete}
					/>
				);
			}
			return (
				<Button
					primary
					large
					glow
					fullWidth
					icon={<ArrowCounterClockwise />}
					text={t('trainer.recognition.results_cta_try_again', {defaultValue: 'Try Again'})}
					onClick={onRetry}
				/>
			);
		}
		return (
			<>
				<Button
					primary
					large
					glow
					fullWidth
					icon={<Lightning weight="fill" />}
					text={t('trainer.recognition.results_cta_personalized', {count: personalizedCount, defaultValue: `Personalized Training (${personalizedCount})`})}
					onClick={onPersonalized}
				/>
				{showDescription && (
					<p className={b('eval-cta-desc')}>
						{t('trainer.recognition.results_cta_personalized_desc', {
							defaultValue:
								'Drills the cases you got wrong more often, with extra repetitions for your weakest patterns.',
						})}
					</p>
				)}
			</>
		);
	};

	return (
		<>
			{primaryButton()}
			<div className={b('eval-cta-row')}>
				{isQuestSession && (
					<Button
						theme={CommonType.TRANSPARENT}
						small
						icon={<Lightning />}
						className={b('eval-cta-secondary')}
						text={t('trainer.recognition.results_cta_personalized_short', {count: personalizedCount, defaultValue: `Personalized (${personalizedCount})`})}
						onClick={onPersonalized}
					/>
				)}
				<Button
					theme={CommonType.TRANSPARENT}
					small
					icon={<ArrowCounterClockwise />}
					className={b('eval-cta-secondary')}
					text={t('trainer.recognition.results_cta_repeat', {defaultValue: 'Repeat'})}
					onClick={onRepeat}
				/>
				<Button
					theme={CommonType.TRANSPARENT}
					small
					icon={<PlusCircle />}
					className={b('eval-cta-secondary')}
					text={
						isQuestSession
							? t('trainer.recognition.results_cta_free_practice', {defaultValue: 'Free Practice'})
							: t('trainer.recognition.results_cta_new_session', {defaultValue: 'New Session'})
					}
					onClick={onNewSession}
				/>
			</div>
		</>
	);
}
