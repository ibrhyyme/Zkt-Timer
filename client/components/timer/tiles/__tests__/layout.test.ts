import { TimerModuleType } from '../../@types/enums';
import {
	addTile,
	buildLegacyTileMap,
	clampDockHeight,
	clampFloatBox,
	clampRailWidth,
	computeZoneRects,
	dropIndexInZone,
	floatTile,
	hitTestZone,
	moveTile,
	normalizeTileMap,
	removeTile,
	replaceTile,
	resolveTileMap,
	MIN_DOCK_ZONE_WIDTH,
	TILE_LIMITS,
	TileMap,
	tilesInDock,
	ZoneRect,
} from '../layout';

const VIEWPORT = { width: 1600, height: 900 };

function legacyThree(): TileMap {
	return buildLegacyTileMap(
		'bottom',
		[TimerModuleType.HISTORY, TimerModuleType.STATS, TimerModuleType.SCRAMBLE, TimerModuleType.LAST_SOLVE],
		3
	);
}

describe('buildLegacyTileMap', () => {
	it('keeps the old layout: the first `count` modules, all in the old position', () => {
		const map = legacyThree();

		expect(tilesInDock(map, 'bottom')).toEqual([
			TimerModuleType.HISTORY,
			TimerModuleType.STATS,
			TimerModuleType.SCRAMBLE,
		]);
		expect(map[TimerModuleType.LAST_SOLVE]).toBeUndefined();
	});

	it('maps the side layouts onto the matching rail', () => {
		const map = buildLegacyTileMap('right', [TimerModuleType.HISTORY, TimerModuleType.STATS], 2);
		expect(tilesInDock(map, 'right')).toEqual([TimerModuleType.HISTORY, TimerModuleType.STATS]);
	});

	it('never places the same module twice, even when the legacy list repeats it', () => {
		const map = buildLegacyTileMap('bottom', [TimerModuleType.HISTORY, TimerModuleType.HISTORY, TimerModuleType.STATS], 3);
		expect(tilesInDock(map, 'bottom')).toEqual([TimerModuleType.HISTORY, TimerModuleType.STATS]);
	});
});

describe('resolveTileMap', () => {
	it('falls back to the legacy layout when nothing has been dragged yet', () => {
		const map = resolveTileMap(null, {
			layout: 'left',
			modules: [TimerModuleType.HISTORY, TimerModuleType.STATS],
			count: 2,
		});
		expect(tilesInDock(map, 'left')).toEqual([TimerModuleType.HISTORY, TimerModuleType.STATS]);
	});

	it('treats an empty stored layout as a decision, not as unset', () => {
		// Removing the last module used to bring the entire old footer back.
		expect(resolveTileMap({}, { layout: 'bottom', modules: [TimerModuleType.HISTORY], count: 3 })).toEqual({});
	});

	it('gives a new account the two-per-side default', () => {
		const map = resolveTileMap(null, {
			layout: 'bottom',
			modules: [TimerModuleType.HISTORY, TimerModuleType.STATS, TimerModuleType.SCRAMBLE],
			count: 3,
			untouched: true,
		});

		expect(tilesInDock(map, 'left')).toEqual([TimerModuleType.HISTORY, TimerModuleType.CROSS_SOLVER]);
		expect(tilesInDock(map, 'right')).toEqual([TimerModuleType.STATS, TimerModuleType.SCRAMBLE]);
		expect(tilesInDock(map, 'bottom')).toEqual([]);
	});

	it('keeps a customised old layout instead of the new default', () => {
		const map = resolveTileMap(null, {
			layout: 'right',
			modules: [TimerModuleType.HISTORY, TimerModuleType.STATS],
			count: 2,
			untouched: false,
		});

		expect(tilesInDock(map, 'right')).toEqual([TimerModuleType.HISTORY, TimerModuleType.STATS]);
	});

	it('prefers a stored layout over the legacy settings', () => {
		const stored = { [TimerModuleType.SCRAMBLE]: { dock: 'right', order: 0 } };
		const map = resolveTileMap(stored, {
			layout: 'bottom',
			modules: [TimerModuleType.HISTORY],
			count: 3,
		});
		expect(tilesInDock(map, 'right')).toEqual([TimerModuleType.SCRAMBLE]);
		expect(tilesInDock(map, 'bottom')).toEqual([]);
	});
});

