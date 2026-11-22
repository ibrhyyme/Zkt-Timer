// Android browser visitors get the Play app offered in the strip slot above the page.
// It takes the signed-out strip's place while it shows (owner's choice, 2026-11-22):
// app users come back more often than web users, so the app comes first, and two
// stacked strips would eat the timer's height on a phone.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {X} from 'phosphor-react';
import '../anon/AnonBanner.scss';
import './AppBanner.scss';
import block from '../../../styles/bem';
import {isNative} from '../../../util/platform';
import {resourceUri} from '../../../util/storage';
import {PLAY_STORE_URL} from '../../../util/store-links';
import {getLocalStorage, setLocalStorage} from '../../../util/data/local_storage';
import {APP_BANNER_DISMISSED_KEY, parseDismissedAt, shouldOfferAndroidApp} from '../../../util/app-banner';
import {usePublishBannerHeight} from '../anon/usePublishBannerHeight';

// Same strip as AnonBanner (same slot, same look); only the icon is its own.
const b = block('anon-banner');
const own = block('app-banner');

export function useAndroidAppBanner() {
	// Decided after mount: the server cannot see the device, and rendering it during
	// hydration would differ from the server markup.
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		let dismissedAt: number | null = null;
		try {
			dismissedAt = parseDismissedAt(getLocalStorage(APP_BANNER_DISMISSED_KEY));
		} catch {}

		const standalone =
			(window.navigator as any).standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches;

		setVisible(
			shouldOfferAndroidApp({
				userAgent: window.navigator.userAgent,
				native: isNative(),
				standalone,
				dismissedAt,
				now: Date.now(),
			})
		);
	}, []);

	const dismiss = useCallback(() => {
		setVisible(false);
		try {
			setLocalStorage(APP_BANNER_DISMISSED_KEY, String(Date.now()));
		} catch {}
	}, []);

	return {visible, dismiss};
}

interface Props {
	onDismiss: () => void;
}

export default function AppBanner(props: Props) {
	const {onDismiss} = props;
	const {t} = useTranslation();
	const ref = useRef<HTMLDivElement>(null);

	usePublishBannerHeight(ref, true);

	return (
		<div className={`${b()} ${own()}`} ref={ref}>
			<img className={own('icon')} src={resourceUri('images/zkt-logo.png')} alt="" width={28} height={28} />
			<span className={b('text')}>{t('app_banner.text')}</span>
			<a href={PLAY_STORE_URL} className={b('cta')} target="_blank" rel="noopener noreferrer">
				Google Play
			</a>
			<button type="button" className={b('dismiss')} onClick={onDismiss} aria-label={t('anon.banner_dismiss')}>
				<X weight="bold" />
			</button>
		</div>
	);
}
