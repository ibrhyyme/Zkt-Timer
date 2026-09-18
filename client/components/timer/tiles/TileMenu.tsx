import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Check } from 'phosphor-react';
import block from '../../../styles/bem';
import './TileMenu.scss';

const b = block('tile-menu');

export interface TileMenuOption {
	key: string;
	label: string;
	selected?: boolean;
	onSelect: () => void;
}

interface Props {
	options: TileMenuOption[];
	/** Which edge of the trigger the list lines up with. */
	align?: 'left' | 'right';
	title?: string;
	className?: string;
	children: ReactNode;
}

/** Rough height of one row, used to ask for space before the list exists. */
const ITEM_HEIGHT = 37;
const LIST_PADDING = 12;
const GAP = 6;
const EDGE = 8;

/**
 * The menu behind a tile header and the "+" button.
 *
 * It exists instead of the shared Dropdown for one reason: the list is drawn into
 * <body> at viewport coordinates. A menu rendered inside the tile is clipped by the
 * column it lives in, because the columns scroll (that is what keeps a module from
 * being squeezed below its readable size). In the side columns the list came out
 * half-cut; in the bottom bar, which clips vertically, it never appeared at all.
 *
 * Opening upwards or downwards is decided from the space actually available, so a tile
 * at the bottom of the screen and one at the top both get a list that fits.
 */
export default function TileMenu({ options, align = 'left', title, className, children }: Props) {
	const [open, setOpen] = useState(false);
	const [box, setBox] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);

	const place = useCallback(() => {
		const trigger = triggerRef.current;
		if (!trigger) return;

		const rect = trigger.getBoundingClientRect();
		const width = Math.max(rect.width, 200);

		// What the whole list would like, and what each side can actually give it. The
		// list used to be capped at a flat 280px, which cut the last entries off on a
		// ten-module menu and left no way to reach them.
		const wanted = options.length * ITEM_HEIGHT + LIST_PADDING;
		const spaceBelow = window.innerHeight - rect.bottom - GAP - EDGE;
		const spaceAbove = rect.top - GAP - EDGE;

		let openUp: boolean;
		if (wanted <= spaceBelow) {
			openUp = false;
		} else if (wanted <= spaceAbove) {
			openUp = true;
		} else {
			// Neither side fits it whole, so take the roomier one and let it scroll.
			openUp = spaceAbove > spaceBelow;
		}

		const maxHeight = Math.max(120, Math.min(wanted, openUp ? spaceAbove : spaceBelow));
		const left = align === 'right' ? rect.right - width : rect.left;

		setBox({
			left: Math.min(Math.max(EDGE, left), window.innerWidth - width - EDGE),
			top: openUp ? Math.max(EDGE, rect.top - GAP - maxHeight) : rect.bottom + GAP,
			width,
			maxHeight,
		});
	}, [align, options.length]);

	useEffect(() => {
		if (!open) return undefined;

		place();

		function onPointerDown(event: MouseEvent) {
			const target = event.target as Node;
			if (triggerRef.current?.contains(target)) return;
			if ((target as HTMLElement).closest?.(`.${b()}`)) return;
			setOpen(false);
		}
		function onKey(event: KeyboardEvent) {
			if (event.key === 'Escape') setOpen(false);
		}
		// Anything that MOVES the trigger invalidates the position the list was placed at,
		// and a menu floating next to nothing is worse than no menu. Scrolling the list
		// itself is not that: it fires a scroll event like any other, and closing on it
		// meant a list too long to fit could never be scrolled to its last entry.
		function onReflow(event?: Event) {
			if (event && listRef.current?.contains(event.target as Node)) return;
			setOpen(false);
		}

		document.addEventListener('mousedown', onPointerDown, true);
		document.addEventListener('keydown', onKey);
		window.addEventListener('resize', onReflow);
		window.addEventListener('scroll', onReflow, true);

		return () => {
			document.removeEventListener('mousedown', onPointerDown, true);
			document.removeEventListener('keydown', onKey);
			window.removeEventListener('resize', onReflow);
			window.removeEventListener('scroll', onReflow, true);
		};
	}, [open, place]);

	return (
		<>
			<button
				type="button"
				ref={triggerRef}
				title={title}
				className={[b('trigger'), className].filter(Boolean).join(' ')}
				onClick={(event) => {
					event.preventDefault();
					setOpen((previous) => !previous);
				}}
				// The header is also the drag handle, and a press on the trigger is a click,
				// never the start of a drag.
				onPointerDown={(event) => event.stopPropagation()}
			>
				{children}
			</button>

			{open &&
				box &&
				typeof document !== 'undefined' &&
				ReactDOM.createPortal(
					<div
						ref={listRef}
						className={b()}
						style={{ left: box.left, top: box.top, width: box.width, maxHeight: box.maxHeight }}
					>
						{options.map((option) => (
							<button
								type="button"
								key={option.key}
								className={b('option', { selected: option.selected })}
								onClick={() => {
									setOpen(false);
									option.onSelect();
								}}
							>
								<span>{option.label}</span>
								{option.selected && <Check weight="bold" />}
							</button>
						))}
					</div>,
					document.body
				)}
		</>
	);
}
