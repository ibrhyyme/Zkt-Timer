import { TimerModuleType } from '../@types/enums';
import type { TimerLayoutPosition } from '../../../db/settings/query';

// Placement model for the desktop timer modules.
//
// The old model was one global position (`timer_layout`) plus N anonymous slots
// (`timer_module_count`), so every module shared one place and a module's identity was
// its array index. This one gives every module its own entry: where it sits, and for a
// floating module, its box. A module that is not in the map is not on screen.
//
// Nothing here touches the DOM or the settings DB on purpose — it is the part that can
// be unit tested, and the drag layer calls into it rather than reimplementing the rules.

export const TILE_DOCKS = ['left', 'right', 'bottom', 'float'] as const;
export type TileDock = (typeof TILE_DOCKS)[number];

export interface TileBox {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface TileConfig {
	dock: TileDock;
	/** Position within its dock, renumbered 0..n-1 on every write. Unused when floating. */
	order: number;
	/**
	 * Viewport pixels, floating tiles only. A docked tile always stores null: its size
	 * belongs to the zone, and carrying a stale width from the float layer into a rail
	 * produced a module as narrow as wherever it had been dragged from.
	 */
	x?: number | null;
	y?: number | null;
	w?: number | null;
	h?: number | null;
}

export type TileMap = Record<string, TileConfig>;

/** Modules that can be placed. Mirrors the dropdown in TimerModule, minus `none`. */
export const PLACEABLE_MODULES: TimerModuleType[] = [
	TimerModuleType.HISTORY,
	TimerModuleType.STATS,
	TimerModuleType.SCRAMBLE,
	TimerModuleType.LAST_SOLVE,
	TimerModuleType.TIME_DISTRO,
	TimerModuleType.CONSISTENCY,
	TimerModuleType.SOLVE_GRAPH,
	TimerModuleType.CROSS_SOLVER,
	TimerModuleType.PHASE_ANALYSIS,
	TimerModuleType.LIVE_ANALYSIS,
];

const PLACEABLE_SET = new Set<string>(PLACEABLE_MODULES);

export function isPlaceableModule(id: string): id is TimerModuleType {
	return PLACEABLE_SET.has(id);
}

// Sizes are stored in CSS pixels, never in rem or viewport units. The whole point of
// the rewrite is that browser zoom scales the modules without reflowing them into a
// different arrangement, and a rem is not a stable unit here: the root font size steps
// from 15px to 14px at 1500px (styles/reset.scss), which a zoom step crosses.
export const TILE_LIMITS = {
	railMin: 240,
	railMax: 620,
	railDefault: 340,
	dockMin: 160,
	dockMax: 640,
	dockDefault: 300,
	floatMinW: 240,
	floatMinH: 150,
	floatDefaultW: 380,
	floatDefaultH: 280,
};

/** Movement below this is a click, not a drag. */
export const DRAG_SLOP = 4;

/** A floating tile may hang off the bottom edge, but this much stays reachable. */
export const FLOAT_KEEP_X = 90;
export const FLOAT_GRIP_ROOM = 14;
export const FLOAT_KEEP_BOTTOM = 34;

export function clampNumber(value: number, min: number, max: number): number {
	if (Number.isNaN(value)) return min;
	return Math.min(max, Math.max(min, value));
}

export function clampRailWidth(width: number): number {
	return Math.round(clampNumber(width, TILE_LIMITS.railMin, TILE_LIMITS.railMax));
}

export function clampDockHeight(height: number): number {
	return Math.round(clampNumber(height, TILE_LIMITS.dockMin, TILE_LIMITS.dockMax));
}

/**
 * Keep a floating tile reachable without trapping it.
 *
 * Forcing the whole box on screen makes a tall module impossible to drag to the bottom
 * bar: its lower edge hits the viewport, the box stops, and the pointer walks off the
 * grip. So the rule is a window manager's: the top edge (where the grip is) stays on
 * screen, a strip stays visible horizontally, and overflow past the bottom is allowed.
 */
export function clampFloatBox(box: TileBox, viewport: { width: number; height: number }): TileBox {
	const w = Math.max(TILE_LIMITS.floatMinW, Math.round(box.w));
	const h = Math.max(TILE_LIMITS.floatMinH, Math.round(box.h));

	return {
		w,
		h,
		x: Math.round(clampNumber(box.x, FLOAT_KEEP_X - w, Math.max(FLOAT_KEEP_X - w, viewport.width - FLOAT_KEEP_X))),
		y: Math.round(clampNumber(box.y, FLOAT_GRIP_ROOM, Math.max(FLOAT_GRIP_ROOM, viewport.height - FLOAT_KEEP_BOTTOM))),
	};
}

/** Tiles of one dock, in their stored order. */
export function tilesInDock(map: TileMap, dock: TileDock): TimerModuleType[] {
	return Object.keys(map)
		.filter((id) => map[id]?.dock === dock)
		.sort((a, b) => (map[a].order ?? 0) - (map[b].order ?? 0)) as TimerModuleType[];
}

/** Renumber every dock's orders to 0..n-1 so stored orders never drift or collide. */
function renumber(map: TileMap): TileMap {
	const next: TileMap = {};
	for (const dock of TILE_DOCKS) {
		tilesInDock(map, dock).forEach((id, index) => {
			next[id] = { ...map[id], order: index };
		});
	}
	return next;
}

/**
 * Drop a tile into a docked zone at `index` (append when omitted). Floating geometry is
 * cleared: the zone owns the size now.
 */
export function moveTile(map: TileMap, id: TimerModuleType, dock: Exclude<TileDock, 'float'>, index?: number): TileMap {
	const others = tilesInDock(map, dock).filter((other) => other !== id);
	const at = index === undefined ? others.length : clampNumber(index, 0, others.length);
	others.splice(at, 0, id);

	const next: TileMap = { ...map };
	next[id] = { dock, order: at, x: null, y: null, w: null, h: null };
	others.forEach((other, order) => {
		next[other] = { ...next[other], order };
	});

	return renumber(next);
}

/** Park a tile on the float layer at a viewport box. */
export function floatTile(map: TileMap, id: TimerModuleType, box: TileBox): TileMap {
	const next: TileMap = { ...map };
	next[id] = { dock: 'float', order: 0, x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h) };
	return renumber(next);
}

