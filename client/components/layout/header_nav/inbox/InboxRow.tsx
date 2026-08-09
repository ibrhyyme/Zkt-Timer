import React, {useEffect, useRef, useState} from 'react';
import block from '../../../../styles/bem';

const b = block('inbox-panel');

const DISMISS_THRESHOLD = 84;
const DRAG_SLOP = 6;
const SLIDE_OUT_MS = 180;

interface Props {
	unread: boolean;
	onOpen: () => void;
	onDismiss: () => void;
	children: React.ReactNode;
}

/**
 * A row that can be swiped away with the mouse (or a finger).
 *
 * Pointer events cover mouse, touch and pen in one path. Two details make it behave:
 * the drag state lives in refs so a fast move never reads a stale value, and the row
 * is removed only after it has slid out. Removing it on pointerup instead would let
 * the trailing click land on whichever row moved up into the cursor.
 */
export default function InboxRow({unread, onOpen, onDismiss, children}: Props) {
	const [offset, setOffset] = useState(0);
	const [dragging, setDragging] = useState(false);

	const draggingRef = useRef(false);
	const startX = useRef(0);
	const moved = useRef(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => () => {
		if (timer.current) clearTimeout(timer.current);
	}, []);

	function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
		// Primary button only, so right-click never starts a drag.
		if (e.button !== 0) return;
		startX.current = e.clientX;
		moved.current = false;
		draggingRef.current = true;
		setDragging(true);
		e.currentTarget.setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
		if (!draggingRef.current) return;
		const delta = e.clientX - startX.current;
		if (Math.abs(delta) > DRAG_SLOP) moved.current = true;
		// Left only: dragging right has no meaning here and would feel unanchored.
		setOffset(Math.min(0, delta));
	}

	function endDrag(e: React.PointerEvent<HTMLDivElement>) {
		if (!draggingRef.current) return;
		draggingRef.current = false;
		setDragging(false);

		try {
			e.currentTarget.releasePointerCapture(e.pointerId);
		} catch {
			// capture may already be released
		}

		if (offset <= -DISMISS_THRESHOLD) {
			setOffset(-420);
			timer.current = setTimeout(onDismiss, SLIDE_OUT_MS);
			return;
		}

		setOffset(0);
	}

	return (
		<div className={b('row-wrap')}>
			<div className={b('row-behind')} aria-hidden="true" />
			<div
				className={b('row', {unread, dragging})}
				style={{transform: `translateX(${offset}px)`}}
				role="button"
				tabIndex={0}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={endDrag}
				onPointerCancel={endDrag}
				onClick={(e) => {
					// A drag is not a click, and the row underneath must not receive it.
					if (moved.current) {
						e.preventDefault();
						e.stopPropagation();
						return;
					}
					onOpen();
				}}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						onOpen();
					}
				}}
			>
				{children}
			</div>
		</div>
	);
}
