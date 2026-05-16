import React from 'react';
import block from '../../../styles/bem';

const b = block('trainer');

interface SettingSelectOption<T extends string> {
	value: T;
	label: string;
}

interface SettingSelectProps<T extends string> {
	label: string;
	value: T;
	options: SettingSelectOption<T>[];
	onChange: (next: T) => void;
}

export default function SettingSelect<T extends string>({label, value, options, onChange}: SettingSelectProps<T>) {
	return (
		<div className={b('settings-row')}>
			<div className={b('settings-row-text')}>
				<div className={b('settings-row-label')}>{label}</div>
			</div>
			<select
				className={b('settings-select')}
				value={value}
				onChange={(e) => onChange(e.target.value as T)}
			>
				{options.map((opt) => (
					<option key={opt.value} value={opt.value}>{opt.label}</option>
				))}
			</select>
		</div>
	);
}
