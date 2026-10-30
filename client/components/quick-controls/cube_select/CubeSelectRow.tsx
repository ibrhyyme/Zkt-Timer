import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { CaretDown, CaretRight, CaretUp, Cube, MagnifyingGlass, Plus } from 'phosphor-react';
import Button from '../../common/button/Button';
import block from '../../../styles/bem';
import { formatInteger } from '../../../util/locale_format';
import { useMe } from '../../../util/hooks/useMe';
import { useSettings } from '../../../util/hooks/useSettings';
import { useSmartCubeStore } from '../../../util/hooks/useSmartCubeStore';
import { useCubes } from '../../../lib/cubes/store';
import { chooseMainCube } from '../../../lib/cubes/sync';
import { LocalCube } from '../../../lib/cubes/active_cube';
import { filterCubes } from '../../settings/cubes/cube_labels';
import { useCubeActions } from '../../settings/cubes/cube_actions';
import { CUBE_SELECT_SEARCH_THRESHOLD, CubeSelectInput, cubeSelectView, CubeSelectView } from './cube_select_state';
import './CubeSelect.scss';

const b = block('cube-select');

/**
 * Everything the row and the timer label need to know, read from the live stores. `magnetOwnsInput`
 * comes from the caller, which already runs useMagnetTimerOwnsInput for its own rows.
 */
export function useCubeSelectView(magnetOwnsInput: boolean): CubeSelectView {
	const me = useMe();
	const timerType = useSettings('timer_type');
	const cubeType = useSettings('cube_type');
	const scrambleSubset = useSettings('scramble_subset');
	const smartBleDeviceId = useSmartCubeStore('smartBleDeviceId');
	const state = useCubes();

	const input: CubeSelectInput = {
		signedIn: !!me?.id,
		timerType,
		magnetOwnsInput,
		cubeType,
		scrambleSubset,
		state,
		smartBleDeviceId,
	};
	return cubeSelectView(input);
}

/** Leaves the timer for My Cubes. The quick settings panel and the drawer close on this event. */
function useOpenMyCubes(): () => void {
	const history = useHistory();
	return () => {
		window.dispatchEvent(new Event('timerInteractionStart'));
		history.push('/settings/cubes');
	};
}

interface ListProps {
	view: Extract<CubeSelectView, { kind: 'select' }>;
	/** Called after a choice (or before leaving for My Cubes), so the container can close. */
	onDone?: () => void;
	/** Pads the list itself: set where no modal frame pads it (the quick settings row). */
	inset?: boolean;
}

/**
 * The cubes of the timer's puzzle, main first (5.4). A choice makes that cube the puzzle's main
 * at once, on every device (S-4, applied locally first and sent when the network allows).
 * Shared by the quick settings row and the label under the digits. Each cube is a row in My
 * Cubes' terms (name, Smart badge, brand · solve count) with a radio; My Cubes is a separate
 * button under the choices.
 */
export function CubeSelectList({ view, onDone, inset }: ListProps) {
	const { t, i18n } = useTranslation();
	const openMyCubes = useOpenMyCubes();
	const [query, setQuery] = useState('');

	const searchable = view.cubes.length > CUBE_SELECT_SEARCH_THRESHOLD;
	const shown = searchable ? filterCubes(view.cubes, query) : view.cubes;

	function choose(cubeId: string | null) {
		if (cubeId !== view.mainId) chooseMainCube(view.puzzle, cubeId);
		if (onDone) onDone();
	}

	function meta(cube: LocalCube): string {
		const count = cube.solve_count || 0;
		const solves = t('cubes.solve_count', { count, n: formatInteger(count, i18n.language) });
		return [cube.brand, solves].filter(Boolean).join(' · ');
	}

	const noneSelected = view.mainId === null;

	return (
		<div className={b({ inset: !!inset })}>
			{searchable && (
				<label className={b('search')}>
					<MagnifyingGlass weight="bold" />
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={t('cube_select.search')}
						aria-label={t('cube_select.search')}
					/>
				</label>
			)}

			<div className={b('list')}>
				{shown.map((cube: LocalCube) => {
					const selected = cube.id === view.mainId;
					return (
						<button
							key={cube.id}
							type="button"
							className={b('option', { selected })}
							aria-pressed={selected}
							onClick={() => choose(cube.id)}
						>
							<span className={b('text')}>
								<span className={b('name')}>
									<span>{cube.name}</span>
									{cube.is_smart && <span className={b('badge')}>{t('cubes.badge_smart')}</span>}
								</span>
								<span className={b('meta')}>{meta(cube)}</span>
							</span>
							<span className={b('radio', { on: selected })} aria-hidden="true" />
						</button>
					);
				})}

				{searchable && !shown.length && <div className={b('empty')}>{t('cube_select.no_match')}</div>}

				{view.allowNone && (
					<button
						type="button"
						className={b('option', { selected: noneSelected, none: true })}
						aria-pressed={noneSelected}
						onClick={() => choose(null)}
					>
						<span className={b('text')}>
							<span className={b('name')}>
								<span>{t('cube_select.none')}</span>
							</span>
						</span>
						<span className={b('radio', { on: noneSelected })} aria-hidden="true" />
					</button>
				)}
			</div>

			<button
				type="button"
				className={b('open')}
				onClick={() => {
					if (onDone) onDone();
					openMyCubes();
				}}
			>
				<Cube weight="bold" aria-hidden="true" />
				<span>{t('cube_select.open_cubes')}</span>
				<CaretRight weight="bold" aria-hidden="true" />
			</button>
		</div>
	);
}

