import React from 'react';
import './AccountDropdown.scss';
import block from '../../../../styles/bem';
import AvatarImage from '../../../common/avatar/avatar_image/AvatarImage';
import Dropdown from '../../../common/inputs/dropdown/Dropdown';
import { IDropdownOption } from '../../../common/inputs/dropdown/dropdown_option/DropdownOption';
import { logOut } from '../../../../util/auth/logout';
import { useMe } from '../../../../util/hooks/useMe';
import { useDispatch } from 'react-redux';
import { setGeneral } from '../../../../actions/general';
import { Gear, Crown } from 'phosphor-react';
import { useTranslation } from 'react-i18next';
import { useGeneral } from '../../../../util/hooks/useGeneral';
import { isPro } from '../../../../lib/pro';

const b = block('nav-account-dropdown');

export default function AccountDropdown() {
	const me = useMe();
	const dispatch = useDispatch();
	const { t } = useTranslation();
	const mobileMode = useGeneral('mobile_mode');

	if (!me) {
		return null;
	}

	function openSettings() {
		dispatch(setGeneral('settings_modal_open', true));
	}

	const userIsPro = isPro(me);
	const aviDropDownOptions: IDropdownOption[] = [];

	if (!mobileMode) {
		aviDropDownOptions.push({ link: `/user/${me.username}`, text: t('account_dropdown.profile') });
	}
	aviDropDownOptions.push({
		link: '/pro',
		text: userIsPro ? t('account_dropdown.pro_subscription') : t('account_dropdown.pro_subscription_cta'),
		icon: userIsPro ? undefined : <Crown weight="fill" />,
		className: userIsPro ? undefined : b('pro-item'),
	});
	aviDropDownOptions.push({ link: '/account/personal-info', text: t('account_dropdown.account') });
	aviDropDownOptions.push({ onClick: openSettings, text: t('account_dropdown.general_settings'), icon: <Gear weight="bold" /> });

	if (me.admin) {
		aviDropDownOptions.push({ link: '/admin/reports', text: t('account_dropdown.admin') });
	}
	aviDropDownOptions.push({ onClick: logOut, text: t('account_dropdown.logout') });

	return (
		<div className={b()}>
			<Dropdown
				noMargin
				options={aviDropDownOptions}
				handle={
					<div className={b('handle')}>
						<div className={b('pfp')}>
							<AvatarImage user={me} profile={me.profile} />
						</div>
						<span className={b('username', { mobile: 'hide' })}>{me.username}</span>
					</div>
				}
			/>
		</div>
	);
}
