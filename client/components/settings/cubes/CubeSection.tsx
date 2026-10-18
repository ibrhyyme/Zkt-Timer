import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlass } from 'phosphor-react';
import block from '../../../styles/bem';
import { CubeSort, cubesForPuzzle, CubeState, mainCubeFor } from '../../../lib/cubes/active_cube';
import { formatInteger } from '../../../util/locale_format';
import { filterCubes, SECTION_SEARCH_THRESHOLD } from './cube_labels';
import { CubeActions } from './cube_actions';
import { CubeMenuOpenArgs } from './CubeMenu';
import CubeRow from './CubeRow';

const b = block('my-cubes');

const SORTS: CubeSort[] = ['default', 'last_used', 'solve_count', 'name'];

interface Props {
	puzzle: string;
	label: string;
	state: Pick<CubeState, 'cubes' | 'mains'>;
	actions: CubeActions;
	openMenu: (args: CubeMenuOpenArgs) => void;
}

/**
 * The cubes of one puzzle (5.1). Default order: main first, then last used, then name. Above
 * SECTION_SEARCH_THRESHOLD cubes a search box and a sort picker appear in the header.
 */
export default function CubeSection({ puzzle, label, state, actions, openMenu }: Props) {
	const { t, i18n } = useTranslation();
	const [sort, setSort] = useState<CubeSort>('default');
	const [query, setQuery] = useState('');

	const all = useMemo(() => cubesForPuzzle(puzzle, state, sort), [puzzle, state, sort]);
	const mainId = mainCubeFor(puzzle, state)?.id ?? null;
	const showTools = all.length > SECTION_SEARCH_THRESHOLD;
	const visible = showTools ? filterCubes(all, query) : all;

	const sectionId = `zt-my-cubes-${puzzle}`;

	return (
		<section className={b('section')} aria-labelledby={sectionId}>
			<header className={b('section-head')}>
				<h3 id={sectionId} className={b('section-title')}>
					<span>{label}</span>
					<span className={b('section-count')}>
						{t('cubes.section_count', { count: all.length, n: formatInteger(all.length, i18n.language) })}
					</span>
				</h3>
				{showTools ? (
					<div className={b('tools')}>
						<label className={b('search')}>
							<MagnifyingGlass size={15} className={b('search-icon')} />
							<input
								type="search"
								className={b('search-input')}
								value={query}
								placeholder={t('cubes.search_placeholder')}
								aria-label={t('cubes.search_placeholder')}
								onChange={(e) => setQuery(e.target.value)}
							/>
						</label>
						<label className={b('sort')}>
							<span className={b('sort-label')}>{t('cubes.sort_label')}</span>
							<select
								className={b('sort-select')}
								value={sort}
								onChange={(e) => setSort(e.target.value as CubeSort)}
							>
								{SORTS.map((option) => (
									<option key={option} value={option}>
										{t(`cubes.sort_${option}`)}
									</option>
								))}
							</select>
						</label>
					</div>
				) : null}
			</header>

			<div className={b('table')} role="list">
				<div className={b('table-head')} aria-hidden="true">
					<span>{t('cubes.col_name')}</span>
					<span>{t('cubes.col_brand')}</span>
					<span>{t('cubes.col_solves')}</span>
					<span>{t('cubes.col_last')}</span>
					<span />
				</div>
				{visible.map((cube) => (
					<div key={cube.id} role="listitem">
						<CubeRow
							cube={cube}
							isMain={cube.id === mainId}
							menuItems={actions.menuItems(cube, cube.id === mainId)}
							openMenu={openMenu}
						/>
					</div>
				))}
				{!visible.length ? <p className={b('no-match')}>{t('cubes.no_match')}</p> : null}
			</div>
		</section>
	);
}
