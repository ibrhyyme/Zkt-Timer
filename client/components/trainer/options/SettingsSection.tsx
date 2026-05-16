import React, {ReactNode} from 'react';
import block from '../../../styles/bem';

const b = block('trainer');

interface SettingsSectionProps {
	title: string;
	children: ReactNode;
}

export default function SettingsSection({title, children}: SettingsSectionProps) {
	return (
		<section className={b('settings-section')}>
			<h3 className={b('settings-section-title')}>{title}</h3>
			<div className={b('settings-section-body')}>{children}</div>
		</section>
	);
}
