import React, { ReactNode, useState, useRef, useEffect } from 'react';
import './Dropdown.scss';
import block from '../../../../styles/bem';
import CSS from 'csstype';
import { CaretDown } from 'phosphor-react';
import DropdownOption, { IDropdownOption } from './dropdown_option/DropdownOption';
import GenericInput, { GenericInputProps, InputProps } from '../generic_input/GenericInput';
import Button, { ButtonProps } from '../../button/Button';

const b = block('common-dropdown');

export interface DropdownProps extends GenericInputProps<HTMLDivElement> {
	options: IDropdownOption[];
	onClose?: () => void;
	onOpen?: () => void;
	// Opens right aligned and down by default
	openUp?: boolean;
	flat?: boolean;
	openLeft?: boolean;
	handle?: ReactNode;
	icon?: React.ReactElement;
	text?: string;
	dropdownButtonProps?: ButtonProps;
	fullWidth?: boolean;
	dropdownMaxHeight?: string | number;
}

export default function Dropdown(props: InputProps<DropdownProps>) {
	const {
		handle,
		onClose,
		options,
		openUp,
		flat,
		openLeft,
		onOpen,
		fullWidth,
		icon,
		dropdownButtonProps,
		text,
		dropdownMaxHeight,
	} = props;
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	// Manage click listener with cleanup
	useEffect(() => {
		if (!open) return;

		const handleOutsideClick = (e: MouseEvent) => {
			// Inner clicks are always skipped — option/button handlers manage their own
			// close behavior. Closing here would trigger a sync re-render from a native
			// listener and unmount the option before React dispatches its synthetic click.
			if (containerRef.current?.contains(e.target as Node)) {
				return;
			}

			if (onClose) {
				onClose();
			}

			setOpen(false);
		};

		// Capture phase on document so clicks inside elements that stopPropagation
		// (e.g. modal center div) still reach this listener. Delay attach until after
		// the opening click settles.
		const timer = setTimeout(() => {
			document.addEventListener('click', handleOutsideClick, true);
		}, 50);

		return () => {
			clearTimeout(timer);
			document.removeEventListener('click', handleOutsideClick, true);
		};
	}, [open, onClose]);

	// Timer basladiginda acik dropdown'lari kapat
	useEffect(() => {
		if (!open) return;

		const handleTimerStart = () => setOpen(false);
		window.addEventListener('timerInteractionStart', handleTimerStart);
		return () => window.removeEventListener('timerInteractionStart', handleTimerStart);
	}, [open]);

	function toggleDropdown(e) {
		e.preventDefault();

		if (!options || !options.length) {
			return;
		}

		if (open) {
			if (onClose) {
				onClose();
			}
			setOpen(false);
			return;
		}

		setOpen(true);

		if (onOpen) {
			onOpen();
		}
	}

	let body = null;

	if (open) {
		const style: CSS.Properties = {};
		if (dropdownMaxHeight) {
			style.maxHeight = String(dropdownMaxHeight) + 'px';
		}

		// Wrap onClick to close dropdown after option is clicked
		const wrappedOptions = options.map((op) => ({
			...op,
			onClick: op.onClick ? (e) => {
				op.onClick(e);
				// Close dropdown after onClick unless it's a checkbox or disabled
				if (!op.checkbox && !op.disabled) {
					if (onClose) {
						onClose();
					}
					setOpen(false);
				}
			} : op.onClick
		}));

		body = (
			<div className={b('body', { up: openUp, left: openLeft, fullwidth: fullWidth })} style={style}>
				{wrappedOptions.map((op, index) => (
					<DropdownOption key={`${op.text}-${index}`} option={op} />
				))}
			</div>
		);
	}

	let handleDiv = (
		<Button
			flat={flat}
			icon={icon === null ? null : icon || <CaretDown weight="bold" />}
			onClick={toggleDropdown}
			gray
			text={text}
			{...dropdownButtonProps}
		/>
	);
	if (handle) {
		handleDiv = (
			<button className={b('custom-handle')} onClick={toggleDropdown}>
				{handle}
			</button>
		);
	}

	return (
		<GenericInput
			{...props}
			inputWrapper={() => (
				<div ref={containerRef} className={b()}>
					{handleDiv}
					{body}
				</div>
			)}
		/>
	);
}
