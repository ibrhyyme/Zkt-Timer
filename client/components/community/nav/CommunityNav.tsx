import React from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import PageTitle from '../../common/page_title/PageTitle';

const b = block('community');

export default function CommunityNav() {
	const {t} = useTranslation();

	return (
		<div className={b('nav')}>
			<PageTitle pageName={t('community_nav.page_title')} />
		</div>
	);
}
