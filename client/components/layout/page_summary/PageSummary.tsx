import React from 'react';
import {useTranslation} from 'react-i18next';
import {useBattleLaunch} from '../../battle/useBattleLaunch';
import {getSiteNavItems, isNoIndexPath, resolvePageSeo} from '../header/Header';
import {FALLBACK_LANGUAGE, matchSupportedLanguage} from '../../../../shared/i18n_language';
import {localizedPath} from '../../../../shared/seo_language';
import block from '../../../styles/bem';

// Styles live in LoadingCover.scss: this body only exists under that cover.

const b = block('page-summary');

interface Props {
	path: string;
}

/**
 * Plain-text body for an app page until the app has booted.
 *
 * The App shell renders only the LoadingCover on the server (the pages need the client
 * DB), so a crawler that runs no JavaScript (GPTBot, ClaudeBot, PerplexityBot) got an
 * empty body on /timer, /trainer, /competitions and the rest. This prints the page's
 * own title and description, the same strings as its <title> and meta description
 * (resolvePageSeo), plus the site's main sections as real links.
 *
 * It sits under the opaque LoadingCover and unmounts the moment the app is ready, so
 * people never see it. Server and first client render get the same path, language and
 * launch flag, so the markup hydrates without a mismatch. Pages without copy of their
 * own, and noindex pages, render nothing.
 */
export default function PageSummary({path}: Props) {
	const {t, i18n} = useTranslation();
	const launched = useBattleLaunch()?.launched ?? null;

	if (isNoIndexPath(path, launched)) return null;

	const {title, description} = resolvePageSeo(path, t, launched);
	if (!title) return null;

	const lang = matchSupportedLanguage(i18n.language) || FALLBACK_LANGUAGE;
	const links = [
		...getSiteNavItems(t, launched === true),
		{name: t('seo.nav_battle_name'), path: '/battle'},
		{name: t('seo.nav_pro_name'), path: '/pro'},
		{name: t('help.title'), path: '/help'},
	];

	return (
		<div className={b()}>
			<h1 className={b('title')}>{title}</h1>
			{description && <p className={b('description')}>{description}</p>}
			<nav>
				<ul className={b('links')}>
					{links.map((link) => (
						<li key={link.path}>
							<a href={localizedPath(link.path, lang)}>{link.name}</a>
						</li>
					))}
				</ul>
			</nav>
		</div>
	);
}
