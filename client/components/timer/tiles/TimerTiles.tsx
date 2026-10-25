import React, { ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'phosphor-react';
import block from '../../../styles/bem';
import TileMenu from './TileMenu';
import { TimerModuleType } from '../@types/enums';
import { TimerContext } from '../Timer';
import { MODULE_LABEL_KEYS } from '../module_registry';
import TimerTile from './TimerTile';
import { useTiles } from './useTiles';
import { useTileDrag } from './useTileDrag';
import { useEdgeResize } from './useEdgeResize';
import {
	clampDockHeight,
	clampFloatBox,
	clampRailWidth,
	FloatFrame,
	floatBoxOnScreen,
	PLACEABLE_MODULES,
	RailSplitStart,
	railSizeOf,
	splitRailSizes,
	TILE_LIMITS,
	TileBox,
	TileDock,
} from './layout';
import { measureFloatFrame, measureTopInset } from './dom_env';
import './TimerTiles.scss';

const b = block('timer-tiles');

interface Props {
	/** The element the zones are measured against: the timer wrapper. */
	stageRef: React.RefObject<HTMLDivElement>;
	/** The timer column itself, which sits between the rails. */
	children: ReactNode;
}

/**
 * The desktop module area: a left rail, a right rail, a bar under the timer, and a free
 * layer over everything. Each module knows where it lives, so the same screen can carry
 * a list on the left, a chart on the right and a scramble floating over the corner.
 *
 * Every size here is a stored pixel value, never a rem or a viewport unit, and no count
 * is derived from the available space. That is deliberate: the old footer recomputed how
 * many modules fitted from the column height and sized itself in rem, so a browser zoom
 * step changed the number of modules on screen and their proportions. Zoom now scales
 * what is there and rearranges nothing.
 *
 * Mobile does not come through here at all. It keeps its own three-section footer.
 */
export default function TimerTiles({ stageRef, children }: Props) {
	const { t } = useTranslation();
	const context = useContext(TimerContext);
	const tiles = useTiles();

	// The area floating tiles are drawn inside: the window below the site's top bar.
	// Re-read on resize so a tile stored for a bigger window, or stored under the bar
	// before that was prevented, is drawn where it can be reached again.
	const [floatFrame, setFloatFrame] = useState<FloatFrame>(measureFloatFrame);
	useEffect(() => {
		const update = () =>
			setFloatFrame((previous) => {
				const next = measureFloatFrame();
				return previous.width === next.width &&
					previous.height === next.height &&
					previous.topInset === next.topInset
					? previous
					: next;
			});
		update();
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	}, []);

	// No rearranging during a solve. The tiles are faded out and pointer-inert then, and
	// a drag begun just before the timer started would otherwise survive into it.
	const draggable = !context.timeStartedAt && !context.inInspection;

	const onDock = useCallback(
		(id: TimerModuleType, dock: Exclude<TileDock, 'float'>, index: number) => tiles.dockTile(id, dock, index),
		[tiles]
	);
	const onFloat = useCallback((id: TimerModuleType, box: TileBox) => tiles.floatTileAt(id, box), [tiles]);

	const { drag, ghostRef, startDrag } = useTileDrag({
		enabled: draggable,
		stageRef,
		railWidth: tiles.railWidth,
		dockHeight: tiles.dockHeight,
		hasLeft: tiles.left.length > 0,
		hasRight: tiles.right.length > 0,
		onDock,
		onFloat,
	});

	// The stored sizes reach the stylesheet as CSS variables on the stage, which is also
	// what the resize handles preview into. One channel for both, so a release never
	// fights the value the drag just wrote.
	useEffect(() => {
		const stage = stageRef.current;
		if (!stage) return;
		stage.style.setProperty('--zt-tile-rail-w', `${tiles.railWidth}px`);
		stage.style.setProperty('--zt-tile-dock-h', `${tiles.dockHeight}px`);
	}, [stageRef, tiles.railWidth, tiles.dockHeight]);

	// --- sizing handles -----------------------------------------------------------
	// Previews write a CSS variable straight onto the stage; only the release writes the
	// setting. See useEdgeResize.

	const previewRail = useCallback(
		(width: number) => stageRef.current?.style.setProperty('--zt-tile-rail-w', `${clampRailWidth(width)}px`),
		[stageRef]
	);
	const previewDock = useCallback(
		(height: number) => stageRef.current?.style.setProperty('--zt-tile-dock-h', `${clampDockHeight(height)}px`),
		[stageRef]
	);

	const startLeftResize = useEdgeResize({
		getStart: () => ({ width: tiles.railWidth, height: 0 }),
		onPreview: ({ width }) => previewRail(width),
		onCommit: ({ width }) => tiles.setRailWidth(width),
		signX: 1,
	});

	const startRightResize = useEdgeResize({
		getStart: () => ({ width: tiles.railWidth, height: 0 }),
		onPreview: ({ width }) => previewRail(width),
		onCommit: ({ width }) => tiles.setRailWidth(width),
		signX: -1,
	});

	// The bar is drawn shorter than its stored height when the timer column needs the room
	// (TimerLayout.scss, the column's floor). The drag starts from what is on screen, or
	// the first stretch of it would move nothing while it ate through the hidden part.
	const barRef = React.useRef<HTMLDivElement>(null);
	const startDockResize = useEdgeResize({
		getStart: () => ({ width: 0, height: barRef.current?.offsetHeight || tiles.dockHeight }),
		onPreview: ({ height }) => previewDock(height),
		onCommit: ({ height }) => tiles.setDockHeight(height),
		signY: -1,
	});

	// Floating tiles resize from their bottom-right corner. The tile being resized is
	// remembered on the element itself, because one handler serves every floating tile.
	const resizingId = React.useRef<TimerModuleType | null>(null);
	const startFloatResize = useEdgeResize({
		getStart: () => {
			const id = resizingId.current;
			const config = id ? tiles.tiles[id] : null;
			return {
				width: config?.w || TILE_LIMITS.floatDefaultW,
				height: config?.h || TILE_LIMITS.floatDefaultH,
			};
		},
		onPreview: ({ width, height }) => {
			const id = resizingId.current;
			if (!id) return;
			const element = document.querySelector<HTMLElement>(`[data-tile-id="${id}"]`);
			if (!element) return;
			element.style.width = `${Math.max(TILE_LIMITS.floatMinW, Math.round(width))}px`;
			element.style.height = `${Math.max(TILE_LIMITS.floatMinH, Math.round(height))}px`;
		},
		onCommit: ({ width, height }) => {
			const id = resizingId.current;
			resizingId.current = null;
			const config = id ? tiles.tiles[id] : null;
			if (!id || !config) return;

			// From where the tile is drawn, not the raw stored value, which may be one the
			// display clamp had to move.
			const drawn = floatBoxOnScreen(config, floatFrame);
			tiles.floatTileAt(
				id,
				clampFloatBox(
					{ x: drawn.x, y: drawn.y, w: width, h: height },
					{ width: window.innerWidth, height: window.innerHeight },
					measureTopInset()
				)
			);
		},
		signX: 1,
		signY: 1,
	});

	const onFloatResizeStart = useCallback(
		(event: React.PointerEvent, id: TimerModuleType) => {
			resizingId.current = id;
			startFloatResize(event);
		},
		[startFloatResize]
	);

	// The edge between two modules in a side rail. Dragging it trades height between
	// those two only, so the top module has just its bottom edge, the bottom one just its
	// top edge, and the rail never grows past the page. Stored as weights (layout.ts).
	const splitRef = React.useRef<(RailSplitStart & { upper: TimerModuleType; lower: TimerModuleType }) | null>(null);
	const tileElement = (id: TimerModuleType) => document.querySelector<HTMLElement>(`[data-tile-id="${id}"]`);
	const applySplit = (sizes: { upper: number; lower: number }) => {
		const split = splitRef.current;
		if (!split) return;
		const upper = tileElement(split.upper);
		const lower = tileElement(split.lower);
		if (upper) upper.style.flexGrow = String(sizes.upper);
		if (lower) lower.style.flexGrow = String(sizes.lower);
	};
	const startSplitResize = useEdgeResize({
		getStart: () => ({ width: 0, height: splitRef.current?.upperHeight || 0 }),
		onPreview: ({ height }) => {
			if (splitRef.current) applySplit(splitRailSizes(splitRef.current, height));
		},
		onCommit: ({ height }) => {
			const split = splitRef.current;
			splitRef.current = null;
			if (!split) return;
			const sizes = splitRailSizes(split, height);
			tiles.setRailTileSizes({ [split.upper]: sizes.upper, [split.lower]: sizes.lower });
		},
		onCancel: () => {
			const split = splitRef.current;
			if (split) applySplit({ upper: split.upperSize, lower: split.lowerSize });
			splitRef.current = null;
		},
		signY: 1,
	});

	const onSplitStart = (event: React.PointerEvent, upper: TimerModuleType, lower: TimerModuleType) => {
		const upperElement = tileElement(upper);
		const lowerElement = tileElement(lower);
		if (!upperElement || !lowerElement) return;
		splitRef.current = {
			upper,
			lower,
			upperHeight: upperElement.getBoundingClientRect().height,
			lowerHeight: lowerElement.getBoundingClientRect().height,
			upperSize: railSizeOf(tiles.tiles[upper]),
			lowerSize: railSizeOf(tiles.tiles[lower]),
		};
		startSplitResize(event);
	};

	// --- rendering ----------------------------------------------------------------

	const renderTile = (id: TimerModuleType, dock: TileDock) => {
		const config = tiles.tiles[id];
		const box = dock === 'float' ? floatBoxOnScreen(config, floatFrame) : null;
		const style = box
			? {
					left: `${box.x}px`,
					top: `${box.y}px`,
					width: `${box.w}px`,
					height: `${box.h}px`,
			  }
			: undefined;

		return (
			<TimerTile
				key={id}
				moduleType={id}
				dock={dock}
				draggable={draggable}
				style={style}
				grow={dock === 'left' || dock === 'right' ? railSizeOf(config) : undefined}
				onDragStart={startDrag}
				onResizeStart={dock === 'float' ? onFloatResizeStart : undefined}
				onRemove={tiles.removeModule}
				onReplace={tiles.replaceModule}
			/>
		);
	};

	/**
	 * A zone's tiles, with the slot where the dragged module would land opened between
	 * them. Highlighting the zone alone answered "it goes in this column" but not "and
	 * it takes this place in it", so a drop onto a column that already had modules read
	 * as a swap.
	 */
	const renderZoneTiles = (dock: Exclude<TileDock, 'float'>, modules: TimerModuleType[]) => {
		const items: ReactNode[] = modules.map((id) => renderTile(id, dock));

		// The edges between rail modules. Not while a module is being moved: the slot
		// opening between tiles is the only thing that should be there then.
		if ((dock === 'left' || dock === 'right') && draggable && !drag) {
			for (let i = modules.length - 1; i > 0; i--) {
				const upper = modules[i - 1];
				const lower = modules[i];
				items.splice(
					i,
					0,
					<span
						key={`__split-${upper}`}
						className={b('split')}
						onPointerDown={(event) => onSplitStart(event, upper, lower)}
						aria-hidden="true"
					/>
				);
			}
		}

		if (drag && drag.zone === dock && drag.dropIndex !== null) {
			const at = Math.min(Math.max(drag.dropIndex, 0), items.length);
			items.splice(at, 0, <span key="__drop-slot" className={b('slot', { [dock]: true })} />);
		}

		return items;
	};

	const unplaced = PLACEABLE_MODULES.filter((id) => !tiles.tiles[id]);

	const renderAddButton = (dock: TileDock) => {
		if (!draggable || !unplaced.length) return null;

		return (
			<div className={b('add')}>
				<TileMenu
					align="right"
					title={t('timer_tiles.add_module')}
					className={b('add-handle')}
					options={unplaced.map((id) => ({
						key: id,
						label: t(MODULE_LABEL_KEYS[id] || id),
						onSelect: () => tiles.addModule(id, dock),
					}))}
				>
					<Plus weight="bold" />
				</TileMenu>
			</div>
		);
	};

	const renderRail = (dock: 'left' | 'right') => {
		const modules = dock === 'left' ? tiles.left : tiles.right;
		// An empty rail takes no space. It is still a drop target: the zones are computed
		// from the stage and the stored rail width, not from the rail's own rect, so a rail
		// that is not on screen can still be aimed at and will appear on drop.
		if (!modules.length) return null;

		return (
			// The wrapper exists so the add button and the resize handle sit OUTSIDE the
			// scrolling part. Inside it, a full column scrolled them out of reach and the
			// menu they opened was clipped by that same overflow.
			<div className={b('rail-wrap', { [dock]: true })}>
				<div className={b('rail')} data-tile-zone={dock}>
					{renderZoneTiles(dock, modules)}
				</div>
				{renderAddButton(dock)}
				<span
					className={b('rail-handle', { [dock]: true })}
					onPointerDown={dock === 'left' ? startLeftResize : startRightResize}
					aria-hidden="true"
				/>
			</div>
		);
	};

	// With every module removed there is no zone left to hover, and the "+" lives inside
	// a zone. A thin strip under the timer keeps one way back in that does not require
	// knowing that the settings page has a reset button.
	const nothingPlaced =
		!tiles.left.length && !tiles.right.length && !tiles.bottom.length && !tiles.floating.length;

	const bar =
		tiles.bottom.length || (nothingPlaced && draggable) ? (
			<div ref={barRef} className={b('bar-wrap', { empty: nothingPlaced })}>
				{!nothingPlaced && (
					<span className={b('bar-handle')} onPointerDown={startDockResize} aria-hidden="true" />
				)}
				<div className={b('bar')} data-tile-zone="bottom">
					{renderZoneTiles('bottom', tiles.bottom)}
					{nothingPlaced && <span className={b('empty-label')}>{t('timer_tiles.add_module')}</span>}
				</div>
				{renderAddButton('bottom')}
			</div>
		) : null;

	return (
		<>
			{renderRail('left')}

			<div className={b('center')}>
				{children}
				{bar}
			</div>

			{renderRail('right')}

			{/* Free layer. Fixed rather than absolute, and deliberately free of transform
			    and filter: either would turn this element into the containing block for
			    its fixed children and the coordinates stored per tile would stop being
			    viewport coordinates. */}
			{!!tiles.floating.length && (
				<div className={b('float-layer')}>{tiles.floating.map((id) => renderTile(id, 'float'))}</div>
			)}

			{drag && (
				<div className={b('overlay')}>
					{drag.zones.map((zone) => (
						<div
							key={zone.dock}
							className={b('zone', { active: drag.zone === zone.dock })}
							style={{ left: zone.left, top: zone.top, width: zone.width, height: zone.height }}
						>
							<span className={b('zone-label')}>{t(`timer_tiles.zone_${zone.dock}`)}</span>
						</div>
					))}

					<div
						ref={ghostRef}
						className={b('ghost')}
						style={{
							width: drag.width,
							height: drag.height,
							transform: `translate3d(${drag.x}px, ${drag.y}px, 0)`,
						}}
					>
						<span className={b('ghost-label')}>{t(MODULE_LABEL_KEYS[drag.id] || drag.id)}</span>
					</div>
				</div>
			)}
		</>
	);
}
