import React from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'phosphor-react';
import './DropdownOption.scss';
import block from '../../../../../styles/bem';
import Checkbox from '../../../checkbox/Checkbox';

const b = block('dropdown-option');

export interface IDropdownOption {
	text: string;
	checkbox?: boolean;
	link?: string;
	icon?: React.ReactElement;
	on?: boolean;
	selected?: boolean;
	disabled?: boolean;
	hidden?: boolean;
	header?: boolean;
	className?: string;
	onClick?: React.MouseEventHandler<HTMLButtonElement>;
	onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

interface Props {
	option: IDropdownOption;
}

export default function DropdownOption(props: Props) {
	const { text, hidden, checkbox, onChange, disabled, link, icon, on, selected, onClick, header, className } = props.option;

	const body = (
		<>
			<span>{text}</span>
			{icon || (selected && <Check weight="bold" />)}
		</>
	);

	if (hidden) {
		return null;
	}

	if (link) {
		if (link.startsWith('http')) {
			return (
				<a className={b({ on })} href={link}>
					{body}
				</a>
			);
		} else {
			return (
				<Link className={`${b({ on })}${className ? ` ${className}` : ''}`} to={link}>
					{body}
				</Link>
			);
		}
	} else if (checkbox) {
		return <Checkbox onChange={onChange} text={text} checked={on} />;
	} else {
		if (header) {
			return (
				<div
					className={`${b({})} cursor-default select-none`}
					style={{
						pointerEvents: 'none',
						padding: '6px 12px',
						fontSize: '0.7rem',
						fontWeight: 700,
						letterSpacing: '0.08em',
						textAlign: 'center',
						color: 'var(--tm-c-text-tertiary, #888)',
						borderTop: '1px solid rgba(255,255,255,0.08)',
						borderBottom: '1px solid rgba(255,255,255,0.08)',
						background: 'rgba(255,255,255,0.03)',
						marginTop: '4px',
					}}
				>
					=== {text} ===
				</div>
			);
		}

		return (
			<button disabled={disabled} className={`${b({ on, selected })}${className ? ` ${className}` : ''}`} onClick={onClick}>
				{body}
			</button>
		);
	}
}