interface RowProps {
	magnetOwnsInput: boolean;
}

/**
 * Quick settings, first row (5.4): "Çözüm yapılan küp". Opens in place under the row rather than
 * as a floating menu: the row lives both in the desktop popover and in the phone drawer, and an
 * absolute list would be clipped by either scroll container.
 */
export default function CubeSelectRow({ magnetOwnsInput }: RowProps) {
	const { t } = useTranslation();
	const view = useCubeSelectView(magnetOwnsInput);
	const { openAdd } = useCubeActions();
	const [open, setOpen] = useState(false);

	if (view.kind === 'hidden') return null;

	const rowClass = 'rounded-xl bg-text/[0.035] border border-text/[0.09] transition-all duration-200';
	const labelClass = 'min-w-0 truncate font-medium text-text';

	if (view.kind === 'smart') {
		// The stamp of a smart solve is the connected cube (4.3): nothing to choose here.
		return (
			<div className={`${rowClass} flex items-center justify-between gap-3 py-4 px-4`}>
				<span className={labelClass}>{t('cube_select.label')}</span>
				<span className="shrink-0 min-w-0 flex flex-col items-end text-sm">
					<span className="truncate font-semibold text-text max-w-[160px]">{view.cube.name}</span>
					<span className="text-xs text-text">{t('cube_select.connected')}</span>
				</span>
			</div>
		);
	}

	if (view.kind === 'empty') {
		return (
			<div className={`${rowClass} flex items-center justify-between gap-3 py-4 px-4`}>
				<span className={labelClass}>{t('cube_select.empty')}</span>
				<Button
					primary
					small
					noMargin
					text={t('cube_select.add')}
					icon={<Plus weight="bold" />}
					iconFirst
					onClick={() => openAdd({ puzzle: view.puzzle })}
				/>
			</div>
		);
	}

	const main = view.cubes.find((cube) => cube.id === view.mainId) || null;

	return (
		<div className={`${rowClass} ${open ? 'border-primary/50' : 'hover:border-text/[0.15]'}`}>
			<div className="flex items-center justify-between gap-3 py-4 px-4">
				<span className={labelClass}>{t('cube_select.label')}</span>
				<button
					type="button"
					aria-expanded={open}
					onClick={() => setOpen(!open)}
					className={`shrink-0 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm min-w-[96px] max-w-[180px] justify-between border bg-button text-text ${open ? 'border-primary/50' : 'border-text/[0.1] hover:border-text/[0.15]'
						}`}
				>
					<span className="truncate">{main ? main.name : t('cube_select.not_chosen')}</span>
					{open ? <CaretUp weight="bold" className="shrink-0 text-primary" /> : <CaretDown weight="bold" className="shrink-0" />}
				</button>
			</div>
			{open && (
				<div className="border-t border-text/[0.09]">
					<CubeSelectList view={view} onDone={() => setOpen(false)} inset />
				</div>
			)}
		</div>
	);
}
