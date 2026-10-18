import React, { ReactNode, useEffect, useRef, useState } from 'react';
import CSS from 'csstype';
import { useDispatch } from 'react-redux';
import './Modal.scss';
import { closeModal } from '../../../actions/general';
import { CloseButton } from '../icon_button/IconButton';
import ModalHeader from './modal_header/ModalHeader';
import block from '../../../styles/bem';
import { useSwipeBack } from '../../../util/hooks/useSwipeBack';
import { isUiReversed } from '../../../util/reversed-ui';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { isAndroidNative } from '../../../util/platform';

const b = block('modal');

// Open modals, oldest first. Escape closes only the newest one: modals stack (a solve card
// over the solves list, a confirm over a form) and one key press is one step back.
const openModals: symbol[] = [];

// A list, menu or picker open inside the modal takes Escape first (Radix closes its own),
// the modal waits for the next press.
const OPEN_POPUP_SELECTOR = '[data-radix-popper-content-wrapper], [role="listbox"], [role="menu"]';

export interface IModalProps {
	onComplete?: (data?: any) => void;
	onClose?: () => void;
	width?: number;
	zIndex?: number;
	title?: string;
	description?: string;
	noPadding?: boolean;
	overFlowHidden?: boolean;
	hideCloseButton?: boolean;
	closeButtonText?: string;
	children?: ReactNode;
	fullSize?: boolean;
	compact?: boolean;
	disableBackdropClick?: boolean;
	position?: 'center' | 'bottom';
}

export default function Modal(props: IModalProps) {
	const {
		width,
		children,
		zIndex,
		title,
		overFlowHidden,
		fullSize,
		compact,
		description,
		hideCloseButton,
		closeButtonText,
		onClose,
		noPadding,
		onComplete,
		disableBackdropClick,
		position,
	} = props;

	const isBottomSheet = position === 'bottom';

	const modalRef = useRef<HTMLDivElement>(null);
	const [active, setActive] = useState(false);
	const dispatch = useDispatch();
	const mobileMode = useGeneral('mobile_mode');

	useEffect(() => {
		(document.activeElement as any)?.blur();

		setTimeout(() => {
			setActive(true);
		}, 100);
	}, []);

	function clickComplete(data) {
		if (onComplete) {
			setTimeout(() => {
				onComplete(data);
			});
		}

		dispatch(closeModal());
	}

	function clickClose() {
		dispatch(closeModal());

		if (onClose) {
			onClose();
		}
	}

	// Escape closes the modal the way its close button does. Not for a modal that turned the
	// casual ways out off (no close button, or a backdrop that does not close it).
	const escapeClosableRef = useRef(false);
	escapeClosableRef.current = !hideCloseButton && !disableBackdropClick;
	const clickCloseRef = useRef(clickClose);
	clickCloseRef.current = clickClose;

	// Mounted once: the place in the stack is the order the modals opened in.
	useEffect(() => {
		const token = Symbol('modal');
		openModals.push(token);

		function onKeyDown(event: KeyboardEvent) {
			if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
			if (!escapeClosableRef.current || openModals[openModals.length - 1] !== token) return;
			if (document.querySelector(OPEN_POPUP_SELECTOR)) return;
			clickCloseRef.current();
		}

		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('keydown', onKeyDown);
			const index = openModals.indexOf(token);
			if (index !== -1) openModals.splice(index, 1);
		};
	}, []);

	const { translateX: swipeX, progress: swipeProgress, phase: swipePhase } = useSwipeBack({
		containerRef: modalRef,
		onSwipeBack: clickClose,
		// Reversed use turns the modal 180°, so the physical left edge and translateX would
		// move the content against the finger. Closing still works through the backdrop/Done.
		disabled: !mobileMode || isAndroidNative() || isUiReversed(),
		edgeWidth: 24,
		threshold: 100,
	});

	function handleBackdropClick(e: React.MouseEvent) {
		if (disableBackdropClick) {
			return;
		}

		if (e.target === e.currentTarget) {
			clickClose();
		}
	}

	const centerStyle: CSS.Properties = {};
	if (width) {
		centerStyle.maxWidth = width + 'px';
	}

	if (overFlowHidden) {
		centerStyle.overflow = 'hidden';
	}

	if (noPadding) {
		centerStyle.padding = '0';
	}

	if (swipePhase !== 'idle') {
		centerStyle.transform = `translateX(${swipeX}px)`;
		centerStyle.opacity = String(1 - swipeProgress * 0.3);
		centerStyle.transition = swipePhase === 'swiping'
			? 'none'
			: 'transform 0.25s ease, opacity 0.25s ease';
	}

	const style: CSS.Properties = {};
	if (zIndex) {
		style.zIndex = zIndex;
	}

	let closeButton = closeButtonText ? (
		<button
			className={b('close-button', { text: true })}
			type="button"
			onClick={clickClose}
		>
			{closeButtonText}
		</button>
	) : (
		<CloseButton className={b('close-button')} onClick={clickClose} />
	);

	if (hideCloseButton) {
		closeButton = null;
	}

	return (
		<div ref={modalRef} className={b({ active, fullSize, compact, 'position-bottom': isBottomSheet })} style={style} onClick={handleBackdropClick}>
			<div className={b('center')} style={centerStyle} onClick={(e) => e.stopPropagation()}>
				{/* Close before the header: on phones it floats right and stays sticky, and a
				    float only sits beside the content that follows it. */}
				{!isBottomSheet && closeButton}
				{!isBottomSheet && <ModalHeader title={title} description={description} />}
				{React.isValidElement(children) && typeof (children as any).type !== 'string'
					? React.cloneElement(children as any, {
						onClose: clickClose,
						onComplete: clickComplete,
					})
					: children}
			</div>
		</div>
	);
}
