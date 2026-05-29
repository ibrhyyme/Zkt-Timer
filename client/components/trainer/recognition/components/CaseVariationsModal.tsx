/**
 * CaseVariationsModal — bir PLL case'in tum 16 varyasyonunu (4 dTurn × 4 colorShift) gosterir.
 * openModal() ile App root'unda mount edildiginden Provider'a erisimi YOK —
 * tum gerekli state snapshot + callback'ler props olarak gelir.
 */
import React, {useMemo, useState} from 'react';
import block from '../../../../styles/bem';
import PllPic from './PllPic';
import Note from './Note';
import GuideGroupCard from './GuideGroupCard';
import {colorNameByLetter, CubeColors} from '../../../../util/trainer/recognition/colors';
import {D_TURN_OPTIONS, COLOR_SHIFTS} from '../../../../util/trainer/recognition/pll_cases';
import {lookupGuideHint, getGuideGroup} from '../../../../util/trainer/recognition/guide_lookup';
import type {PllCase} from '../../../../util/trainer/recognition/scramble';
import type {ColorScheme, Rotation} from '../../../../util/trainer/recognition/cube_display';

const b = block('trainer-recognition');

export interface CaseVariationsModalProps {
	pllCase: PllCase;
	puzzleRotations: Rotation[];
	strokeWidth: number;
	colorScheme: ColorScheme;
	initialNote: string;
	onNoteChange: (next: string) => void;
	labels?: {
		crossColor?: string;
		noteAdd?: string;
		noteEdit?: string;
		noteSaveHint?: string;
	};
}

export default function CaseVariationsModal({
	pllCase,
	puzzleRotations,
	strokeWidth,
	colorScheme,
	initialNote,
	onNoteChange,
	labels,
}: CaseVariationsModalProps) {
	const initialColor = colorNameByLetter(pllCase.crossColor) || 'white';
	const [crossColor, setCrossColor] = useState<string>(initialColor);
	const [note, setNote] = useState<string>(initialNote);

	const variations = useMemo<PllCase[]>(() => {
		const result: PllCase[] = [];
		const shifts = [...COLOR_SHIFTS];
		for (const dTurn of D_TURN_OPTIONS) {
			for (const colorShift of shifts) {
				result.push({
					rotation: pllCase.rotation,
					name: pllCase.name,
					dTurn,
					colorShift,
					crossColor: pllCase.crossColor,
				});
			}
			shifts.push(shifts.shift() as number);
		}
		return result;
	}, [pllCase]);

	const hint = lookupGuideHint(pllCase);
	const guideGroup = hint ? getGuideGroup(hint.groupId) : null;

	const handleNoteChange = (v: string) => {
		setNote(v);
		onNoteChange(v);
	};

	return (
		<div className={b('variations')}>
			<div className={b('variations-header')}>
				<div className={b('variations-top-pic')}>
					<PllPic
						pllCase={pllCase}
						viewType="cube-top"
						size={130}
						clickable={false}
						crossColor={crossColor}
						puzzleRotations={puzzleRotations}
						strokeWidth={strokeWidth}
						colorScheme={colorScheme}
					/>
				</div>
				<div className={b('variations-meta')}>
					<div className={b('variations-cross-row')}>
						<label className={b('variations-cross-label')}>{labels?.crossColor || 'Cross color'}</label>
						<select
							value={crossColor}
							onChange={(e) => setCrossColor(e.target.value)}
							className={b('select')}
						>
							{CubeColors.map((c) => (
								<option key={c} value={c}>
									{c}
								</option>
							))}
						</select>
					</div>
					<Note
						value={note}
						onChange={handleNoteChange}
						enableHotkeys={true}
						addLabel={labels?.noteAdd}
						editLabel={labels?.noteEdit}
						saveHint={labels?.noteSaveHint}
					/>
				</div>
				{guideGroup && hint && (
					<div className={b('variations-guide')}>
						<GuideGroupCard group={guideGroup} highlightRowIndex={hint.rowIndex} defaultPatternColumns={6} />
					</div>
				)}
			</div>
			<div className={b('variations-grid')}>
				{variations.map((v, i) => (
					<div key={i} className={b('variations-cell')}>
						<PllPic
							pllCase={v}
							viewType="cube"
							hoverViewType="cube-pll"
							size={150}
							clickable={false}
							crossColor={crossColor}
							puzzleRotations={puzzleRotations}
							strokeWidth={strokeWidth}
							colorScheme={colorScheme}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
