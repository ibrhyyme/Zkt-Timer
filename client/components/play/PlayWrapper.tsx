import React, { ReactElement } from 'react';
import PageTitle from '../common/page_title/PageTitle';
import Header from '../layout/header/Header';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Props {
	children: ReactElement;
}

export default function PlayWrapper(props: Props) {
	const { children } = props;
	const location = useLocation();
	const { t } = useTranslation();

	return (
		<div>
			<Header title="Zkt-Timer | Canlı Mücadele Odaları" path={location.pathname} />
			<PageTitle pageName={t('play.page_title')} />
			{children}
		</div>
	);
}
