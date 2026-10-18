/**
 * TrainerModeHeader: the header every trainer page shares (the Trainers page's trainers and the
 * Algorithm Sets section). A breadcrumb bar: a round back button, then the path from the hub to
 * this page ("Trainers / Algorithm Trainer / PLL"). Earlier crumbs are links, the last one is the
 * current page in bold. On a phone only the last crumb shows next to the back button.
 *
 * The crumb carrying `icon` gets the coloured icon of the hub card the user tapped, so the colour
 * carries over ("this is the card"). Accent colours are CSS variables from TrainerAccents.scss.
 * The bar itself has no box: page background and a hairline, the type carries it.
 *
 * Center: a slot (study mode switch, efficiency type picker). Right: actions (borderless icon
 * buttons, `__btn`; filled `__cta` / `__ble` for the one primary action).
 */
import React, {ReactNode} from 'react';
import {Timer, Lightning, Eye, Target, CaretLeft, CaretRight, Stack} from 'phosphor-react';
import type {TFunction} from 'i18next';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import './TrainerAccents.scss';
import './TrainerModeHeader.scss';
import type {TrainerMode} from '../types';

const b = block('trainer-header');

type AccentColor = 'blue' | 'purple' | 'green' | 'orange' | 'red';

/** A trainer, or the Algorithm Sets section. */
export type TrainerHeaderKind = TrainerMode | 'sets';

const KIND_META: Record<TrainerHeaderKind, {Icon: typeof Timer; color: AccentColor; titleKey: string}> = {
	standard: {Icon: Timer, color: 'blue', titleKey: 'trainer.mode_header.algorithms'},
	smart: {Icon: Timer, color: 'blue', titleKey: 'trainer.mode_header.algorithms'},
	efficiency: {Icon: Lightning, color: 'green', titleKey: 'trainer.landing_efficiency_title'},
	recognition: {Icon: Eye, color: 'orange', titleKey: 'trainer.landing_recognition_title'},
	ollcp: {Icon: Target, color: 'red', titleKey: 'trainer.landing_ollcp_title'},
	sets: {Icon: Stack, color: 'purple', titleKey: 'trainer.hub.sets_title'},
};

export interface TrainerCrumb {
	label: string;
	/** Earlier crumbs are links; the last one is the current page and ignores this. */
	onClick?: () => void;
	/** Draw the trainer's coloured icon before this crumb. */
	icon?: boolean;
}

/** "Trainers" crumb, back to the Trainers page. */
export function trainersCrumb(t: TFunction, onClick: () => void): TrainerCrumb {
	return {label: t('trainer.hub.trainers_title'), onClick};
}

/** The trainer's (or the sets section's) own crumb, with its icon. */
export function kindCrumb(t: TFunction, kind: TrainerHeaderKind, onClick?: () => void): TrainerCrumb {
	return {label: t(KIND_META[kind].titleKey), onClick, icon: true};
}

interface Props {
	/** Whose icon a crumb with `icon` gets; none on the hub pages. */
	kind?: TrainerHeaderKind;
	onBack: () => void;
	/** Path from the hub to this page; the last crumb is the current page. */
	trail: TrainerCrumb[];
	/** Slot between the trail and the actions (study mode switch, efficiency type picker). */
	center?: ReactNode;
	actions?: ReactNode;
}

export default function TrainerModeHeader(props: Props) {
	const {kind, onBack, trail, center, actions} = props;
	const {t} = useTranslation();
	const meta = kind ? KIND_META[kind] : null;
	const last = trail.length - 1;

	return (
		<div className={b()}>
			<div className={b('left')}>
				<button type="button" className={b('back')} onClick={onBack} aria-label={t('trainer.back')}>
					<CaretLeft size={18} weight="bold" />
				</button>
				<nav className={b('trail')} aria-label={t('trainer.hub.breadcrumb')}>
					{trail.map((crumb, i) => {
						const current = i === last;
						const icon = crumb.icon && meta ? (
							<span className={b('icon', {[meta.color]: true})} aria-hidden="true">
								<meta.Icon size={current ? 18 : 15} weight="duotone" />
							</span>
						) : null;
						return (
							<React.Fragment key={i}>
								{i > 0 ? (
									<span className={b('sep')} aria-hidden="true">
										<CaretRight size={12} weight="bold" />
									</span>
								) : null}
								{current ? (
									<span className={b('crumb', {current: true})} aria-current="page" title={crumb.label}>
										{icon}
										<span className={b('crumb-text')}>{crumb.label}</span>
									</span>
								) : (
									<button type="button" className={b('crumb', {link: true})} onClick={crumb.onClick}>
										{icon}
										<span className={b('crumb-text')}>{crumb.label}</span>
									</button>
								)}
							</React.Fragment>
						);
					})}
				</nav>
			</div>
			{center ? <div className={b('center')}>{center}</div> : null}
			{actions ? <div className={b('actions')}>{actions}</div> : null}
		</div>
	);
}
