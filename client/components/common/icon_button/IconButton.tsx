// The one square icon button: close (X), back, more, edit. Every modal, sheet and page
// header uses it, so "close" looks and sits the same in Battle, the trainer and the
// account pages. Before it existed there were 16 differently named close buttons and
// two back-arrow families (ArrowLeft and CaretLeft) side by side.

import React from 'react';
import {Link} from 'react-router-dom';
import {CaretLeft, X} from 'phosphor-react';
import {useTranslation} from 'react-i18next';
import './IconButton.scss';
import block from '../../../styles/bem';

const b = block('icon-button');

export interface IconButtonProps {
	icon: React.ReactElement;
	/** Spoken and shown as a tooltip. Required: an icon alone tells a screen reader nothing. */
	label: string;
	onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
	/** Navigate instead of acting. Renders a router Link. */
	to?: string;
	/** sm 32px for dense rows, md 40px everywhere else. */
	size?: 'sm' | 'md';
	/** filled: quiet control surface (default). ghost: no box until hovered. */
	variant?: 'filled' | 'ghost';
	disabled?: boolean;
	className?: string;
	type?: 'button' | 'submit';
}

export default function IconButton(props: IconButtonProps) {
	const {icon, label, onClick, to, size = 'md', variant = 'filled', disabled, className, type = 'button'} = props;
	const cls = b({size, variant}) + (className ? ' ' + className : '');

	if (to) {
		return (
			<Link to={to} className={cls} aria-label={label} title={label}>
				{icon}
			</Link>
		);
	}

	return (
		<button type={type} className={cls} onClick={onClick} disabled={disabled} aria-label={label} title={label}>
			{icon}
		</button>
	);
}

type PresetProps = Omit<IconButtonProps, 'icon' | 'label'> & {label?: string};

/** Close for a modal, sheet, banner or panel. A bare X: never a filled box behind it. */
export function CloseButton(props: PresetProps) {
	const {t} = useTranslation();
	return (
		<IconButton variant="ghost" {...props} label={props.label || t('common.close')} icon={<X weight="bold" />} />
	);
}

/** Back to the previous level. CaretLeft is the app's only back glyph, bare like close. */
export function BackButton(props: PresetProps) {
	const {t} = useTranslation();
	return (
		<IconButton
			variant="ghost"
			{...props}
			label={props.label || t('common.back')}
			icon={<CaretLeft weight="bold" />}
		/>
	);
}
