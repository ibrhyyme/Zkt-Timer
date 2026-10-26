// Pick one of a few options: a row of chips that wraps on a narrow screen, the selected one
// filled with the user's accent. Settings-style editors use it where a big tab bar
// (HorizontalNav) or a dropdown is too heavy for three to eight short choices.

import React from 'react';
import './ChoiceGroup.scss';
import block from '../../../styles/bem';

const b = block('choice-group');

export interface ChoiceOption<T extends string | number> {
	value: T;
	label: React.ReactNode;
	/** Tooltip, and the spoken name when the label is a symbol (σ). */
	title?: string;
	disabled?: boolean;
}

interface Props<T extends string | number> {
	options: ChoiceOption<T>[];
	/** Selected value; one that matches no option selects nothing (a typed custom count). */
	value: T | null;
	onChange: (value: T) => void;
	/** Names the group for a screen reader. */
	label: string;
	/** Digits in a fixed-width face (counts, times). */
	numeric?: boolean;
	className?: string;
}

export default function ChoiceGroup<T extends string | number>(props: Props<T>) {
	const {options, value, onChange, label, numeric, className} = props;

	return (
		<div role="radiogroup" aria-label={label} className={b({numeric}) + (className ? ' ' + className : '')}>
			{options.map((option) => {
				const selected = option.value === value;
				return (
					<button
						type="button"
						role="radio"
						aria-checked={selected}
						key={String(option.value)}
						className={b('option', {selected})}
						title={option.title}
						aria-label={option.title}
						disabled={option.disabled}
						onClick={() => !selected && onChange(option.value)}
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}
