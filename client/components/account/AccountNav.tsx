import React from 'react';
import HorizontalNav from '../common/horizontal_nav/HorizontalNav';
import {useRouteMatch} from 'react-router-dom';
import PageTitle from '../common/page_title/PageTitle';
import block from '../../styles/bem';

const b = block('account-nav');

const TABS = [
	{
		id: 'personal-info',
		link: '/account/personal-info',
		value: 'Kişisel Bilgiler',
	},
	{
		id: 'password',
		link: '/account/password',
		value: 'Şifre',
	},
	{
		id: 'notifications',
		link: '/account/notifications',
		value: 'Bildirimler',
	},
	{
		id: 'linked-accounts',
		link: '/account/linked-accounts',
		value: 'Bağlı Hesaplar',
	},
	{
		id: 'announcements',
		link: '/account/announcements',
		value: 'Duyurular',
	},
	{
		id: 'danger-zone',
		link: '/account/danger-zone',
		value: 'Riskli Alan',
	},
];

export default function AccountNav() {
	const page = useRouteMatch().path.split('/').pop();

	return (
		<div className={b()}>
			<PageTitle pageName="Hesap">
				<HorizontalNav tabs={TABS} tabId={page} />
			</PageTitle>
		</div>
	);
}
