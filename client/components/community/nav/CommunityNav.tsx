import React from 'react';
import {useTranslation} from 'react-i18next';
import {useLocation} from 'react-router-dom';
import block from '../../../styles/bem';
import PageTitle from '../../common/page_title/PageTitle';

const b = block('community');

export default function CommunityNav() {
	const {t} = useTranslation();
	const {pathname} = useLocation();
	// A content page shows its title on a computer too. A competition's own
	// pages do not: their back link stands in its place (a title and a
	// breadcrumb never both).
	const isList = /^\/competitions\/?$/.test(pathname);

	return (
		<div className={b('nav', {list: isList})}>
			<PageTitle desktop={isList} pageName={t('community_nav.page_title')} />
		</div>
	);
}
