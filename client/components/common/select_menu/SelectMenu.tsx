// A plain list of values as the shared menu, where a native <select> would otherwise sit.
// The browser draws a native list itself, so it can never match the rest of the app.

import React from 'react';
import FancyDropdown, {FancyDropdownOption} from '../../timer/header_control/FancyDropdown';
import block from '../../../styles/bem';
import './SelectMenu.scss';

const b = block('select-menu');

interface Props {
	value: string | number | null | undefined;
	onChange: (value: string) => void;
	options: FancyDropdownOption[];
	/** The list has no text of its own to name it, so a screen reader needs this. */
	ariaLabel: string;
	/** Shown when the value matches no option. */
	placeholder?: string;
	disabled?: boolean;
	/** Fills its column, as a select in a form does. */
	fullWidth?: boolean;
	className?: string;
	align?: 'start' | 'end';
}

export default function SelectMenu(props: Props) {
	const {value, onChange, options, ariaLabel, placeholder, disabled, fullWidth, className, align} = props;

	const current = value === null || value === undefined ? '' : String(value);
	const selected = options.find((option) => option.value === current);

	return (
		<FancyDropdown
			value={current}
			onValueChange={onChange}
			options={options}
			triggerLabel={selected ? selected.label : placeholder ?? current}
			ariaLabel={ariaLabel}
			disabled={disabled}
			align={align}
			className={[b({full: fullWidth}), className].filter(Boolean).join(' ')}
		/>
	);
}
