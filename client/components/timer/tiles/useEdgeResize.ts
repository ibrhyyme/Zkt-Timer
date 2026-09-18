import React, { useCallback, useEffect, useRef } from 'react';

interface Options {
	/** Size when the drag started. Read at pointerdown, never mid-drag. */
	getStart: () => { width: number; height: number };
	/** Called on every move. Writes to the DOM, not to settings. */
	onPreview: (size: { width: number; height: number }) => void;
	/** Called once, on release. This is the write that persists. */
	onCommit: (size: { width: number; height: number }) => void;
	/** 1 when dragging right grows the box, -1 when it shrinks it, 0 when the axis is fixed. */
	signX?: number;
	signY?: number;
}

interface Session {
	startX: number;
	startY: number;
	width: number;
	height: number;
	current: { width: number; height: number };
}

/**
 * Pointer drag for the edges that size the layout: a rail's inner edge, the bar's top
 * edge, a floating tile's corner.
 *
 * Every move previews through the DOM and only the release writes a setting. A settings
 * write goes through LokiJS, an event, a re-render and eventually a server mutation, and
 * doing that per pointermove made the edge lag several frames behind the cursor.
 */
export function useEdgeResize(options: Options) {
	const session = useRef<Session | null>(null);
	const latest = useRef(options);
	latest.current = options;

	const detachRef = useRef<() => void>(() => undefined);

	const handleMove = useCallback((event: PointerEvent) => {
		const current = session.current;
		if (!current) return;

		if (event.buttons === 0) {
			detachRef.current();
			latest.current.onCommit(current.current);
			session.current = null;
			return;
		}

		const { signX = 0, signY = 0 } = latest.current;
		const size = {
			width: current.width + (event.clientX - current.startX) * signX,
			height: current.height + (event.clientY - current.startY) * signY,
		};

		current.current = size;
		latest.current.onPreview(size);
	}, []);

	const handleUp = useCallback(() => {
		const current = session.current;
		session.current = null;
		detachRef.current();
		if (current) {
			latest.current.onCommit(current.current);
		}
	}, []);

	const handleCancel = useCallback(() => {
		session.current = null;
		detachRef.current();
	}, []);

	useEffect(
		() => () => {
			detachRef.current();
		},
		[]
	);

	return useCallback(
		(event: React.PointerEvent) => {
			if (!event.isPrimary || event.button !== 0) return;

			const start = latest.current.getStart();
			session.current = {
				startX: event.clientX,
				startY: event.clientY,
				width: start.width,
				height: start.height,
				current: start,
			};

			event.preventDefault();
			event.stopPropagation();

			document.addEventListener('pointermove', handleMove);
			document.addEventListener('pointerup', handleUp);
			document.addEventListener('pointercancel', handleCancel);
			window.addEventListener('blur', handleCancel);

			detachRef.current = () => {
				document.removeEventListener('pointermove', handleMove);
				document.removeEventListener('pointerup', handleUp);
				document.removeEventListener('pointercancel', handleCancel);
				window.removeEventListener('blur', handleCancel);
				detachRef.current = () => undefined;
			};
		},
		[handleMove, handleUp, handleCancel]
	);
}
