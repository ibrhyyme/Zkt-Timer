import { useCallback, useMemo } from 'react';
import { TimerModuleType } from '../@types/enums';
import { useSettings } from '../../../util/hooks/useSettings';
import { getDefaultSetting } from '../../../db/settings/query';
import { setSetting, setSettings } from '../../../db/settings/update';
import {
	addTile,
	clampDockHeight,
	clampRailWidth,
	floatTile,
	moveTile,
	removeTile,
	replaceTile,
	resolveTileMap,
	TILE_LIMITS,
	TileBox,
	TileDock,
	TileMap,
	tilesInDock,
} from './layout';

export interface TilesApi {
	tiles: TileMap;
	railWidth: number;
	dockHeight: number;
	left: TimerModuleType[];
	right: TimerModuleType[];
	bottom: TimerModuleType[];
	floating: TimerModuleType[];
	dockTile: (id: TimerModuleType, dock: Exclude<TileDock, 'float'>, index?: number) => void;
	floatTileAt: (id: TimerModuleType, box: TileBox) => void;
	addModule: (id: TimerModuleType, dock?: TileDock) => void;
	removeModule: (id: TimerModuleType) => void;
	replaceModule: (from: TimerModuleType, to: TimerModuleType) => void;
	setRailWidth: (width: number) => void;
	setDockHeight: (height: number) => void;
	resetLayout: () => void;
}

/**
 * Reads the module layout and writes it back.
 *
 * Every write persists the whole resolved map, not a patch. The first drag is therefore
 * also the moment the legacy `timer_layout` / `timer_module_count` fallback stops
 * applying, and there is never a half-migrated state where some modules follow the old
 * settings and some the new ones.
 */
export function useTiles(): TilesApi {
	const stored = useSettings('timer_tiles');
	const legacyLayout = useSettings('timer_layout');
	const legacyModules = useSettings('timer_modules');
	const legacyCount = useSettings('timer_module_count');
	const storedRailWidth = useSettings('timer_rail_width');
	const storedDockHeight = useSettings('timer_dock_height');

	// Whether the older layout settings are still exactly what they ship as. Someone who
	// never touched them gets the new account default; someone who chose "right, five
	// modules" keeps that, converted. Compared against the defaults rather than assumed,
	// because the mobile defaults differ and the list can grow.
	const legacyUntouched =
		legacyLayout === getDefaultSetting('timer_layout') &&
		legacyCount === getDefaultSetting('timer_module_count') &&
		JSON.stringify(legacyModules) === JSON.stringify(getDefaultSetting('timer_modules'));

	const tiles = useMemo(
		() =>
			resolveTileMap(stored, {
				layout: legacyLayout,
				modules: legacyModules,
				count: legacyCount,
				untouched: legacyUntouched,
			}),
		[stored, legacyLayout, legacyModules, legacyCount, legacyUntouched]
	);

	const railWidth = clampRailWidth(storedRailWidth);
	const dockHeight = clampDockHeight(storedDockHeight);

	const save = useCallback((next: TileMap) => {
		setSetting('timer_tiles', next);
	}, []);

	const dockTile = useCallback(
		(id: TimerModuleType, dock: Exclude<TileDock, 'float'>, index?: number) => {
			save(moveTile(tiles, id, dock, index));
		},
		[tiles, save]
	);

	const floatTileAt = useCallback(
		(id: TimerModuleType, box: TileBox) => {
			save(floatTile(tiles, id, box));
		},
		[tiles, save]
	);

	const addModule = useCallback(
		(id: TimerModuleType, dock: TileDock = 'bottom') => {
			save(addTile(tiles, id, dock));
		},
		[tiles, save]
	);

	const removeModule = useCallback(
		(id: TimerModuleType) => {
			save(removeTile(tiles, id));
		},
		[tiles, save]
	);

	const replaceModule = useCallback(
		(from: TimerModuleType, to: TimerModuleType) => {
			save(replaceTile(tiles, from, to));
		},
		[tiles, save]
	);

	const setRailWidth = useCallback((width: number) => {
		setSetting('timer_rail_width', clampRailWidth(width));
	}, []);

	const setDockHeight = useCallback((height: number) => {
		setSetting('timer_dock_height', clampDockHeight(height));
	}, []);

	// Back to "nothing has been dragged": the layout falls through to the legacy
	// settings again, and the sizes to their defaults. One write, because the three keys
	// share the platform prefs blob and separate writes would race each other.
	const resetLayout = useCallback(() => {
		setSettings({
			timer_tiles: null,
			timer_rail_width: TILE_LIMITS.railDefault,
			timer_dock_height: TILE_LIMITS.dockDefault,
		});
	}, []);

	return {
		tiles,
		railWidth,
		dockHeight,
		left: tilesInDock(tiles, 'left'),
		right: tilesInDock(tiles, 'right'),
		bottom: tilesInDock(tiles, 'bottom'),
		floating: tilesInDock(tiles, 'float'),
		dockTile,
		floatTileAt,
		addModule,
		removeModule,
		replaceModule,
		setRailWidth,
		setDockHeight,
		resetLayout,
	};
}
