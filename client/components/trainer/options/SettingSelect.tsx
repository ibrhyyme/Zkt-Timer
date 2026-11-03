import React from 'react';
import SelectMenu from '../../common/select_menu/SelectMenu';
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
			<SelectMenu
				value={value}
				onChange={(next) => onChange(next as T)}
				ariaLabel={label}
				align="end"
				options={options.map((opt) => ({value: opt.value, label: opt.label}))}
			/>
		</div>
	);
}
