import React from 'react';
import './Account.scss';
import {useTranslation} from 'react-i18next';
import {Link, useLocation} from 'react-router-dom';
import {CaretLeft} from 'phosphor-react';
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

	// The section's cube-face colour lights the page behind the content, so moving
	// between sections changes the room you're standing in rather than just the text.
	const activeTone = activeTab ? activeTab.tone : tabs[0].tone;

	return (
		<div
			className={b({index: isIndex})}
			style={{'--active-tone': activeTone} as React.CSSProperties}
		>
			<PageTitle pageName={t('account_nav.page_title')} />

			<div className={b('layout')}>
				<AccountNav />

				<div className={b('content')}>
					{/* Mobile drill-down header. Hidden on desktop, where the sidebar already
					    shows both where you are and how to get back. */}
					{activeTab ? (
						<div className={b('section-header')}>
							<Link
								to="/account"
								className={b('back')}
								aria-label={t('account_nav.back_to_account')}
							>
								<CaretLeft weight="bold" />
							</Link>
							<h2 className={b('section-title')}>{activeTab.label}</h2>
						</div>
					) : null}

					<OfflineGuard>{props.children}</OfflineGuard>
				</div>
			</div>
		</div>
	);
}
