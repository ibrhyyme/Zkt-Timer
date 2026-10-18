/**
 * LandingCard: one card of the hub or the Trainers page, on desktop (grid) and on the phone
 * (CardStack). The whole card is the click target; the button at the bottom is its visible
 * target. `collapsed`: only the head (top row, name, description), for a card another card in
 * the phone stack covers. Styles in TrainerLanding.scss.
 */
import React from 'react';
import {Check, Cube} from 'phosphor-react';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import type {CardView} from './card_view';

const b = block('trainer');

interface Props {
	card: CardView;
	collapsed?: boolean;
	className?: string;
	style?: React.CSSProperties;
}

export default function LandingCard({card, collapsed = false, className, style}: Props) {
	const {t} = useTranslation();
	const cls = b('landing-card', {[card.accent]: true, collapsed, disabled: !!card.disabled}).toString();
	const open = card.disabled ? undefined : card.onSelect;
	return (
		<div
			className={className ? `${cls} ${className}` : cls}
			style={style}
			onClick={open}
			role="button"
			tabIndex={card.disabled ? -1 : 0}
			aria-disabled={card.disabled || undefined}
			onKeyDown={(e) => e.key === 'Enter' && open?.()}
		>
			<span className={b('landing-card-watermark')} aria-hidden="true">
				<Cube size={150} weight="thin" />
			</span>

			<div className={b('landing-card-eyebrow-row')}>
				<span className={b('landing-card-eyebrow')}>{card.eyebrow || null}</span>
				<span className={b('landing-card-icon')}>
					<card.Icon size={24} />
				</span>
			</div>

			<h2 className={b('landing-card-name')}>{card.title}</h2>
			<p className={b('landing-card-desc')}>{card.desc}</p>

			{!collapsed && card.items.length ? (
				<div className={b('landing-card-groups')}>
					<div className={b('landing-card-group')}>
						{card.groupLabel ? <span className={b('landing-card-group-label')}>{card.groupLabel}</span> : null}
						<div className={b('landing-card-features')}>
							{card.items.map((item) => (
								<div key={item.text} className={b('landing-card-feature')}>
									<span className={b('landing-card-check', {[item.accent || '']: !!item.accent})}>
										{item.Icon ? <item.Icon size={16} weight="duotone" /> : <Check size={15} weight="bold" />}
									</span>
									<span className={b('landing-card-feature-text')}>
										{item.text}
										{item.pro ? <span className={b('landing-card-pro')}>{t('trainer.study_mode.pro')}</span> : null}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>
			) : null}

			{!collapsed && card.footer ? <div className={b('landing-card-footer')}>{card.footer}</div> : null}

			{collapsed || card.disabled ? null : (
				<button type="button" className={b('landing-card-cta')} tabIndex={-1}>
					{card.ctaLabel || card.title}
				</button>
			)}
		</div>
	);
}
