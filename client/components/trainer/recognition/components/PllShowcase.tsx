/**
 * PllShowcase — 21 PLL case carousel, 3 satir, infinite horizontal scroll.
 * Tikla → CaseVariationsModal (state snapshot + callback prop drilling).
 */
import React, {useMemo, useState, useCallback} from 'react';
import {useDispatch as useReduxDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import PllPic from './PllPic';
import CaseVariationsModal from './CaseVariationsModal';
import pllMap from '../../../../../public/trainer/pll-recognition-algs.json';
import {keysToCases, caseToKey} from '../../../../util/trainer/recognition/pll_cases';
import {shuffle} from '../../../../util/trainer/recognition/helpers';
import {aufByDturn} from '../../../../util/trainer/recognition/pll_constants';
import {DefaultAllowedCrossColors} from '../../../../util/trainer/recognition/colors';
import {openModal} from '../../../../actions/general';
import {useRecognitionContext} from '../RecognitionContext';
import type {PllCase} from '../../../../util/trainer/recognition/scramble';

const b = block('trainer-recognition');

const pllNames = Object.keys(pllMap as Record<string, unknown>);

function generateRow(): PllCase[] {
	const keys = shuffle([...pllNames]).map((name) => `${name}/`);
	return keysToCases(keys, DefaultAllowedCrossColors);
}

interface ShowcaseCardProps {
	pllCase: PllCase;
	settings: any;
	onClick: () => void;
}

function ShowcaseCard({pllCase, settings, onClick}: ShowcaseCardProps) {
	const [hovered, setHovered] = useState(false);
	const auf = aufByDturn(pllCase.dTurn) || 'noAuf';
	return (
		<div
			className={b('showcase-card')}
			onClick={onClick}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			<div className={b('showcase-card-header')}>
				<span className={b('showcase-card-name')}>{pllCase.name}</span>
				<span className={b('showcase-card-auf')}>{auf}</span>
			</div>
			<div className={b('showcase-card-pics')}>
				<PllPic
					pllCase={pllCase}
					viewType="cube"
					hoverViewType="cube-pll"
					size={80}
					clickable={false}
					hovered={hovered}
					puzzleRotations={settings.puzzleRotations}
					strokeWidth={settings.strokeWidth}
					colorScheme={settings.colorScheme}
				/>
				<PllPic
					pllCase={pllCase}
					viewType="cube-top"
					size={60}
					clickable={false}
					puzzleRotations={settings.puzzleRotations}
					strokeWidth={settings.strokeWidth}
					colorScheme={settings.colorScheme}
				/>
			</div>
		</div>
	);
}

export default function PllShowcase() {
	const {t} = useTranslation();
	const {state, setNote} = useRecognitionContext();
	const reduxDispatch = useReduxDispatch();
	const [paused, setPaused] = useState(false);

	const rows = useMemo(() => [generateRow(), generateRow(), generateRow()], []);
	const durations = [60, 50, 55];

	const openVariations = useCallback(
		(pllCase: PllCase) => {
			const key = caseToKey(pllCase);
			const initialNote = state.notes.notes[key] || '';
			reduxDispatch(
				openModal(
					<CaseVariationsModal
						pllCase={pllCase}
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
						title: `${pllCase.name} perm`,
						width: 760,
						compact: true,
						closeButtonText: t('solve_info.done', {defaultValue: 'Done'}),
					}
				)
			);
		},
		[reduxDispatch, state.notes.notes, state.settings, setNote, t]
	);

	return (
		<div
			className={b('showcase')}
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
		>
			{rows.map((row, rowIndex) => {
				const doubled = [...row, ...row];
				const direction = rowIndex === 1 ? 'reverse' : 'normal';
				return (
					<div
						key={rowIndex}
						className={b('showcase-row')}
						style={{
							animationDuration: `${durations[rowIndex]}s`,
							animationDirection: direction,
							animationPlayState: paused ? 'paused' : 'running',
						}}
					>
						{doubled.map((pllCase, i) => (
							<ShowcaseCard
								key={`${rowIndex}-${i}`}
								pllCase={pllCase}
								settings={state.settings}
								onClick={() => openVariations(pllCase)}
							/>
						))}
					</div>
				);
			})}
		</div>
	);
}
