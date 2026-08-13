// One labelled setting inside a SettingsCard: text on the left, control on the right.
// Rows separate themselves with a rule, so cards don't need per-page spacing hacks.

import React, {ReactNode} from 'react';
import './SettingsRow.scss';
import block from '../../../../styles/bem';

const b = block('settings-row');

interface Props {
	label: string;
	description?: string;
	// The switch, button or badge shown on the trailing edge.
	control?: ReactNode;
	// Stacks the control under the text — for wide controls such as inputs.
	stacked?: boolean;
	children?: ReactNode;
}

export default function SettingsRow(props: Props) {
	const {label, description, control, stacked, children} = props;

	return (
		<div className={b({stacked: !!stacked})}>
			<div className={b('text')}>
				<span className={b('label')}>{label}</span>
				{description ? <span className={b('description')}>{description}</span> : null}
			</div>
			{control ? <div className={b('control')}>{control}</div> : null}
			{children ? <div className={b('content')}>{children}</div> : null}
		</div>
	);
}
