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
			{icon && <span className={b('icon')}>{icon}</span>}
			<span className={b('label')}>{text}</span>
			{selected && <Check weight="bold" className={b('check')} />}
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
		return (
			<div className={b('checkbox')}>
				<Checkbox onChange={onChange} text={text} checked={on} />
			</div>
		);
	} else {
		if (header) {
			return <div className={b('header')}>{text}</div>;
		}

		return (
			<button disabled={disabled} className={`${b({ on, selected })}${className ? ` ${className}` : ''}`} onClick={onClick}>
				{body}
			</button>
		);
	}
}
