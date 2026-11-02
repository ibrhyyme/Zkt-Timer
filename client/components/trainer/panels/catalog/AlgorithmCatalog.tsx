/**
 * AlgorithmCatalog: the Algorithm Trainer's first screen (/trainer/algorithms).
 *
 * Puzzle buttons over the puzzle's categories, one tile each: a case picture, learned / total and
 * the long name. The very large categories (1LLL, ZBLL, OLLCP, VLS) sit in a section of their
 * own. A tile opens the category's page (/trainer/algorithms/<slug>, AlgorithmSelector), where
 * its groups and cases are picked. The tab is not in the address: it follows the category the
 * user came back from, else the one last opened on this device.
 */
import React, {useCallback, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';
import {useAlgorithmData, getLearnedStatus} from '../../hooks/useAlgorithmData';
import {algToId} from '../../../../util/trainer/algorithm_engine';
import {useLLPatternsReady} from '../../../../util/trainer/ll_patterns';
import {usePuzzlePatternsReady} from '../../../../util/trainer/puzzle_patterns';
import {useIsometricPatternsReady} from '../../../../util/trainer/isometric_patterns';
import {buildAlgorithmsPath} from '../../../../util/trainer/url/trainer_url';
import {categoryToSlug} from '../../../../util/trainer/url/category_slug';
import {
	catalogPuzzles,
	catalogSections,
	categoryDisplayName,
	categoryInfoKey,
	categoryLongName,
	readCatalogPuzzle,
	writeCatalogPuzzle,
} from '../../../../util/trainer/catalog';
import {CUBE_TYPE_PUZZLE, cubeTypeOfCategory} from '../../../../../shared/trainer/alg_sets';
import type {TrainerCubeType} from '../../../../../shared/trainer/alg_sets';
import CasePattern from '../../common/CasePattern';
import LoadingIcon from '../../../common/LoadingIcon';
import './AlgorithmCatalog.scss';

const b = block('trainer-catalog');

interface Tile {
	category: string;
	/** Main algorithm of the first case: the tile's picture. */
	cover: string | null;
	total: number;
	learned: number;
}

export default function AlgorithmCatalog() {
	const {t} = useTranslation();
	const {state, dispatch} = useTrainerContext();
	const {categories, getSubsets, getAlgorithmsWithSubset} = useAlgorithmData();
	useLLPatternsReady(); // Re-render tiles when patterns are loaded
	usePuzzlePatternsReady();
	useIsometricPatternsReady();

	const puzzles = useMemo(() => catalogPuzzles(categories, state.mode), [categories, state.mode]);
	const [picked, setPicked] = useState<string | null>(() =>
		state.selectedCategory ? cubeTypeOfCategory(state.selectedCategory) : readCatalogPuzzle()
	);
	// A remembered tab Smart Cube mode cannot show (2x2...) falls back to the first one.
	const puzzle = puzzles.find((p) => p === picked) ?? puzzles[0] ?? null;

	const pickPuzzle = useCallback((next: TrainerCubeType) => {
		setPicked(next);
		writeCatalogPuzzle(next);
	}, []);

	// Learned counts follow the trainer's stats (getAlgorithmsWithSubset changes with them).
	const sections = useMemo(() => {
		if (!puzzle) return null;
		const toTile = (category: string): Tile => {
			let cover: string | null = null;
			let total = 0;
			let learned = 0;
			for (const group of getAlgorithmsWithSubset(category, getSubsets(category))) {
				for (const alg of group.algorithms) {
					if (cover === null) cover = alg.algorithm;
					total++;
					if (getLearnedStatus(algToId(alg.algorithm)) === 2) learned++;
				}
			}
			return {category, cover, total, learned};
		};
		const {regular, large} = catalogSections(categories, puzzle);
		return {regular: regular.map(toTile), large: large.map(toTile)};
	}, [puzzle, categories, getSubsets, getAlgorithmsWithSubset]);

	const studyMode = state.mode === 'smart' ? 'smart' : null;

	const openCategory = (e: React.MouseEvent, category: string) => {
		// A modified click opens the category's address in a new tab, as a link should.
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		e.preventDefault();
		// Coming back to the same category keeps what was checked there.
		if (state.selectedCategory !== category) dispatch({type: 'SET_CATEGORY', payload: category});
		dispatch({type: 'SET_VIEW', payload: 'selection'});
	};

	// The library's first load on this device (later visits have it at once).
	if (!puzzle || !sections) {
		return (
			<div className={b('loading')}>
				<LoadingIcon />
			</div>
		);
	}

	const renderTile = (tile: Tile) => {
		const name = categoryDisplayName(tile.category);
		const longName = categoryLongName(tile.category, t(`trainer.cat_info.${categoryInfoKey(tile.category)}.title`, {defaultValue: ''}));
		const progress = t('trainer.catalog.progress', {learned: tile.learned, total: tile.total});
		return (
			<a
				key={tile.category}
				className={b('tile')}
				href={buildAlgorithmsPath(null, {cat: categoryToSlug(tile.category), mode: studyMode})}
				onClick={(e) => openCategory(e, tile.category)}
				aria-label={longName ? `${name}, ${longName}, ${progress}` : `${name}, ${progress}`}
			>
				<span className={b('figure')}>
					{tile.cover ? (
						<CasePattern
							category={tile.category}
							algorithm={tile.cover}
							topFace={state.options.topFace}
							frontFace={state.options.frontFace}
							fit
						/>
					) : null}
					<span className={b('count', {done: tile.total > 0 && tile.learned === tile.total})} title={progress}>
						{tile.learned}/{tile.total}
					</span>
				</span>
				<span className={b('name')}>{name}</span>
				{longName ? <span className={b('long-name')}>{longName}</span> : null}
			</a>
		);
	};

	return (
		<div className={b()}>
			{puzzles.length > 1 ? (
				<div role="tablist" aria-label={t('trainer.puzzle_type')} className={b('puzzles')}>
					{puzzles.map((p) => (
						<button
							key={p}
							type="button"
							role="tab"
							aria-selected={p === puzzle}
							className={b('puzzle', {selected: p === puzzle})}
							onClick={() => p !== puzzle && pickPuzzle(p)}
						>
							<span className={`cubing-icon event-${CUBE_TYPE_PUZZLE[p]} ${b('puzzle-icon')}`} aria-hidden="true" />
							{p}
						</button>
					))}
				</div>
			) : null}

			{/* Smart Cube mode hides the other puzzles' tabs: say where they went. */}
			{state.mode === 'smart' ? <p className={b('note')}>{t('trainer.catalog.smart_only')}</p> : null}

			{sections.regular.length > 0 ? <div className={b('grid')}>{sections.regular.map(renderTile)}</div> : null}

			{sections.large.length > 0 ? (
				<section className={b('section')}>
					<h2 className={b('section-title')}>{t('trainer.catalog.large')}</h2>
					<div className={b('grid')}>{sections.large.map(renderTile)}</div>
				</section>
			) : null}
		</div>
	);
}
