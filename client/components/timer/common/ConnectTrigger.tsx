import React from 'react';
import {Bluetooth} from 'phosphor-react';
import block from '../../../styles/bem';
import './ConnectTrigger.scss';

const b = block('connect-trigger');

export type ConnectTriggerState = 'idle' | 'busy' | 'connected';

interface Props {
	state: ConnectTriggerState;
	// Omitted when connected: the green glyph alone says it.
	text?: string;
	onClick?: () => void;
	// The glyph; Bluetooth unless the device connects some other way (the Kamera Timer's camera).
	icon?: React.ElementType;
}

// The one connect control on the timer (smart cube, GAN Timer, QiYi Timer, Kamera Timer).
// A div, not a button: a focused button would take the spacebar that starts the timer
// and fire a connect or disconnect instead.
export default function ConnectTrigger({state, text, onClick, icon}: Props) {
	const busy = state === 'busy';
	const Icon = icon || Bluetooth;

	return (
		<div
			className={b({state, bare: !text})}
			onClick={busy ? undefined : onClick}
			role="button"
			aria-disabled={busy || undefined}
		>
			<Icon className={b('icon')} weight="bold" />
			{text && <span className={b('label')}>{text}</span>}
		</div>
	);
}
