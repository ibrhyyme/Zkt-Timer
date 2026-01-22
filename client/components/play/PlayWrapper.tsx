import React, { ReactElement } from 'react';
import PageTitle from '../common/page_title/PageTitle';
import Header from '../layout/header/Header';
import { useLocation } from 'react-router-dom';

interface Props {
	children: ReactElement;
}

export default function PlayWrapper(props: Props) {
	const { children } = props;
	const location = useLocation();

	return (
		<div>
			<Header title="Zkt-Timer | Canlı Mücadele Odaları" path={location.pathname} />
			<PageTitle pageName="Mücadele" />
			{children}
		</div>
	);
}
