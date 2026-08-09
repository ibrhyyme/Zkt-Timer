import React, {useEffect, useRef, useState} from 'react';
import block from '../../../styles/bem';
import './SwipeRow.scss';

const b = block('swipe-row');

// Past this much drag the row stays open on release; below it, it springs back.
const OPEN_THRESHOLD = 40;
// Movement under this is a tap, not a drag.
const DRAG_SLOP = 6;
// A vertical gesture belongs to the scroll container, not to us.
const VERTICAL_GUARD = 12;

export interface SwipeAction {
	key: string;
	label: string;
	icon: React.ReactNode;
	tone?: 'danger';
	onSelect: () => void;
}

interface Props {
	actions: SwipeAction[];
	onOpen: () => void;
	/** Told when this row opens, so the list can close whichever row was open before. */
	onSwipeOpen?: () => void;
	open: boolean;
	children: React.ReactNode;
}

/**
 * A list row that reveals its actions when dragged to the left.
 *
 * The pattern people already know from WhatsApp: the row slides, a strip of icons sits
 * underneath, and tapping anywhere else puts it back. It exists because the same four
 * actions were previously only reachable from a menu inside the conversation, which
 * means opening a thread you wanted to mute or delete without reading.
 *
 * Only one row is open at a time. That is the list's job, not this component's: it
 * reports opening and takes `open` back as a prop, so two rows can never sit open with
 * their action strips fighting for the same thumb.
 */
export default function SwipeRow({actions, onOpen, onSwipeOpen, open, children}: Props) {
	const width = actions.length * 68;
	const [offset, setOffset] = useState(0);
	const [dragging, setDragging] = useState(false);

	const draggingRef = useRef(false);
	const start = useRef({x: 0, y: 0});
	const moved = useRef(false);
	const axisLocked = useRef<'x' | 'y' | null>(null);

	// The list closes rows by flipping `open`, so the offset has to follow it rather
	// than being the only source of truth.
	useEffect(() => {
		if (!open) setOffset(0);
		else setOffset(-width);
	}, [open, width]);

	function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
		if (e.button !== 0) return;
		start.current = {x: e.clientX, y: e.clientY};
		moved.current = false;
		axisLocked.current = null;
		draggingRef.current = true;
		setDragging(true);
	}

	function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
		if (!draggingRef.current) return;

		const dx = e.clientX - start.current.x;
		const dy = e.clientY - start.current.y;

		// Decide once whether this gesture is ours or the scroller's, then stick to it.
		if (!axisLocked.current) {
			if (Math.abs(dy) > VERTICAL_GUARD && Math.abs(dy) > Math.abs(dx)) {
				axisLocked.current = 'y';
				draggingRef.current = false;
				setDragging(false);
				setOffset(open ? -width : 0);
				return;
			}
			if (Math.abs(dx) > DRAG_SLOP) axisLocked.current = 'x';
		}
		if (axisLocked.current !== 'x') return;

		moved.current = true;
		// Capture only once we own the gesture, so a vertical scroll is never stolen.
		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch {
			// capture unavailable; the drag still works, it just ends on leave
		}

		const base = open ? -width : 0;
		// Rubber band past the strip so it feels bounded rather than broken.
		const next = Math.max(-width - 24, Math.min(0, base + dx));
		setOffset(next);
	}

	function endDrag(e: React.PointerEvent<HTMLDivElement>) {
		if (!draggingRef.current && axisLocked.current !== 'x') {
			draggingRef.current = false;
			setDragging(false);
			return;
		}
		draggingRef.current = false;
		setDragging(false);

		try {
			e.currentTarget.releasePointerCapture(e.pointerId);
		} catch {
			// already released
		}

		const shouldOpen = offset <= -OPEN_THRESHOLD;
		setOffset(shouldOpen ? -width : 0);
		if (shouldOpen && !open) onSwipeOpen?.();
		if (!shouldOpen && open) onSwipeOpen?.();
	}

	return (
		<div className={b()}>
			<div className={b('actions')} style={{width}} aria-hidden={!open}>
				{actions.map((action) => (
					<button
						key={action.key}
						type="button"
						className={b('action', {danger: action.tone === 'danger'})}
						tabIndex={open ? 0 : -1}
						onClick={(e) => {
							e.stopPropagation();
							action.onSelect();
						}}
					>
						<span className={b('action-icon')}>{action.icon}</span>
						<span className={b('action-label')}>{action.label}</span>
					</button>
				))}
			</div>

			<div
				className={b('front', {dragging})}
				style={{transform: `translateX(${offset}px)`}}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={endDrag}
				onPointerCancel={endDrag}
				onClick={(e) => {
					// A drag always ends with a click too. Letting that click through would
					// immediately toggle the row shut again, so the strip appeared and
					// vanished in the same gesture.
					if (moved.current) {
						e.preventDefault();
						e.stopPropagation();
						moved.current = false;
						return;
					}

					// A real tap on an open row puts it away rather than opening the thread:
					// otherwise the actions could only be dismissed by going into the
					// conversation you were trying to act on without opening.
					if (open) {
						e.preventDefault();
						e.stopPropagation();
						onSwipeOpen?.();
						return;
					}

					onOpen();
				}}
			>
				{children}
			</div>
		</div>
	);
}
