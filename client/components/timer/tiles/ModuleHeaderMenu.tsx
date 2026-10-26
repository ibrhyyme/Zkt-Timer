import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { GearSix } from 'phosphor-react';
import block from '../../../styles/bem';
import TileMenu, { TileMenuOption } from './TileMenu';
import { TimerModuleType } from '../@types/enums';
import { TimerContext } from '../Timer';
import { openModal } from '../../../actions/general';
import CustomizeStats from '../../modules/quick_stats/customize_stats/CustomizeStats';
import CustomizeSolves from '../../modules/history/customize_solves/CustomizeSolves';
import { FilterSolvesOptions } from '../../../db/solves/query';

const b = block('timer-tile');
const tileMenu = block('tile-menu');

interface MenuContext {
	t: (key: string) => string;
	dispatch: ReturnType<typeof useDispatch>;
	filterOptions: FilterSolvesOptions;
}

/**
 * The settings a module offers from its own header, behind a gear next to its title.
 *
 * A module that wants a menu adds one entry here and nothing else: the tile header draws
 * the gear only for the types listed. This replaced a "Customize stats" button that the
 * stats module laid over its own top right corner on hover, where it covered the block
 * underneath and made it unclickable.
 */
const HEADER_MENUS: Partial<Record<TimerModuleType, (ctx: MenuContext) => TileMenuOption[]>> = {
	[TimerModuleType.STATS]: ({ t, dispatch, filterOptions }) => [
		{
			key: 'customize_stats',
			label: t('timer_modules.customize_stats'),
			onSelect: () =>
				dispatch(
					openModal(<CustomizeStats filterOptions={filterOptions} />, {
						title: t('timer_modules.customize_stats'),
						description: t('timer_modules.customize_stats_desc'),
						// Room for the block list beside the editor, so the type chips fit one row
						width: 880,
					})
				),
		},
	],
	[TimerModuleType.HISTORY]: ({ t, dispatch }) => [
		{
			key: 'customize_solves',
			label: t('timer_modules.customize_solves'),
			onSelect: () =>
				dispatch(
					openModal(<CustomizeSolves />, {
						title: t('timer_modules.customize_solves'),
						description: t('timer_modules.customize_solves_desc'),
					})
				),
		},
	],
};

export function hasModuleHeaderMenu(moduleType: TimerModuleType): boolean {
	return !!HEADER_MENUS[moduleType];
}

interface Props {
	moduleType: TimerModuleType;
	/**
	 * The solves the module shows. Defaults to the timer's filter; a page outside the timer
	 * (the Sessions page, K-12) passes its own, since it has no TimerContext.
	 */
	filterOptions?: FilterSolvesOptions;
	/** Replaces the timer tile's class for a header drawn elsewhere */
	className?: string;
	/** Which edge of the gear the list lines up with; a gear at a right edge opens leftwards */
	align?: 'left' | 'right';
}

/**
 * The gear in a module header. Renders nothing for a module without settings, opens the
 * setting directly when there is only one, and a menu otherwise.
 */
export default function ModuleHeaderMenu({ moduleType, filterOptions, className, align = 'left' }: Props) {
	const { t } = useTranslation();
	const dispatch = useDispatch();
	const context = useContext(TimerContext);

	const build = HEADER_MENUS[moduleType];
	if (!build) return null;

	const options = build({ t, dispatch, filterOptions: filterOptions || context?.solvesFilter || {} });
	const label = t('timer_modules.module_settings');

	// A single setting opens straight from the gear (owner, 2026-10-13): a one-line menu in
	// between was a click for nothing. Same trigger class, so it looks the same.
	if (options.length === 1) {
		const [only] = options;
		return (
			<button
				type="button"
				title={only.label}
				aria-label={only.label}
				className={[tileMenu('trigger'), className || b('settings')].join(' ')}
				onClick={(event) => {
					event.preventDefault();
					only.onSelect();
				}}
				// The header is also the drag handle; a press on the gear is a click, never a drag.
				onPointerDown={(event) => event.stopPropagation()}
			>
				<GearSix weight="bold" />
			</button>
		);
	}

	return (
		<TileMenu options={options} title={label} align={align} className={className || b('settings')}>
			<GearSix weight="bold" aria-label={label} />
		</TileMenu>
	);
}
