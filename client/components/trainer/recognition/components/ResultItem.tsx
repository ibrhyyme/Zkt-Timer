/**
 * ResultItem — tek sonuc satiri/karti. Compact veya cardLayout modu.
 * Provider icinden render edilir (TrainerView ve EvalResultsView).
 */
import React, {useCallback, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import PllPic from './PllPic';
import Note from './Note';
import {msToHumanReadable} from '../../../../util/trainer/recognition/time_formatter';
import {resultTimeMs, type ResultRecord} from '../../../../util/trainer/recognition/evaluation';
import {caseToKey} from '../../../../util/trainer/recognition/pll_cases';
import {useRecognitionContext} from '../RecognitionContext';

const b = block('trainer-recognition');

interface ResultItemProps {
	result: ResultRecord;
	pictureSize: number;
	showNotes?: boolean;
	showTopPicture?: boolean;
	cardLayout?: boolean;
	onPicClick?: () => void;
}

export default function ResultItem({
	result,
	pictureSize,
	showNotes = false,
	showTopPicture = false,
	cardLayout = false,
	onPicClick,
}: ResultItemProps) {
	const {t} = useTranslation();
	const {state, setNote} = useRecognitionContext();
	const [hovered, setHovered] = useState(false);

	const timeText = useMemo(() => {
		const ms = resultTimeMs(result);
		return ms >= 60000 ? '60+' : msToHumanReadable(ms);
	}, [result]);

	const resultIsPoor = resultTimeMs(result) > 3000;

	const noteKey = result.pllCase ? caseToKey(result.pllCase) : '';
	const noteValue = noteKey ? state.notes.notes[noteKey] || '' : '';
	const handleNoteChange = useCallback(
		(v: string) => {
			if (noteKey) setNote(noteKey, v);
		},
		[noteKey, setNote]
	);

	if (!result.pllCase) return null;

	const renderBadge = () => {
		const isWrong = !!result.mistake;
		const modifier = isWrong ? (result.mistake === '-' ? 'giveup' : 'wrong') : resultIsPoor ? 'slow' : 'fast';
		return (
			<span className={b('result-item-badge', {[modifier]: true})} title={timeText}>
				{isWrong
					? result.mistake === '-'
						? t('trainer.recognition.eval_gave_up', {defaultValue: 'gave up'})
						: t('trainer.recognition.eval_wrong', {value: result.mistake, defaultValue: `not ${result.mistake}`})
					: timeText}
			</span>
		);
	};

	if (cardLayout) {
		return (
			<div
				className={b('eval-card')}
				onMouseEnter={() => setHovered(true)}
				onMouseLeave={() => setHovered(false)}
			>
				<div className={b('eval-card-header')}>
					<h5 className={b('eval-card-title')}>{result.pllCase.name}</h5>
					{renderBadge()}
				</div>
				<div className={b('eval-card-pics')}>
					<PllPic
						pllCase={result.pllCase}
						viewType="cube-top"
						size={pictureSize}
						clickable={!!onPicClick}
						onClick={onPicClick}
						puzzleRotations={state.settings.puzzleRotations}
						strokeWidth={state.settings.strokeWidth}
						colorScheme={state.settings.colorScheme}
					/>
					<PllPic
						pllCase={result.pllCase}
						viewType="cube"
						hoverViewType="cube-pll"
						size={pictureSize}
						clickable={!!onPicClick}
						hovered={hovered}
						onClick={onPicClick}
						puzzleRotations={state.settings.puzzleRotations}
						strokeWidth={state.settings.strokeWidth}
						colorScheme={state.settings.colorScheme}
					/>
				</div>
				<Note value={noteValue} onChange={handleNoteChange} enableHotkeys={false} />
			</div>
		);
	}

	const isCorrect = result.mistake === '';
	const isGiveUp = result.mistake === '-';
	const modifier = isCorrect ? 'correct' : isGiveUp ? 'giveup' : 'wrong';

	return (
		<div
			className={b('result-item', {[modifier]: true})}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			{showTopPicture && (
				<PllPic
					pllCase={result.pllCase}
					viewType="cube-top"
					size={Math.round(pictureSize * 0.8)}
					clickable={!!onPicClick}
					onClick={onPicClick}
					puzzleRotations={state.settings.puzzleRotations}
					strokeWidth={state.settings.strokeWidth}
					colorScheme={state.settings.colorScheme}
				/>
			)}
			<PllPic
				pllCase={result.pllCase}
				viewType="cube"
				hoverViewType="cube-pll"
				size={pictureSize}
				clickable={!!onPicClick}
				hovered={hovered}
				onClick={onPicClick}
				puzzleRotations={state.settings.puzzleRotations}
				strokeWidth={state.settings.strokeWidth}
				colorScheme={state.settings.colorScheme}
			/>
			<div className={b('result-item-label')}>{result.pllCase.name}</div>
			{renderBadge()}
			{showNotes && (
				<div className={b('result-item-note')}>
					<Note value={noteValue} onChange={handleNoteChange} enableHotkeys={false} />
				</div>
			)}
		</div>
	);
}
