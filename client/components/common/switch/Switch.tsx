import React from 'react';
import './Switch.scss';
import block from '../../../styles/bem';
import InputLegend from '../inputs/input/input_legend/InputLegend';

const b = block('common-switch');

interface FaceProps {
	on: boolean;
	small?: boolean;
	// A switch whose "on" is a warning (maintenance mode): the error colour, not the accent.
	danger?: boolean;
	disabled?: boolean;
}

/**
 * The switch's look with no behaviour, for a row that is itself the control (Create Room's
 * privacy row is a role="switch" button, and a button cannot hold another button).
 * Everywhere else use the default export.
 */
export function SwitchFace({on, small, danger, disabled}: FaceProps) {
	return (
		<span className={b({on, small, danger, disabled})} aria-hidden="true">
			<span className={b('fill')} />
			<span className={b('ring')} />
			<span className={b('bar')} />
		</span>
	);
}

interface Props extends FaceProps {
	legend?: string;
	// The name a screen reader reads. Not needed inside a <label>, which already names it.
	ariaLabel?: string;
	onChange: (newValue: boolean) => any;
}

/**
 * The app's one on/off switch. Put inside a <label>, the whole row toggles it, because a
 * button is a labelable element.
 */
export default function Switch(props: Props) {
	const {on, small, danger, disabled, legend, ariaLabel, onChange} = props;

	return (
		<div className={b('wrapper')}>
			{legend ? <InputLegend text={legend} /> : null}
			<button
				type="button"
				role="switch"
				aria-checked={on}
				aria-label={ariaLabel || legend}
				disabled={disabled}
				className={b('button')}
				onClick={() => onChange(!on)}
			>
				<SwitchFace on={on} small={small} danger={danger} disabled={disabled} />
			</button>
		</div>
	);
}
