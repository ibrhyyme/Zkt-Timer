import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation } from 'react-router-dom';
import { CaretRight, Plus } from 'phosphor-react';
import './MyCubes.scss';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import { useCubes } from '../../../lib/cubes/store';
import { refreshCubes } from '../../../lib/cubes/sync';
import { LocalCube, puzzlesWithCubes } from '../../../lib/cubes/active_cube';
import { getCustomCubeTypes } from '../../../util/cubes/util';
import { orderPuzzles, parseAddLink, puzzleLabel } from './cube_labels';
import { useCubeActions } from './cube_actions';
import { useCubeMenu } from './CubeMenu';
import CubeSection from './CubeSection';
import CubeRow from './CubeRow';

const b = block('my-cubes');

/**
 * My Cubes (design .feedback/designs/magnet-cubes.md 5.1), Settings > Küplerim. Open to every
 * signed-in member (owner decision Q1); the route requires an account.
 *
 * Sections per puzzle in PUZZLE_KEYS order plus custom types, only puzzles with cubes. Archived
 * cubes sit in a closed "Arşiv (N)" row at the bottom. The list comes from the local cube store
 * at once (works offline) and is refreshed from the server when the page opens.
 *
 * `?add=1&puzzle=<key>&from=magnet` (cubeAddLink) opens the add form; with from=magnet a saved
 * cube sends the person back to the timer.
 */
export default function MyCubes() {
	const { t } = useTranslation();
	const history = useHistory();
	const location = useLocation();
	const state = useCubes();
	const actions = useCubeActions();
	const menu = useCubeMenu();

	const [loading, setLoading] = useState(true);
	const [archiveOpen, setArchiveOpen] = useState(false);

	const customTypes = useMemo(() => getCustomCubeTypes(), []);

	useEffect(() => {
		let alive = true;
		refreshCubes({ force: true }).finally(() => {
			if (alive) setLoading(false);
		});
		return () => {
			alive = false;
		};
	}, []);

	// Timer link: open the form once, then drop the parameters so Back or a reload does not reopen it.
	useEffect(() => {
		const params = parseAddLink(location.search);
		if (!params.open) return;
		history.replace(location.pathname);
		actions.openAdd({
			puzzle: params.puzzle,
			onSaved: params.from === 'magnet' ? () => history.push('/timer') : undefined,
		});
	}, [location.search, location.pathname, history, actions]);

	const puzzles = useMemo(() => orderPuzzles(puzzlesWithCubes(state), customTypes), [state, customTypes]);
	// Archived cubes of every puzzle in one list: by puzzle (page order), then by name.
	const archived = useMemo(() => {
		const list = state.cubes.filter((cube) => !!cube.archived_at);
		const order = orderPuzzles(
			list.map((cube) => cube.puzzle),
			customTypes
		);
		return list.sort(
			(a, c) =>
				order.indexOf(a.puzzle) - order.indexOf(c.puzzle) ||
				a.name.localeCompare(c.name, undefined, { sensitivity: 'base', numeric: true })
		);
	}, [state, customTypes]);

	const empty = puzzles.length === 0 && archived.length === 0;
	// Nothing stored on this device yet and the first read still running: say so instead of
	// showing the empty state to someone whose cubes are on their way.
	const waiting = empty && loading && !state.fetchedAt;

	function openAdd() {
		actions.openAdd();
	}

	let body: React.ReactNode;
	if (waiting) {
		body = <p className={b('loading')}>{t('cubes.loading')}</p>;
	} else if (empty) {
		body = (
			<div className={b('empty')}>
				<p className={b('empty-text')}>{t('cubes.empty_text')}</p>
				<Button primary large text={t('cubes.add')} icon={<Plus weight="bold" />} iconFirst onClick={openAdd} />
			</div>
		);
	} else {
		body = (
			<>
				{puzzles.map((puzzle) => (
					<CubeSection
						key={puzzle}
						puzzle={puzzle}
						label={puzzleLabel(puzzle, customTypes)}
						state={state}
						actions={actions}
						openMenu={menu.open}
					/>
				))}

				{archived.length ? (
					<section className={b('archive')}>
						<button
							type="button"
							className={b('archive-toggle', { open: archiveOpen })}
							aria-expanded={archiveOpen}
							onClick={() => setArchiveOpen((open) => !open)}
						>
							<span>{t('cubes.archive_title', { n: archived.length })}</span>
							<CaretRight weight="bold" className={b('archive-caret')} />
						</button>
						{archiveOpen ? (
							<div className={b('table', { archive: true })} role="list">
								{archived.map((cube: LocalCube) => (
									<div key={cube.id} role="listitem">
										<CubeRow
											cube={cube}
											isMain={false}
											puzzleName={puzzleLabel(cube.puzzle, customTypes)}
											menuItems={actions.menuItems(cube, false)}
											openMenu={menu.open}
										/>
									</div>
								))}
							</div>
						) : null}
					</section>
				) : null}
			</>
		);
	}

	return (
		<div className={b()}>
			<div className={b('toolbar')}>
				<h2 className={b('title')}>{t('cubes.title')}</h2>
				{!empty ? (
					<Button primary text={t('cubes.add')} icon={<Plus weight="bold" />} iconFirst onClick={openAdd} />
				) : null}
			</div>
			{body}
			{menu.element}
		</div>
	);
}
