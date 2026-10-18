import React from 'react';
import './Account.scss';
import {useTranslation} from 'react-i18next';
import {useLocation} from 'react-router-dom';
import {BackButton} from '../common/icon_button/IconButton';
import AccountNav, {useAccountTabs} from './AccountNav';
import PageTitle from '../common/page_title/PageTitle';
import block from '../../styles/bem';
import OfflineGuard from '../common/offline_guard/OfflineGuard';

const b = block('account');

interface Props {
	children: React.ReactNode;
}

export default function Account(props: Props) {
	const {t} = useTranslation();
	const {pathname} = useLocation();
	const tabs = useAccountTabs();

	// `/account` is the mobile index: the nav list fills the screen and the section
	// content is hidden by CSS. Desktop shows nav and content side by side at every
	// path, so the same markup serves both — no viewport branching in JS, which would
	// desync during SSR hydration.
	const isIndex = pathname === '/account';
	const activeTab = tabs.find((tab) => tab.link === pathname);

	return (
		<div className={b({index: isIndex})}>
			<PageTitle pageName={t('account_nav.page_title')} />

			<div className={b('layout')}>
				<AccountNav />

				<div className={b('content')}>
					{/* Mobile drill-down header. Hidden on desktop, where the sidebar already
					    shows both where you are and how to get back. */}
					{activeTab ? (
						<div className={b('section-header')}>
							<BackButton
								to="/account"
								className={b('back')}
								label={t('account_nav.back_to_account')}
							/>
							<h2 className={b('section-title')}>{activeTab.label}</h2>
						</div>
					) : null}

					<OfflineGuard>{props.children}</OfflineGuard>
				</div>
			</div>
		</div>
	);
}
