import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TimerModuleType } from '../@types/enums';
import {
	clampFloatBox,
	computeZoneRects,
	DRAG_SLOP,
	dropIndexInZone,
	hitTestZone,
	TileBox,
	TileDock,
	ZoneRect,
} from './layout';

// Pointer handling for the module tiles.
//
// Two decisions shape this file.
//
// 1. The tile itself never moves while it is being dragged. A ghost of the same size
//    follows the pointer and the real tile stays where it is, dimmed. Moving the real
//    node would mean re-parenting a live module in React, which remounts it: a chart
//    would re-run its entry animation and a list would lose its scroll position, 60
//    times a second. The ghost also costs nothing to move.
// 2. No setPointerCapture. Capture is lost when the captured element is re-parented or
//    removed and it then fires lostpointercapture in the middle of a drag; move and up
//    are listened for on the document instead, which cannot be taken away.

export interface TileDragState {
	id: TimerModuleType;
	width: number;
	height: number;
	x: number;
	y: number;
	zone: TileDock | null;
	/** Where in that zone it would land. Drawn as a slot opening between the tiles. */
	dropIndex: number | null;
	zones: ZoneRect[];
}

interface DragSession {
	id: TimerModuleType;
	/** The pointer that started it. Anything else is a different finger or device. */
	pointerId: number;
	startX: number;
	startY: number;
	/** Pointer position inside the tile, so the ghost sits under the same point of the card. */
	offsetX: number;
	offsetY: number;
	width: number;
	height: number;
	zones: ZoneRect[];
	lifted: boolean;
	zone: TileDock | null;
	/**
	 * The target zone's tile edges, measured once when the pointer entered it.
	 *
	 * Frozen on purpose. The slot that opens where the module would land is itself an
	 * element in that zone, so measuring live would read the positions it just pushed
	 * around and the index would flip back and forth under a still pointer. This also
	 * keeps the promise honest: the index that is drawn is the index that is used.
	 */
	zoneEdges: { start: number; end: number }[] | null;
	dropIndex: number | null;
	pointerX: number;
	pointerY: number;
}

interface Options {
	enabled: boolean;
	stageRef: React.RefObject<HTMLElement>;
	railWidth: number;
	dockHeight: number;
	hasLeft: boolean;
	hasRight: boolean;
	onDock: (id: TimerModuleType, dock: Exclude<TileDock, 'float'>, index: number) => void;
	onFloat: (id: TimerModuleType, box: TileBox) => void;
}

/** Class on <body> while a tile is in flight. Module entry animations stand down. */
const MOVING_CLASS = 'zt-tiles-moving';

/**
 * Removed on a timer rather than on the next frame: dropping a tile and switching tabs
 * in the same breath leaves a requestAnimationFrame that never runs, and the class (with
 * every animation it suppresses) would stay on until the next drag.
 */
const MOVING_CLASS_LINGER_MS = 420;

/**
 * How far a "the button is no longer down" event may sit from the last pressed position
 * before the drop is thrown away instead of applied.
 *
 * Losing the pointerup happens (a window switch, a native drag, a paused debugger) and
 * the fallback is to treat the next button-less move as the release. That is only sound
 * while the pointer is still roughly where it was: if the next thing we hear is a move
 * from the other side of the screen, we do not know where the user let go, and putting
 * the module down at a guessed position is worse than leaving it where it was.
 */
const LOST_POINTER_UP_TOLERANCE = 40;

function tileElement(id: TimerModuleType): HTMLElement | null {
	if (typeof document === 'undefined') return null;
	return document.querySelector<HTMLElement>(`[data-tile-id="${id}"]`);
}

/**
 * The tiles of a zone, as positions along the axis it stacks on. The dragged tile is
 * left out: counting it would shift every index past it by one when a tile is reordered
 * inside its own zone.
 */
