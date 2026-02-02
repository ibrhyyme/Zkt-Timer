import React, { ReactNode, useEffect, useRef, useState } from 'react';
import CSS from 'csstype';
import { useDispatch } from 'react-redux';
import './Modal.scss';
import { X } from 'phosphor-react';
import { closeModal } from '../../../actions/general';
import ModalHeader from './modal_header/ModalHeader';
import block from '../../../styles/bem';

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
		onClose,
		noPadding,
		onComplete,
		disableBackdropClick,
	} = props;

	const modalRef = useRef<HTMLDivElement>(null);
	const [active, setActive] = useState(false);
	const dispatch = useDispatch();

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

	const style: CSS.Properties = {};
	if (zIndex) {
		style.zIndex = zIndex;
	}

	let closeButton = (
		<button
			className="absolute top-6 right-6 z-40 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-600/70 hover:bg-slate-500/90 text-slate-200 hover:text-slate-50 border border-slate-400/30 hover:border-slate-400/50 transition-all duration-200 hover:scale-105 hover:shadow-lg backdrop-blur-sm"
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
		<div className={b({ active, fullSize })} style={style} onClick={handleBackdropClick}>
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