describe('moveTile', () => {
	it('inserts at the drop index and renumbers the zone', () => {
		const map = moveTile(legacyThree(), TimerModuleType.SCRAMBLE, 'bottom', 0);

		expect(tilesInDock(map, 'bottom')).toEqual([
			TimerModuleType.SCRAMBLE,
			TimerModuleType.HISTORY,
			TimerModuleType.STATS,
		]);
		expect(Object.values(map).map((tile) => tile.order)).toEqual([0, 1, 2]);
	});

	it('drops the float geometry, so a docked tile never carries a stale width', () => {
		const floated = floatTile(legacyThree(), TimerModuleType.HISTORY, { x: 40, y: 60, w: 300, h: 200 });
		const docked = moveTile(floated, TimerModuleType.HISTORY, 'left');

		expect(docked[TimerModuleType.HISTORY]).toMatchObject({ dock: 'left', x: null, y: null, w: null, h: null });
	});

	it('moves a tile out of its old zone rather than copying it', () => {
		const map = moveTile(legacyThree(), TimerModuleType.HISTORY, 'right');

		expect(tilesInDock(map, 'right')).toEqual([TimerModuleType.HISTORY]);
		expect(tilesInDock(map, 'bottom')).toEqual([TimerModuleType.STATS, TimerModuleType.SCRAMBLE]);
	});
});

describe('addTile / removeTile / replaceTile', () => {
	it('ignores a module that is already on screen', () => {
		const map = legacyThree();
		expect(addTile(map, TimerModuleType.HISTORY, 'left')).toBe(map);
	});

	it('appends a new module to the end of its zone', () => {
		const map = addTile(legacyThree(), TimerModuleType.SOLVE_GRAPH, 'bottom');
		expect(tilesInDock(map, 'bottom')).toEqual([
			TimerModuleType.HISTORY,
			TimerModuleType.STATS,
			TimerModuleType.SCRAMBLE,
			TimerModuleType.SOLVE_GRAPH,
		]);
	});

	it('closes the gap when a tile is removed', () => {
		const map = removeTile(legacyThree(), TimerModuleType.STATS);
		expect(tilesInDock(map, 'bottom')).toEqual([TimerModuleType.HISTORY, TimerModuleType.SCRAMBLE]);
		expect(map[TimerModuleType.SCRAMBLE].order).toBe(1);
	});

	it('swaps the two places when the picked module is already shown elsewhere', () => {
		const map = replaceTile(
			moveTile(legacyThree(), TimerModuleType.SCRAMBLE, 'right'),
			TimerModuleType.HISTORY,
			TimerModuleType.SCRAMBLE
		);

		expect(tilesInDock(map, 'bottom')).toEqual([TimerModuleType.SCRAMBLE, TimerModuleType.STATS]);
		expect(tilesInDock(map, 'right')).toEqual([TimerModuleType.HISTORY]);
	});

	it('takes the place over when the picked module is not shown', () => {
		const map = replaceTile(legacyThree(), TimerModuleType.STATS, TimerModuleType.PHASE_ANALYSIS);

		expect(tilesInDock(map, 'bottom')).toEqual([
			TimerModuleType.HISTORY,
			TimerModuleType.PHASE_ANALYSIS,
			TimerModuleType.SCRAMBLE,
		]);
		expect(map[TimerModuleType.STATS]).toBeUndefined();
	});
});

describe('clampFloatBox', () => {
	it('lets a tall tile hang off the bottom so it can still be dragged downwards', () => {
		const box = clampFloatBox({ x: 400, y: 700, w: 380, h: 600 }, VIEWPORT);
		expect(box.y).toBe(700);
	});

	it('keeps the grip edge on screen', () => {
		const box = clampFloatBox({ x: 400, y: -500, w: 380, h: 300 }, VIEWPORT);
		expect(box.y).toBe(14);
	});

	it('keeps a strip visible on both sides', () => {
		expect(clampFloatBox({ x: -5000, y: 100, w: 380, h: 300 }, VIEWPORT).x).toBe(90 - 380);
		expect(clampFloatBox({ x: 5000, y: 100, w: 380, h: 300 }, VIEWPORT).x).toBe(VIEWPORT.width - 90);
	});

	it('enforces the minimum size', () => {
		const box = clampFloatBox({ x: 10, y: 10, w: 10, h: 10 }, VIEWPORT);
		expect(box.w).toBe(TILE_LIMITS.floatMinW);
		expect(box.h).toBe(TILE_LIMITS.floatMinH);
	});
});

