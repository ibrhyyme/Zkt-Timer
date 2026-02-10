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
	preventCloseOnInnerClick?: boolean;
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
		preventCloseOnInnerClick,
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
			if (preventCloseOnInnerClick && containerRef.current?.contains(e.target as Node)) {
				return;
			}

			if (onClose) {
				onClose();
			}

			setOpen(false);
		};

		// Delay creating the listener to avoid immediate closing on the opening click
		const timer = setTimeout(() => {
			window.addEventListener('click', handleOutsideClick);
		}, 50);

		return () => {
			clearTimeout(timer);
			window.removeEventListener('click', handleOutsideClick);
		};
	}, [open, preventCloseOnInnerClick, onClose]);

	function openDropdown(e) {
		e.preventDefault();

		if (open || !options || !options.length) {
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
			onClick={openDropdown}
			gray
			text={text}
			{...dropdownButtonProps}
		/>
	);
	if (handle) {
		handleDiv = (
			<button className={b('custom-handle')} onClick={openDropdown}>
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