function measureZoneEdges(dock: Exclude<TileDock, 'float'>, dragged: TimerModuleType): { start: number; end: number }[] {
	if (typeof document === 'undefined') return [];

	const zone = document.querySelector<HTMLElement>(`[data-tile-zone="${dock}"]`);
	if (!zone) return [];

	const horizontal = dock === 'bottom';
	return Array.from(zone.querySelectorAll<HTMLElement>('[data-tile-id]'))
		.filter((element) => element.dataset.tileId !== dragged)
		.map((element) => {
			const rect = element.getBoundingClientRect();
			return horizontal ? { start: rect.left, end: rect.right } : { start: rect.top, end: rect.bottom };
		});
}

export function useTileDrag(options: Options) {
	const { enabled, stageRef, railWidth, dockHeight, hasLeft, hasRight } = options;

	const [drag, setDrag] = useState<TileDragState | null>(null);
	const session = useRef<DragSession | null>(null);
	const ghostRef = useRef<HTMLDivElement>(null);
	const movingClassTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	// The handlers live for the length of one drag and have to see the current
	// callbacks, not the ones that existed at pointerdown: a settings write landing
	// between down and up would otherwise be dropped.
	const latest = useRef(options);
	latest.current = options;

	// Filled in below. The move/up handlers and the function that detaches them refer to
	// each other, so one side has to go through a ref.
	const detachRef = useRef<() => void>(() => undefined);

	const scheduleMovingClassRemoval = useCallback(() => {
		if (movingClassTimer.current) {
			clearTimeout(movingClassTimer.current);
		}
		movingClassTimer.current = setTimeout(() => {
			movingClassTimer.current = null;
			document.body.classList.remove(MOVING_CLASS);
		}, MOVING_CLASS_LINGER_MS);
	}, []);

	const finish = useCallback(
		(commit: boolean) => {
			const current = session.current;
			session.current = null;
			detachRef.current();

			if (!current) return;

			const source = tileElement(current.id);
			if (source) {
				delete source.dataset.tileDragging;
			}

			if (current.lifted) {
				scheduleMovingClassRemoval();
				setDrag(null);
			}

			if (!commit || !current.lifted) return;

			const pointer = { x: current.pointerX, y: current.pointerY };
			const zone = hitTestZone(pointer, current.zones);

			if (zone && zone !== 'float') {
				latest.current.onDock(current.id, zone, current.dropIndex ?? 0);
				return;
			}

			// Dropped away from every zone: it stays exactly where it was let go.
			latest.current.onFloat(
				current.id,
				clampFloatBox(
					{
						x: pointer.x - current.offsetX,
						y: pointer.y - current.offsetY,
						w: current.width,
						h: current.height,
					},
					{ width: window.innerWidth, height: window.innerHeight }
				)
			);
		},
		[scheduleMovingClassRemoval]
	);

	const lift = useCallback((current: DragSession) => {
		current.lifted = true;

		const source = tileElement(current.id);
		if (source) {
			source.dataset.tileDragging = 'true';
		}
		document.body.classList.add(MOVING_CLASS);

		setDrag({
			id: current.id,
			width: current.width,
			height: current.height,
			x: current.pointerX - current.offsetX,
			y: current.pointerY - current.offsetY,
			zone: current.zone,
			dropIndex: current.dropIndex,
			zones: current.zones,
		});
	}, []);

	const handleMove = useCallback(
		(event: PointerEvent) => {
			const current = session.current;
			if (!current) return;

			// Another pointer (a second finger, a pen, the mouse during a touch drag) is
			// not this drag and must not steer it.
			if (event.pointerId !== current.pointerId) return;

			// A pointerup can be missed entirely. No button down means the drag is over,
			// but only count it as a real release if the pointer is still where it was.
			if (event.buttons === 0) {
				const drift = Math.hypot(event.clientX - current.pointerX, event.clientY - current.pointerY);
				finish(drift <= LOST_POINTER_UP_TOLERANCE);
				return;
			}

			current.pointerX = event.clientX;
			current.pointerY = event.clientY;

			if (!current.lifted) {
				const moved = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
				// A plain click on the grip must not nudge the layout by a pixel.
				if (moved < DRAG_SLOP) return;
				lift(current);
			}

			const ghost = ghostRef.current;
			if (ghost) {
				ghost.style.transform = `translate3d(${event.clientX - current.offsetX}px, ${
					event.clientY - current.offsetY
				}px, 0)`;
			}

			// The pointer picks the zone, not the ghost's rect: a card is wider than the
			// rail it is aimed at, so its rect covers two zones at once and the highlight
			// stops following the cursor.
			const zone = hitTestZone({ x: event.clientX, y: event.clientY }, current.zones);
			if (zone !== current.zone) {
				current.zone = zone;
				// Measure the zone as it is right now, before the slot for this module
				// opens inside it.
				current.zoneEdges = zone && zone !== 'float' ? measureZoneEdges(zone, current.id) : null;
				current.dropIndex = null;
			}

			const dropIndex = current.zoneEdges
				? dropIndexInZone(current.zone === 'bottom' ? event.clientX : event.clientY, current.zoneEdges)
				: null;

			if (zone !== current.zone || dropIndex !== current.dropIndex) {
				current.dropIndex = dropIndex;
				setDrag((previous) => (previous ? { ...previous, zone, dropIndex } : previous));
			}
		},
		[finish, lift]
	);

	const handleUp = useCallback(
		(event: PointerEvent) => {
			const current = session.current;
			if (current && event.pointerId !== current.pointerId) return;
			if (current) {
				current.pointerX = event.clientX;
				current.pointerY = event.clientY;
			}
			finish(true);
		},
		[finish]
	);
	const handleCancel = useCallback(() => finish(false), [finish]);

	// A drag still running when the tab is hidden gets no more pointer events, so it
	// would sit there waiting for an up that never comes.
	const handleVisibility = useCallback(() => {
		if (document.visibilityState === 'hidden') {
			finish(false);
		}
	}, [finish]);

	const attach = useCallback(() => {
		document.addEventListener('pointermove', handleMove);
		document.addEventListener('pointerup', handleUp);
		document.addEventListener('pointercancel', handleCancel);
		document.addEventListener('visibilitychange', handleVisibility);
		window.addEventListener('blur', handleCancel);

		detachRef.current = () => {
			document.removeEventListener('pointermove', handleMove);
			document.removeEventListener('pointerup', handleUp);
			document.removeEventListener('pointercancel', handleCancel);
			document.removeEventListener('visibilitychange', handleVisibility);
			window.removeEventListener('blur', handleCancel);
			detachRef.current = () => undefined;
		};
	}, [handleMove, handleUp, handleCancel, handleVisibility]);

	// Leaving the timer page mid-drag must not leave listeners or a body class behind.
	useEffect(
		() => () => {
			detachRef.current();
			if (movingClassTimer.current) {
				clearTimeout(movingClassTimer.current);
			}
			document.body.classList.remove(MOVING_CLASS);
		},
		[]
	);

	const startDrag = useCallback(
		(event: React.PointerEvent, id: TimerModuleType) => {
			if (!enabled || !event.isPrimary || event.button !== 0) return;

			const tile = (event.currentTarget as HTMLElement).closest('[data-tile-id]') as HTMLElement | null;
			const stage = stageRef.current;
			if (!tile || !stage) return;

			const rect = tile.getBoundingClientRect();
			const stageRect = stage.getBoundingClientRect();

			session.current = {
				id,
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				offsetX: event.clientX - rect.left,
				offsetY: event.clientY - rect.top,
				width: rect.width,
				height: rect.height,
				// Measured once, at the start. Re-measuring mid-drag would slide the zones
				// under the pointer as the layout reacts to the tile being dimmed.
				zones: computeZoneRects(
					{ left: stageRect.left, top: stageRect.top, width: stageRect.width, height: stageRect.height },
					{ railWidth, dockHeight, hasLeft, hasRight }
				),
				lifted: false,
				zone: null,
				zoneEdges: null,
				dropIndex: null,
				pointerX: event.clientX,
				pointerY: event.clientY,
			};

			// Stops the browser reading the grip as text selection or an image drag.
			event.preventDefault();
			attach();
		},
		[enabled, stageRef, railWidth, dockHeight, hasLeft, hasRight, attach]
	);

	return {
		drag,
		ghostRef,
		startDrag,
	};
}
