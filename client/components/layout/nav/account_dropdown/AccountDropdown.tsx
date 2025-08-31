import React from 'react';
import './AccountDropdown.scss';
import block from '../../../../styles/bem';
import AvatarImage from '../../../common/avatar/avatar_image/AvatarImage';
import Dropdown from '../../../common/inputs/dropdown/Dropdown';
import {IDropdownOption} from '../../../common/inputs/dropdown/dropdown_option/DropdownOption';
import {logOut} from '../../../../util/auth/logout';
import {useMe} from '../../../../util/hooks/useMe';
import {useDispatch} from 'react-redux';
import {setGeneral} from '../../../../actions/general';

const b = block('nav-account-dropdown');

export default function AccountDropdown() {
	const me = useMe();
	const dispatch = useDispatch();

	if (!me) {
		return null;
	}

	function openSettingsModal() {
		dispatch(setGeneral('settings_modal_open', true));
	}

	const aviDropDownOptions: IDropdownOption[] = [];

	aviDropDownOptions.push({link: '/account/personal-info', text: 'Hesap'});
	aviDropDownOptions.push({link: `/user/${me.username}`, text: 'Profil'});
	if (me.admin) {
		aviDropDownOptions.push({link: '/admin/reports', text: 'Yönetici'});
	}
	aviDropDownOptions.push({onClick: logOut, text: 'Çıkış Yap'});

	return (
		<div className={b()}>
			<Dropdown
				openLeft
				noMargin
				options={aviDropDownOptions}
				handle={
					<div className={b('pfp')}>
						<AvatarImage user={me} profile={me.profile} />
					</div>
				}
			/>
		</div>
	);
}
