import React from 'react';
import './Admin.scss';
import block from '../../styles/bem';
import PageTitle from '../common/page_title/PageTitle';
import HorizontalNav from '../common/horizontal_nav/HorizontalNav';
import {useMe} from '../../util/hooks/useMe';

const b = block('admin');

const ALL_TABS = [
	{id: 'reports', link: '/admin/reports', value: 'Reports'},
	{id: 'users', link: '/admin/users', value: 'Users'},
	{id: 'announcements', link: '/admin/announcements', value: 'Duyurular'},
	{id: 'email', link: '/admin/email', value: 'Mail'},
	{id: 'algorithms', link: '/admin/algorithms', value: 'Algoritmalar'},
	{id: 'promo-codes', link: '/admin/promo-codes', value: 'Promo'},
	{id: 'site-config', link: '/admin/site-config', value: 'Site Yönetimi'},
	{id: 'competitions', link: '/admin/competitions', value: 'Yarışmalar'},
];

const COMPETITIONS_ONLY = ALL_TABS.filter((t) => t.id === 'competitions');

interface Props {
	path: string;
	children: React.ReactNode;
}

export default function Admin(props: Props) {
	const {path, children} = props;
	const page = path.split('/')[2];
	const me = useMe();

	const tabs = me?.admin ? ALL_TABS : COMPETITIONS_ONLY;

	return (
		<div className={b()}>
			<PageTitle pageName="Admin">
				<HorizontalNav tabId={page} tabs={tabs} />
			</PageTitle>
			{children}
		</div>
	);
}