export function removeTile(map: TileMap, id: TimerModuleType): TileMap {
	const next: TileMap = { ...map };
	delete next[id];
	return renumber(next);
}

/** Add a module to a dock's end. A module already on screen is not added twice. */
export function addTile(map: TileMap, id: TimerModuleType, dock: TileDock = 'bottom'): TileMap {
	if (map[id]) return map;
	if (dock === 'float') {
		return floatTile(map, id, {
			x: 0,
			y: 0,
			w: TILE_LIMITS.floatDefaultW,
			h: TILE_LIMITS.floatDefaultH,
		});
	}
	return moveTile(map, id, dock);
}

/**
 * Swap which module a tile shows, keeping its place. Used by the type picker in the
 * tile header. Picking a module that is already on screen swaps the two rather than
 * silently producing one module in two places (they are keyed by module, so the second
 * would overwrite the first and one tile would vanish).
 */
export function replaceTile(map: TileMap, from: TimerModuleType, to: TimerModuleType): TileMap {
	if (from === to || !map[from]) return map;

	const next: TileMap = { ...map };
	const fromConfig = next[from];
	const toConfig = next[to];

	delete next[from];
	next[to] = fromConfig;
	if (toConfig) {
		next[from] = toConfig;
	}

	return renumber(next);
}

/** Drop anything unknown and coerce the rest, so an old or hand-edited blob cannot crash the layout. */
export function normalizeTileMap(raw: unknown): TileMap {
	if (!raw || typeof raw !== 'object') return {};

	const out: TileMap = {};
	for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
		if (!isPlaceableModule(id) || !value || typeof value !== 'object') continue;

		const config = value as Partial<TileConfig>;
		const dock = TILE_DOCKS.includes(config.dock as TileDock) ? (config.dock as TileDock) : 'bottom';
		const order = typeof config.order === 'number' && Number.isFinite(config.order) ? config.order : 0;

		if (dock === 'float') {
			out[id] = {
				dock,
				order,
				x: typeof config.x === 'number' ? config.x : 0,
				y: typeof config.y === 'number' ? config.y : 0,
				w: typeof config.w === 'number' ? config.w : TILE_LIMITS.floatDefaultW,
				h: typeof config.h === 'number' ? config.h : TILE_LIMITS.floatDefaultH,
			};
		} else {
			out[id] = { dock, order, x: null, y: null, w: null, h: null };
		}
	}

	return renumber(out);
}

/**
 * What a new account starts with: two modules down each side and nothing under the
 * timer. Four is enough to be useful on the first day and few enough that none of them
 * is a thin strip, and the solve list wants height far more than it wants width, which
 * is what a column gives it.
 */
export const FACTORY_TILE_MAP: TileMap = {
	[TimerModuleType.HISTORY]: { dock: 'left', order: 0, x: null, y: null, w: null, h: null },
	[TimerModuleType.CROSS_SOLVER]: { dock: 'left', order: 1, x: null, y: null, w: null, h: null },
	[TimerModuleType.STATS]: { dock: 'right', order: 0, x: null, y: null, w: null, h: null },
	[TimerModuleType.SCRAMBLE]: { dock: 'right', order: 1, x: null, y: null, w: null, h: null },
};

