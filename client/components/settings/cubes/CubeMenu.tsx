import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useDispatch } from 'react-redux';
import './MyCubes.scss';
import block from '../../../styles/bem';
import { openModal } from '../../../actions/general';
import { CubeMenuItem } from './cube_actions';

const b = block('cube-menu');

interface SheetProps {
	title: string;
	items: CubeMenuItem[];
	// Injected by Modal.
	onClose?: () => void;
}

/** The menu as a bottom sheet (phones): big rows, closes before the action runs. */
function CubeMenuSheet({ title, items, onClose }: SheetProps) {
	return (
		<div className={b({ sheet: true })} role="menu" aria-label={title}>
			<div className={b('grabber')} aria-hidden="true" />
			<div className={b('title')}>{title}</div>
			{items.map((item) => (
				<button
					key={item.id}
					type="button"
					role="menuitem"
					className={b('item', { danger: !!item.danger })}
					onClick={() => {
						if (onClose) onClose();
						item.onSelect();
					}}
				>
					<span className={b('icon')}>{item.icon}</span>
					<span>{item.label}</span>
				</button>
			))}
		</div>
	);
}

interface PopoverProps {
	x: number;
	y: number;
	title: string;
	items: CubeMenuItem[];
	onClose: () => void;
}

/** The menu at the pointer (desktop: right click or the ⋯ button), kept inside the viewport. */
function CubeMenuPopover({ x, y, title, items, onClose }: PopoverProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [pos, setPos] = useState({ left: x, top: y });

	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const margin = 8;
		const rect = el.getBoundingClientRect();
		const left = Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin));
		const top = y + rect.height + margin > window.innerHeight ? Math.max(margin, y - rect.height) : y;
		setPos({ left, top });
		el.querySelector<HTMLButtonElement>('button')?.focus();
	}, [x, y]);

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
		<div ref={ref} className={b({ popover: true })} style={{ left: pos.left, top: pos.top }} role="menu" aria-label={title}>
			{items.map((item) => (
				<button
					key={item.id}
					type="button"
					role="menuitem"
					className={b('item', { danger: !!item.danger })}
					onClick={() => {
						onClose();
						item.onSelect();
					}}
				>
					<span className={b('icon')}>{item.icon}</span>
					<span>{item.label}</span>
				</button>
			))}
		</div>,
		document.body
	);
}

export interface CubeMenuOpenArgs {
	title: string;
	items: CubeMenuItem[];
	/** Pointer position for the desktop popover. */
	x: number;
	y: number;
}

/**
 * One context menu for a cube row or the profile header (5.1): a bottom sheet on phones, a
 * popover at the pointer elsewhere. Render `element` somewhere in the owner.
 */
export function useCubeMenu(): { open: (args: CubeMenuOpenArgs) => void; element: React.ReactNode } {
	const dispatch = useDispatch();
	const [popover, setPopover] = useState<CubeMenuOpenArgs | null>(null);
	const close = useCallback(() => setPopover(null), []);

	const open = useCallback(
		(args: CubeMenuOpenArgs) => {
			const phone = typeof window !== 'undefined' && window.innerWidth < 768;
			if (phone) {
				dispatch(openModal(<CubeMenuSheet title={args.title} items={args.items} />, { position: 'bottom' }));
				return;
			}
			setPopover(args);
		},
		[dispatch]
	);

	const element =
		popover && typeof document !== 'undefined' ? (
			<CubeMenuPopover x={popover.x} y={popover.y} title={popover.title} items={popover.items} onClose={close} />
		) : null;

	return { open, element };
}
