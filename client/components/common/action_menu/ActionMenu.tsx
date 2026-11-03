// The menu behind "..." and a long press: a small menu at the pointer on a desktop, a sheet
// rising from the bottom on a phone. My Cubes and Algorithm Sets share it, so a list of actions
// looks and behaves the same wherever it opens.

import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import ReactDOM from 'react-dom';
import {useDispatch} from 'react-redux';
import './ActionMenu.scss';
import block from '../../../styles/bem';
import {openModal} from '../../../actions/general';
import {MOBILE_BREAKPOINT} from '../../../util/hooks/useIsMobile';

const b = block('action-menu');

export interface ActionMenuItem {
	id: string;
	label: string;
	icon?: React.ReactNode;
	danger?: boolean;
	disabled?: boolean;
	/** Shown under a disabled action (e.g. "Internet connection needed"). */
	note?: string;
	onSelect: () => void;
}

/** Where the desktop menu opens. `alignEnd`: x is its right edge, for a button at a card's end. */
export interface ActionMenuAnchor {
	x: number;
	y: number;
	alignEnd?: boolean;
}

export interface ActionMenuOpenArgs extends ActionMenuAnchor {
	title: string;
	items: ActionMenuItem[];
	/** A sentence above the actions. */
	message?: string;
}

/** Under a button, its right edges lined up. */
export function anchorOf(element: Element): ActionMenuAnchor {
	const rect = element.getBoundingClientRect();
	return {x: rect.right, y: rect.bottom + 4, alignEnd: true};
}

function MenuRows({items, onPick}: {items: ActionMenuItem[]; onPick: (item: ActionMenuItem) => void}) {
	return (
		<>
			{items.map((item, index) => (
				<React.Fragment key={item.id}>
					{/* The destructive actions stand apart from the rest. */}
					{item.danger && index > 0 && !items[index - 1].danger ? (
						<div className={b('separator')} role="separator" />
					) : null}
					<button
						type="button"
						role="menuitem"
						className={b('item', {danger: !!item.danger})}
						disabled={item.disabled}
						onClick={() => onPick(item)}
					>
						{item.icon ? <span className={b('icon')}>{item.icon}</span> : null}
						<span className={b('text')}>
							<span>{item.label}</span>
							{item.disabled && item.note ? <span className={b('note')}>{item.note}</span> : null}
						</span>
					</button>
				</React.Fragment>
			))}
		</>
	);
}

interface SheetProps {
	title: string;
	items: ActionMenuItem[];
	message?: string;
	// Injected by Modal.
	onClose?: () => void;
}

/** The menu as a bottom sheet (phones): big rows, closes before the action runs. */
function ActionMenuSheet({title, items, message, onClose}: SheetProps) {
	return (
		<div className={b({sheet: true})} role="menu" aria-label={title}>
			<div className={b('grabber')} aria-hidden="true" />
			<div className={b('title')}>{title}</div>
			{message ? <p className={b('message')}>{message}</p> : null}
			<MenuRows
				items={items}
				onPick={(item) => {
					if (onClose) onClose();
					item.onSelect();
				}}
			/>
		</div>
	);
}

interface PopoverProps extends ActionMenuOpenArgs {
	onClose: () => void;
}

/** The menu at the pointer or under its button, kept inside the viewport. */
function ActionMenuPopover({x, y, alignEnd, title, items, message, onClose}: PopoverProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [pos, setPos] = useState({left: x, top: y});

	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const margin = 8;
		const rect = el.getBoundingClientRect();
		const wanted = alignEnd ? x - rect.width : x;
		const left = Math.max(margin, Math.min(wanted, window.innerWidth - rect.width - margin));
		const top = y + rect.height + margin > window.innerHeight ? Math.max(margin, y - rect.height) : y;
		setPos({left, top});
		el.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
	}, [x, y, alignEnd]);

	useEffect(() => {
		const onPointer = (e: Event) => {
			if (ref.current && !ref.current.contains(e.target as Node)) onClose();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		// Attached after the opening event has finished, or that same click closes the menu.
		const timer = setTimeout(() => {
			document.addEventListener('pointerdown', onPointer, true);
			document.addEventListener('contextmenu', onPointer, true);
		}, 0);
		document.addEventListener('keydown', onKey);
		window.addEventListener('resize', onClose);
		window.addEventListener('scroll', onClose, true);
		return () => {
			clearTimeout(timer);
			document.removeEventListener('pointerdown', onPointer, true);
			document.removeEventListener('contextmenu', onPointer, true);
			document.removeEventListener('keydown', onKey);
			window.removeEventListener('resize', onClose);
			window.removeEventListener('scroll', onClose, true);
		};
	}, [onClose]);

	return ReactDOM.createPortal(
		<div ref={ref} className={b({popover: true})} style={{left: pos.left, top: pos.top}} role="menu" aria-label={title}>
			{message ? <p className={b('message')}>{message}</p> : null}
			<MenuRows
				items={items}
				onPick={(item) => {
					onClose();
					item.onSelect();
				}}
			/>
		</div>,
		document.body
	);
}

/** One context menu for an owner. Render `element` somewhere in the owner. */
export function useActionMenu(): {open: (args: ActionMenuOpenArgs) => void; element: React.ReactNode} {
	const dispatch = useDispatch();
	const [popover, setPopover] = useState<ActionMenuOpenArgs | null>(null);
	const close = useCallback(() => setPopover(null), []);

	const open = useCallback(
		(args: ActionMenuOpenArgs) => {
			if (window.innerWidth < MOBILE_BREAKPOINT) {
				dispatch(
					openModal(<ActionMenuSheet title={args.title} items={args.items} message={args.message} />, {
						position: 'bottom',
					})
				);
				return;
			}
			setPopover(args);
		},
		[dispatch]
	);

	const element = popover && typeof document !== 'undefined' ? <ActionMenuPopover {...popover} onClose={close} /> : null;

	return {open, element};
}