/**
 * The layout a user gets before they have ever dragged anything: their existing
 * `timer_layout` + `timer_modules` + `timer_module_count`, expressed as tiles. Nobody's
 * timer rearranges itself the day this ships, which is the only acceptable migration
 * for a screen people have arranged to their taste.
 */
export function buildLegacyTileMap(
	layout: TimerLayoutPosition,
	modules: TimerModuleType[],
	count: number
): TileMap {
	const dock: Exclude<TileDock, 'float'> = layout === 'left' || layout === 'right' ? layout : 'bottom';
	const limit = clampNumber(Math.round(count || 3), 1, 6);

	const map: TileMap = {};
	let order = 0;
	for (const moduleType of modules || []) {
		if (order >= limit) break;
		if (!isPlaceableModule(moduleType) || map[moduleType]) continue;
		map[moduleType] = { dock, order, x: null, y: null, w: null, h: null };
		order++;
	}

	return map;
}

/**
 * Which layout applies. Three cases, in order:
 *
 * 1. A stored layout, including an empty one. An empty object means the user removed
 *    every module, which is a decision, not a missing value: treating it as "unset"
 *    brought the whole old footer back the moment the last module was closed.
 * 2. No stored layout and the older settings still at their factory values: the new
 *    account default (two modules per side).
 * 3. No stored layout but the older settings were customised: those, converted. Someone
 *    who had chosen "right, four modules" keeps exactly that.
 */
export function resolveTileMap(
	stored: unknown,
	legacy: { layout: TimerLayoutPosition; modules: TimerModuleType[]; count: number; untouched?: boolean }
): TileMap {
	if (stored && typeof stored === 'object') {
		return normalizeTileMap(stored);
	}
	if (legacy.untouched) {
		return normalizeTileMap(FACTORY_TILE_MAP);
	}
	return normalizeTileMap(buildLegacyTileMap(legacy.layout, legacy.modules, legacy.count));
}

/** A bar narrower than this is not worth offering as a drop target. */
export const MIN_DOCK_ZONE_WIDTH = 260;

export interface ZoneRect {
	dock: TileDock;
	left: number;
	top: number;
	width: number;
	height: number;
}

/**
 * The drop zones, derived from the timer stage and the stored sizes.
 *
 * One function, used both to draw the snap preview and to place the tile on drop. When
 * those two came from different measurements (a CSS variable for the preview, the real
 * rect for the placement) the module landed somewhere other than the outline that had
 * just been promised.
 *
 * The bar spans the gap between the rails that exist, because that is exactly how it
 * renders. Rails are listed first, so a corner where an absent rail overlaps the bar
 * resolves to the rail: that is the only way to start a rail that is currently empty.
 */
export function computeZoneRects(
	stage: { left: number; top: number; width: number; height: number },
	opts: { railWidth: number; dockHeight: number; hasLeft: boolean; hasRight: boolean }
): ZoneRect[] {
	const rail = clampRailWidth(opts.railWidth);
	const dock = clampDockHeight(opts.dockHeight);

	const zones: ZoneRect[] = [
		{ dock: 'left', left: stage.left, top: stage.top, width: rail, height: stage.height },
		{ dock: 'right', left: stage.left + stage.width - rail, top: stage.top, width: rail, height: stage.height },
	];

	const barLeft = stage.left + (opts.hasLeft ? rail : 0);
	const barRight = stage.left + stage.width - (opts.hasRight ? rail : 0);
	const barWidth = barRight - barLeft;

	if (barWidth >= MIN_DOCK_ZONE_WIDTH) {
		zones.push({
			dock: 'bottom',
			left: barLeft,
			top: stage.top + stage.height - dock,
			width: barWidth,
			height: dock,
		});
	}

	return zones;
}

/**
 * Which zone the pointer is over. The pointer decides, not the dragged box: a tile is
 * wider than the rail it is aimed at, so testing its rect makes it overlap two zones at
 * once and the drop lands wherever the tie-break falls rather than where it was aimed.
 */
export function hitTestZone(point: { x: number; y: number }, zones: ZoneRect[]): TileDock | null {
	for (const zone of zones) {
		if (
			point.x >= zone.left &&
			point.x <= zone.left + zone.width &&
			point.y >= zone.top &&
			point.y <= zone.top + zone.height
		) {
			return zone.dock;
		}
	}
	return null;
}

/**
 * Where in a stacked zone a drop lands, from the pointer and the current tiles' rects.
 * Past the midpoint of a tile means after it.
 */
export function dropIndexInZone(
	pointer: number,
	tileEdges: { start: number; end: number }[]
): number {
	for (let i = 0; i < tileEdges.length; i++) {
		const { start, end } = tileEdges[i];
		if (pointer < start + (end - start) / 2) {
			return i;
		}
	}
	return tileEdges.length;
}
