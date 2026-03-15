import React, { ReactNode, useEffect, useRef, useState } from 'react';
import CSS from 'csstype';
import { useDispatch } from 'react-redux';
import './Modal.scss';
import { X } from 'phosphor-react';
import { closeModal } from '../../../actions/general';
import ModalHeader from './modal_header/ModalHeader';
import block from '../../../styles/bem';
import { useSwipeBack } from '../../../util/hooks/useSwipeBack';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { isAndroidNative } from '../../../util/platform';

const b = block('modal');

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
	disableBackdropClick?: boolean;
}

export default function Modal(props: IModalProps) {
	const {
		width,
		children,
		zIndex,
		title,
		overFlowHidden,
		fullSize,
		description,
		hideCloseButton,
		closeButtonText,
		onClose,
		noPadding,
		onComplete,
		disableBackdropClick,
	} = props;

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

	const { translateX: swipeX, progress: swipeProgress, phase: swipePhase } = useSwipeBack({
		containerRef: modalRef,
		onSwipeBack: clickClose,
		disabled: !mobileMode || isAndroidNative(),
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
		<button
			className={b('close-button')}
			type="button"
			onClick={clickClose}
			aria-label="Kapat"
		>
			<X size={18} />
		</button>
	);

	if (hideCloseButton) {
		closeButton = null;
	}

	return (
		<div ref={modalRef} className={b({ active, fullSize })} style={style} onClick={handleBackdropClick}>
			<div className={b('center')} style={centerStyle} onClick={(e) => e.stopPropagation()}>
				<ModalHeader title={title} description={description} />
				{closeButton}
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