describe('clampRailWidth / clampDockHeight', () => {
	it('stays inside the limits', () => {
		expect(clampRailWidth(10)).toBe(TILE_LIMITS.railMin);
		expect(clampRailWidth(9000)).toBe(TILE_LIMITS.railMax);
		expect(clampDockHeight(10)).toBe(TILE_LIMITS.dockMin);
		expect(clampDockHeight(9000)).toBe(TILE_LIMITS.dockMax);
	});
});

describe('normalizeTileMap', () => {
	it('drops modules that no longer exist and junk values', () => {
		const map = normalizeTileMap({
			ghost_module: { dock: 'left', order: 0 },
			[TimerModuleType.HISTORY]: { dock: 'nowhere', order: 'x' },
			[TimerModuleType.STATS]: null,
		});

		expect(Object.keys(map)).toEqual([TimerModuleType.HISTORY]);
		expect(map[TimerModuleType.HISTORY].dock).toBe('bottom');
		expect(map[TimerModuleType.HISTORY].order).toBe(0);
	});

	it('returns an empty map for anything that is not an object', () => {
		expect(normalizeTileMap(null)).toEqual({});
		expect(normalizeTileMap('left')).toEqual({});
	});
});

describe('hitTestZone', () => {
	const zones: ZoneRect[] = [
		{ dock: 'left', left: 0, top: 0, width: 300, height: 900 },
		{ dock: 'right', left: 1300, top: 0, width: 300, height: 900 },
		{ dock: 'bottom', left: 300, top: 600, width: 1000, height: 300 },
	];

	it('answers with the zone under the pointer', () => {
		expect(hitTestZone({ x: 100, y: 100 }, zones)).toBe('left');
		expect(hitTestZone({ x: 1400, y: 100 }, zones)).toBe('right');
		expect(hitTestZone({ x: 800, y: 700 }, zones)).toBe('bottom');
	});

	it('answers null over the timer itself, which is how a tile ends up floating', () => {
		expect(hitTestZone({ x: 800, y: 200 }, zones)).toBeNull();
	});
});

describe('dropIndexInZone', () => {
	const edges = [
		{ start: 0, end: 100 },
		{ start: 100, end: 200 },
		{ start: 200, end: 300 },
	];

	it('lands before a tile in its first half and after it in its second', () => {
		expect(dropIndexInZone(10, edges)).toBe(0);
		expect(dropIndexInZone(60, edges)).toBe(1);
		expect(dropIndexInZone(160, edges)).toBe(2);
		expect(dropIndexInZone(999, edges)).toBe(3);
	});

	it('appends into an empty zone', () => {
		expect(dropIndexInZone(50, [])).toBe(0);
	});
});

describe('computeZoneRects', () => {
	const stage = { left: 0, top: 100, width: 1600, height: 800 };

	it('puts the bar between the rails that exist', () => {
		const zones = computeZoneRects(stage, { railWidth: 340, dockHeight: 300, hasLeft: true, hasRight: true });
		const bar = zones.find((zone) => zone.dock === 'bottom');

		expect(bar).toMatchObject({ left: 340, width: 1600 - 680, top: 100 + 800 - 300, height: 300 });
	});

	it('lets the bar span the full width when no rail is in the way', () => {
		const zones = computeZoneRects(stage, { railWidth: 340, dockHeight: 300, hasLeft: false, hasRight: false });
		expect(zones.find((zone) => zone.dock === 'bottom')).toMatchObject({ left: 0, width: 1600 });
	});

	it('offers both rails even when they are empty, so a rail can be started', () => {
		const zones = computeZoneRects(stage, { railWidth: 340, dockHeight: 300, hasLeft: false, hasRight: false });
		expect(zones.map((zone) => zone.dock)).toContain('left');
		expect(zones.map((zone) => zone.dock)).toContain('right');
	});

	it('drops the bar zone when the gap between the rails gets too narrow', () => {
		const narrow = { left: 0, top: 0, width: 2 * 340 + MIN_DOCK_ZONE_WIDTH - 10, height: 700 };
		const zones = computeZoneRects(narrow, { railWidth: 340, dockHeight: 300, hasLeft: true, hasRight: true });
		expect(zones.some((zone) => zone.dock === 'bottom')).toBe(false);
	});

	it('resolves a corner to the rail rather than the bar', () => {
		const zones = computeZoneRects(stage, { railWidth: 340, dockHeight: 300, hasLeft: false, hasRight: false });
		expect(hitTestZone({ x: 20, y: 880 }, zones)).toBe('left');
	});
});
