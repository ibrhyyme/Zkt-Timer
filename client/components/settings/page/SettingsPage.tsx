// The settings shell. Replaces the old modal, which put all seven sections in one
// scroll and branched on window.innerWidth in JS, so `/settings` never survived in
// the URL and nothing could be linked to.
//
// Built on the Account page's pattern: real routes per section, one markup for both
// layouts, and the mobile drill-in done entirely in CSS.

import React, {useRef, useState} from 'react';
import './SettingsPage.scss';
import {useTranslation} from 'react-i18next';
import {useLocation} from 'react-router-dom';
import {MagnifyingGlass} from 'phosphor-react';
import {BackButton} from '../../common/icon_button/IconButton';
import SettingsNav, {useSettingsTabs} from './SettingsNav';
import SettingsSearchResults from './SettingsSearchResults';
import SettingsGroupTabs from './SettingsGroupTabs';
import PageTitle from '../../common/page_title/PageTitle';
import block from '../../../styles/bem';

const b = block('settings-page');

interface Props {
	children: React.ReactNode;
}

export default function SettingsPage(props: Props) {
	const {t} = useTranslation();
	const {pathname} = useLocation();
	const tabs = useSettingsTabs();
	const [query, setQuery] = useState('');
	const contentRef = useRef<HTMLDivElement>(null);

	const trimmedQuery = query.trim();

	// `/settings` is the mobile index: the nav list fills the screen and the section
	// content is hidden by CSS. Desktop shows nav and content side by side at every
	// path, so the same markup serves both — no viewport branching in JS, which would
	// desync during SSR hydration.
	const isIndex = pathname === '/settings';
	const activeTab = tabs.find((tab) => tab.link === pathname);

	return (
		<div className={b({index: isIndex && !trimmedQuery})}>
			<PageTitle pageName={t('settings.page_title')} />

			<div className={b('sheet')}>
				<header className={b('band')}>
					<h1 className={b('title')}>{t('settings.page_title')}</h1>
					<div className={b('search')}>
						<MagnifyingGlass size={16} className={b('search-icon')} />
						<input
							type="search"
							className={b('search-input')}
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder={t('settings.search_placeholder')}
							aria-label={t('settings.search_placeholder')}
						/>
					</div>
				</header>

				<div className={b('layout', {searching: !!trimmedQuery})}>
					{/* While searching the section list is dead weight: the results on the right
					    already span every section, and a nav of places you are not looking at
					    only misleads. */}
					{trimmedQuery ? null : (
						<div className={b('rail')}>
							<SettingsNav />
						</div>
					)}

					<div className={b('content')} ref={contentRef}>
						{trimmedQuery ? (
							<div className={b('section')}>
								<SettingsSearchResults query={trimmedQuery} />
							</div>
						) : (
							<>
								{/* Mobile drill-down header. Hidden on desktop, where the sidebar
								    already shows both where you are and how to get back. */}
								{activeTab ? (
									<div className={b('section-header')}>
										<BackButton
											to="/settings"
											className={b('back')}
											label={t('settings.back_to_settings')}
										/>
										<h2 className={b('section-title')}>{activeTab.label}</h2>
									</div>
								) : null}

								<div className={b('tabs')}>
									<SettingsGroupTabs contentRef={contentRef} label={t('settings.page_title')} />
								</div>

								<div className={b('section')}>{props.children}</div>
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
