import React, {useContext} from 'react';
import {useTranslation} from 'react-i18next';
import HorizontalNav from '../../common/horizontal_nav/HorizontalNav';
import {useRouteMatch} from 'react-router-dom';
import {CommunityContext} from '../Community';
import block from '../../../styles/bem';
import Input from '../../common/inputs/input/Input';
import PageTitle from '../../common/page_title/PageTitle';
import {MagnifyingGlass} from 'phosphor-react';

const b = block('community');

export default function CommunityNav() {
	const {t} = useTranslation();
	const {userSearchQuery, setUserSearchQuery} = useContext(CommunityContext);

	const page = useRouteMatch().path.split('/')[2];

	const TABS = [
		{
			id: 'competitions',
			link: '/community/competitions',
			value: t('community_nav.competitions'),
		},
		{
			id: 'friends',
			link: '/community/friends/list',
			value: t('community_nav.friends'),
		},
	];

	function handleQueryChange(e) {
		setUserSearchQuery(e);
	}

	return (
		<div className={b('nav')}>
			<PageTitle pageName={t('community_nav.page_title')}>
				<div className={b('nav-list')}>
					<HorizontalNav tabId={page} tabs={TABS} />
					{page !== 'competitions' && (
						<div className={b('search-input')}>
							<Input
								icon={<MagnifyingGlass />}
								placeholder={t('community_nav.search_placeholder')}
								value={userSearchQuery}
								onChange={handleQueryChange}
							/>
						</div>
					)}
				</div>
			</PageTitle>
		</div>
	);
}
