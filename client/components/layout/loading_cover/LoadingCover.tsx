import React, { useEffect } from 'react';
import './LoadingCover.scss';
import block from '../../../styles/bem';
import { getLocalStorage } from '../../../util/data/local_storage';
import CSS from 'csstype';
import { useTranslation } from 'react-i18next';
import * as Sentry from '@sentry/browser';

const b = block('loading-cover');

// How long the cover may spin before the user is offered a way out. Boot queries
// are capped well below this (see BOOT_QUERY_TIMEOUT_MS in init.ts), so reaching
// it means the chain stalled somewhere those caps do not cover. The boot is NOT
// cancelled here — it keeps running behind the message, because forcing the app
// open on a half-initialised settings DB fails worse than waiting.
const STUCK_THRESHOLD_MS = 30_000;

interface Props {
	fadeOut?: boolean;
}

export default function LoadingCover(props: Props) {
	const { fadeOut } = props;
	const { t } = useTranslation();

	const [style, setStyle] = React.useState<CSS.Properties>({});
	const [stuck, setStuck] = React.useState(false);

	useEffect(() => {
		if (fadeOut || typeof localStorage === 'undefined') return;

		const backgroundColor = getLocalStorage('background_color');
		const textColor = getLocalStorage('text_color');

		const newStyle: CSS.Properties = {};
		if (backgroundColor && backgroundColor.includes(',')) {
			newStyle.backgroundColor = `rgb(${backgroundColor})`;
		}
		if (textColor && textColor.includes(',')) {
			newStyle.color = `rgb(${textColor})`;
		}

		setStyle(newStyle);
	}, [typeof localStorage]);

	// A boot that never finishes used to be completely invisible: no exception is
	// thrown, so nothing reached Sentry and the only signal was a user writing in
	// to say the logo spins forever. Report it once so the real frequency of this
	// failure can be measured.
	useEffect(() => {
		if (fadeOut) return;

		const timer = setTimeout(() => {
			setStuck(true);
			try {
				Sentry.withScope((scope) => {
					scope.setLevel(Sentry.Severity.Warning);
					scope.setTag('boot_stage', 'loading_cover_stuck');
					scope.setExtra('threshold_ms', STUCK_THRESHOLD_MS);
					scope.setExtra('online', navigator.onLine);
					scope.setExtra('path', window.location.pathname);
					Sentry.captureMessage('[Boot] LoadingCover still visible after threshold');
				});
			} catch (e) {}
		}, STUCK_THRESHOLD_MS);

		return () => clearTimeout(timer);
	}, [fadeOut]);

	return (
		<div
			style={style}
			className={b({
				fadeOut,
			})}
		>
			<span className="cd-logo spin" aria-label="Zkt Timer" style={{ width: '8rem', height: '8rem' }}>
				<img className="cd-logo__img cd-logo__img--dark" src="/public/images/zkt-logo.png" alt="" />
				<img className="cd-logo__img cd-logo__img--light" src="/public/images/zkt-logo-white.png" alt="" />
			</span>
			{stuck && !fadeOut && (
				<div className={b('stuck')}>
					<div className={b('stuck-title')}>{t('common.boot_stuck_title')}</div>
					<div className={b('stuck-message')}>{t('common.boot_stuck_message')}</div>
					<button type="button" className={b('stuck-button')} onClick={() => window.location.reload()}>
						{t('common.boot_stuck_retry')}
					</button>
				</div>
			)}
		</div>
	);
}
