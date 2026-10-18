/**
 * Building blocks of the set picker (trainer-sets 5.1, 5.2, 5.6): the case card, the category
 * and subset tiles, and the desktop category list. Every picture goes through CasePattern, so
 * the 3D fallback keeps to the shared budget of 8 live players.
 */
import React, {useCallback, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Check, CheckSquare, CheckSquareOffset, Square, SlidersHorizontal} from 'phosphor-react';
import block from '../../../../styles/bem';
import CasePattern from '../../common/CasePattern';
import {useLongPress} from '../parts';
import {useTrainerContext} from '../../TrainerContext';
import {getDefaultFrontFace, isIsometricCategory, isLLCategory} from '../../../../util/trainer/algorithm_engine';
import {trainerAlgText} from '../../../../util/trainer/set_queue';
import type {CubeFace} from '../../types';
import type {PickerCase, PickerCategory} from './picker_model';

const b = block('set-picker');

export interface PatternFaces {
	topFace: CubeFace;
	frontFace: CubeFace;
}

/**
 * The faces the trainer settings show cases with (top and front colour). Every set screen draws
 * its pictures with them, so a case looks the same in the trainer, the picker and the set page.
 */
export function usePatternFaces(): PatternFaces {
	const {state} = useTrainerContext();
	const {topFace, frontFace} = state.options;
	return useMemo(() => ({topFace, frontFace}), [topFace, frontFace]);
}

/** Faces a category's picture uses: last layer and isometric cases pick their own front face. */
export function facesFor(category: string, faces: PatternFaces): PatternFaces {
	const own = isLLCategory(category) || isIsometricCategory(category);
	return {topFace: faces.topFace, frontFace: own ? getDefaultFrontFace(faces.topFace) : faces.frontFace};
}

// ── Case card ───────────────────────────────────────────────────────────

interface CaseCardProps {
	pc: PickerCase;
	/** The variant this set would get, as written. */
	algorithm: string;
	selected: boolean;
	inSet: boolean;
	faces: PatternFaces;
	/** Category badge (search results mix categories). */
	badge?: string | null;
	onToggle: (pc: PickerCase) => void;
	onVariant: (pc: PickerCase) => void;
}

export const CaseCard = React.memo(function CaseCard({pc, algorithm, selected, inSet, faces, badge, onToggle, onVariant}: CaseCardProps) {
	const {t} = useTranslation();
	const openVariant = useCallback(() => onVariant(pc), [onVariant, pc]);
	const longPress = useLongPress(inSet ? null : openVariant);
	const f = facesFor(pc.category, faces);

	return (
		<li className={b('case', {selected, 'in-set': inSet})}>
			<button
				type="button"
				className={b('case-main')}
				aria-pressed={inSet ? undefined : selected}
				disabled={inSet}
				onClick={() => {
					if (longPress.consumeClick()) return;
					onToggle(pc);
				}}
				{...longPress.handlers}
			>
				<span className={b('case-pattern')}>
					<CasePattern category={pc.category} algorithm={trainerAlgText(algorithm)} topFace={f.topFace} frontFace={f.frontFace} fit />
				</span>
				<span className={b('case-head')}>
					<span className={b('case-name')}>{pc.name}</span>
					{inSet ? null : (
						<span className={b('check', {on: selected})} aria-hidden="true">
							{selected ? <Check size={14} weight="bold" /> : null}
						</span>
					)}
				</span>
				{badge ? <span className={b('case-badge')}>{badge}</span> : null}
				<code className={b('case-alg')}>{algorithm}</code>
			</button>
			{inSet ? (
				// Same place and height as the Algorithm chip, so every card in the grid lines up.
				<span className={b('case-foot')}>
					<Check size={14} weight="bold" aria-hidden="true" />
					{t('trainer.sets.in_set')}
				</span>
			) : (
				<button
					type="button"
					className={b('case-chip')}
					onClick={openVariant}
					aria-label={`${pc.name}: ${t('trainer.sets.variant_title')}`}
				>
					<SlidersHorizontal size={14} weight="bold" aria-hidden="true" />
					{t('trainer.sets.picker.algorithm_chip')}
				</button>
			)}
		</li>
	);
});

// ── Tiles (step 1 and step 2) ───────────────────────────────────────────

