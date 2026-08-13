// Shared shell for every account settings block. Before this, each account page
// invented its own layout (inline styles, Tailwind utilities, bare divs), which is
// what made the section feel unorganised. New account content goes in one of these.

import React, {ReactNode} from 'react';
import './SettingsCard.scss';
import block from '../../../../styles/bem';

const b = block('settings-card');

interface Props {
	// Optional: blocks that draw their own heading (a service logo, for example) use
	// the card purely as a surface.
	title?: string;
	description?: string;
	icon?: ReactNode;
	// Red accent for destructive blocks (delete account, reset data).
	danger?: boolean;
	// Amber accent for blocks that need action but aren't destructive (pending email).
	warning?: boolean;
	// Pinned to the bottom of the card, separated by a rule — use for the submit button.
	footer?: ReactNode;
	children?: ReactNode;
}

export default function SettingsCard(props: Props) {
	const {title, description, icon, danger, warning, footer, children} = props;

	return (
		<section className={b({danger: !!danger, warning: !!warning})}>
			{title || icon ? (
				<header className={b('header')}>
					{icon ? <span className={b('icon')}>{icon}</span> : null}
					<div className={b('heading')}>
						{title ? <h2 className={b('title')}>{title}</h2> : null}
						{description ? <p className={b('description')}>{description}</p> : null}
					</div>
				</header>
			) : null}

			{children ? <div className={b('body')}>{children}</div> : null}

			{footer ? <footer className={b('footer')}>{footer}</footer> : null}
		</section>
	);
}
