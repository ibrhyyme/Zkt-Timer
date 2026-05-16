import React from 'react';
import block from '../../../styles/bem';

const b = block('trainer');

interface SettingToggleProps {
	label: string;
	description?: string;
	checked: boolean;
	onChange: (next: boolean) => void;
	disabled?: boolean;
}

export default function SettingToggle({label, description, checked, onChange, disabled}: SettingToggleProps) {
	return (
		<div className={b('settings-row', {disabled})}>
			<div className={b('settings-row-text')}>
				<div className={b('settings-row-label')}>{label}</div>
				{description && <div className={b('settings-row-desc')}>{description}</div>}
			</div>
			<button
				type="button"
				className={b('settings-toggle', {on: checked, off: !checked})}
				onClick={() => !disabled && onChange(!checked)}
				disabled={disabled}
				role="switch"
				aria-checked={checked}
			>
				<span className={b('settings-toggle-knob')} />
			</button>
		</div>
	);
}