function TileCounts({total, inSet, selected}: {total: number; inSet: number; selected: number}) {
	const {t} = useTranslation();
	return (
		<span className={b('tile-counts')}>
			<span>{t('trainer.sets.picker.case_count', {count: total})}</span>
			{inSet > 0 ? <span className={b('tile-in-set')}>{t('trainer.sets.picker.in_set_count', {count: inSet})}</span> : null}
			{selected > 0 ? <span className={b('tile-selected')}>+{selected}</span> : null}
		</span>
	);
}

interface CategoryTileProps {
	category: PickerCategory;
	inSet: number;
	selected: number;
	faces: PatternFaces;
	onOpen: (category: string) => void;
}

export function CategoryTile({category, inSet, selected, faces, onOpen}: CategoryTileProps) {
	const first = category.cases[0];
	const f = facesFor(category.category, faces);
	return (
		<li className={b('tile')}>
			<button type="button" className={b('tile-main')} onClick={() => onOpen(category.category)}>
				<span className={b('tile-pattern')}>
					{first ? (
						<CasePattern category={first.category} algorithm={trainerAlgText(first.libraryAlg)} topFace={f.topFace} frontFace={f.frontFace} fit />
					) : null}
				</span>
				<span className={b('tile-name')}>{category.shortName}</span>
				<TileCounts total={category.cases.length} inSet={inSet} selected={selected} />
			</button>
		</li>
	);
}

interface SubsetTileProps {
	label: string;
	cases: PickerCase[];
	inSet: number;
	selected: number;
	selectState: 'all' | 'some' | 'none' | 'done';
	faces: PatternFaces;
	onOpen: () => void;
	/** Null hides the "select all" box (the "All cases" tile). */
	onToggleAll: (() => void) | null;
	allCases?: boolean;
}

export function SubsetTile({label, cases, inSet, selected, selectState, faces, onOpen, onToggleAll, allCases}: SubsetTileProps) {
	const {t} = useTranslation();
	const first = cases[0];
	const f = first ? facesFor(first.category, faces) : faces;
	const SelectIcon = selectState === 'all' ? CheckSquare : selectState === 'some' ? CheckSquareOffset : Square;
	return (
		<li className={b('tile', {all: !!allCases})}>
			<button type="button" className={b('tile-main')} onClick={onOpen}>
				<span className={b('tile-pattern')}>
					{first ? (
						<CasePattern category={first.category} algorithm={trainerAlgText(first.libraryAlg)} topFace={f.topFace} frontFace={f.frontFace} fit />
					) : null}
				</span>
				<span className={b('tile-name')}>{label}</span>
				<TileCounts total={cases.length} inSet={inSet} selected={selected} />
			</button>
			{onToggleAll ? (
				<button
					type="button"
					className={b('tile-select', {on: selectState === 'all' || selectState === 'some'})}
					onClick={onToggleAll}
					disabled={selectState === 'done'}
					aria-pressed={selectState === 'all'}
				>
					<SelectIcon size={18} weight={selectState === 'none' || selectState === 'done' ? 'regular' : 'fill'} aria-hidden="true" />
					{selectState === 'done' ? t('trainer.sets.picker.all_in_set') : t('trainer.sets.picker.select_all')}
				</button>
			) : null}
		</li>
	);
}

// ── Desktop category list ───────────────────────────────────────────────

interface CategoryNavItemProps {
	category: PickerCategory;
	active: boolean;
	inSet: number;
	selected: number;
	onOpen: (category: string) => void;
}

export function CategoryNavItem({category, active, inSet, selected, onOpen}: CategoryNavItemProps) {
	const {t} = useTranslation();
	return (
		<li>
			<button
				type="button"
				className={b('nav-item', {active})}
				aria-current={active ? 'true' : undefined}
				onClick={() => onOpen(category.category)}
			>
				<span className={b('nav-name')}>{category.shortName}</span>
				<span className={b('nav-counts')}>
					{selected > 0 ? <span className={b('tile-selected')}>+{selected}</span> : null}
					{inSet > 0 ? (
						<span className={b('nav-in-set')} title={t('trainer.sets.picker.in_set_count', {count: inSet})}>
							{t('trainer.sets.picker.in_set_count', {count: inSet})}
						</span>
					) : null}
					<span className={b('nav-total')}>{category.cases.length}</span>
				</span>
			</button>
		</li>
	);
}
