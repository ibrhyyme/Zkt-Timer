import React, {ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {Crown, ArrowRight} from 'phosphor-react';
import block from '../../../styles/bem';
import Button from '../button/Button';
import './ProBlurOverlay.scss';

const b = block('pro-blur-overlay');

interface Props {
	title: string;
	description?: string;
	onBeforeNavigate?: () => void;
	minHeight?: number;
	// The same treatment gates two different things: Pro features (the default) and
	// pages that simply need an account. Only the icon, the button label and the
	// destination differ, so they share one component rather than two that drift apart.
	icon?: ReactNode;
	ctaLabel?: string;
	ctaTo?: string;
}

export default function ProBlurOverlay({
	title,
	description,
	onBeforeNavigate,
	minHeight,
	icon,
	ctaLabel,
	ctaTo,
}: Props) {
	const {t} = useTranslation();
	const history = useHistory();

	function handleClick() {
		if (onBeforeNavigate) onBeforeNavigate();
		history.push(ctaTo || '/pro');
	}

	const style = minHeight ? {minHeight: `${minHeight}px`} : undefined;

	// A flat card (owner, 2026-10-31). The blurred placeholder bars behind a frosted card,
	// the eyebrow label and the gradient pill are gone; the title already says what is
	// locked, the icon and the button say by what.
	return (
		<div className={b()} style={style}>
			<div className={b('card')}>
				<div className={b('icon')}>{icon || <Crown weight="fill" />}</div>
				<h3 className={b('title')}>{title}</h3>
				{description && <p className={b('description')}>{description}</p>}
				<div className={b('cta')}>
					<Button
						primary
						noMargin
						text={ctaLabel || t('pro.upgrade_button')}
						icon={<ArrowRight weight="bold" />}
						onClick={handleClick}
					/>
				</div>
			</div>
		</div>
	);
}
