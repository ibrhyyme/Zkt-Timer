import React from 'react';
import {useTranslation} from 'react-i18next';
import HorizontalNav from '../common/horizontal_nav/HorizontalNav';
import {useRouteMatch} from 'react-router-dom';
import PageTitle from '../common/page_title/PageTitle';
import block from '../../styles/bem';

const b = block('account-nav');

export default function AccountNav() {
	const {t} = useTranslation();
	const page = useRouteMatch().path.split('/').pop();

	const TABS = [
		{
			id: 'personal-info',
			link: '/account/personal-info',
			value: t('account_nav.personal_info'),
		},
		{
			id: 'password',
			link: '/account/password',
			value: t('account_nav.password'),
		},
		{
			id: 'notifications',
			link: '/account/notifications',
			value: t('account_nav.notifications'),
		},
		{
			id: 'linked-accounts',
			link: '/account/linked-accounts',
			value: t('account_nav.linked_accounts'),
		},
		{
			id: 'announcements',
			link: '/account/announcements',
			value: t('account_nav.announcements'),
		},
		{
			id: 'danger-zone',
			link: '/account/danger-zone',
			value: t('account_nav.danger_zone'),
		},
	];

	return (
		<div className={b()}>
			<PageTitle pageName={t('account_nav.page_title')}>
				<HorizontalNav tabs={TABS} tabId={page} />
			</PageTitle>
		</div>
	);
}
