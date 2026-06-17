// Avatar dropdown — Radix Popover + FancyDropdown estetigi.
// Mevcut Dropdown (legacy) yerine fancy panel: blur + soft border + stagger entrance,
// hover sol-stripe + translateX, Pro item icin koyu mor glow korunur.

import React, { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useHistory } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Gear, Crown, Trophy, User, IdentificationCard, ShieldStar, SignOut } from 'phosphor-react';
import block from '../../../../styles/bem';
import AvatarImage from '../../../common/avatar/avatar_image/AvatarImage';
import { logOut } from '../../../../util/auth/logout';
import { useMe } from '../../../../util/hooks/useMe';
import { useGeneral } from '../../../../util/hooks/useGeneral';
import { setGeneral } from '../../../../actions/general';
import { isPro } from '../../../../lib/pro';
import './AccountDropdown.scss';

const b = block('nav-account-dropdown');

interface Item {
	key: string;
	label: string;
	icon?: React.ReactNode;
	link?: string;
	onClick?: () => void;
	pro?: boolean;
}

export default function AccountDropdown() {
	const me = useMe();
	const history = useHistory();
	const dispatch = useDispatch();
	const { t } = useTranslation();
	const mobileMode = useGeneral('mobile_mode');
	const [open, setOpen] = useState(false);

	// Timer baslarsa paneli kapat (header dropdown'lariyla ayni davranis)
	useEffect(() => {
		if (!open) return;
		const close = () => setOpen(false);
		window.addEventListener('timerInteractionStart', close);
		return () => window.removeEventListener('timerInteractionStart', close);
	}, [open]);

	if (!me) {
		return null;
	}

	function openSettings() {
		dispatch(setGeneral('settings_modal_open', true));
	}

	const userIsPro = isPro(me);
	const items: Item[] = [];

	// Mobile'da Profile sag drawer'da bulunuyor, burada gizli
	if (!mobileMode) {
		items.push({
			key: 'profile',
			label: t('account_dropdown.profile'),
			icon: <User weight="bold" />,
			link: `/user/${me.username}`,
		});
	}
	items.push({
		key: 'pro',
		label: userIsPro ? t('account_dropdown.pro_subscription') : t('account_dropdown.pro_subscription_cta'),
		icon: <Crown weight="fill" />,
		link: '/pro',
		pro: !userIsPro,
	});
	items.push({
		key: 'account',
		label: t('account_dropdown.account'),
		icon: <IdentificationCard weight="bold" />,
		link: '/account/personal-info',
	});
	items.push({
		key: 'settings',
		label: t('account_dropdown.general_settings'),
		icon: <Gear weight="bold" />,
		onClick: openSettings,
	});
	if (me.admin) {
		items.push({
			key: 'admin',
			label: t('account_dropdown.admin'),
			icon: <ShieldStar weight="fill" />,
			link: '/admin/dashboard',
		});
	}
	// Competition management — admins and mods (mod = competition manager).
	if (me.admin || me.mod) {
		items.push({
			key: 'organizer',
			label: t('account_dropdown.competition_management'),
			icon: <Trophy weight="fill" />,
			link: '/organizer',
		});
	}
	items.push({
		key: 'logout',
		label: t('account_dropdown.logout'),
		icon: <SignOut weight="bold" />,
		onClick: logOut,
	});

	function handleItemClick(item: Item) {
		setOpen(false);
		if (item.onClick) {
			item.onClick();
		} else if (item.link) {
			history.push(item.link);
		}
	}

	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			<Popover.Trigger asChild>
				<button type="button" className={b('handle')}>
					<div className={b('pfp')}>
						<AvatarImage user={me} profile={me.profile} />
					</div>
					<span className={b('username', { mobile: 'hide' })}>{me.username}</span>
				</button>
			</Popover.Trigger>

			<Popover.Portal>
				<Popover.Content
					className={b('panel')}
					align="end"
					sideOffset={8}
					collisionPadding={12}
				>
					<div className={b('options')}>
						{items.map((item, i) => (
							<button
								key={item.key}
								type="button"
								className={b('option', { pro: !!item.pro })}
								style={{ animationDelay: `${30 + i * 25}ms` }}
								onClick={() => handleItemClick(item)}
							>
								{item.icon && <span className={b('option-icon')}>{item.icon}</span>}
								<span className={b('option-label')}>{item.label}</span>
							</button>
						))}
					</div>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}
