import React from 'react';
import {useTranslation} from 'react-i18next';
import {CalendarPlus, GoogleLogo, DownloadSimple, CaretRight} from 'phosphor-react';
import block from '../../../styles/bem';
import {getApiBase} from '../../../util/api-base';
import {isNative} from '../../../util/platform';
import {openInAppBrowser} from '../../../util/external-link';
import './AddToCalendar.scss';

const b = block('add-to-calendar');

interface Props {
	/** WCA competition id, or `zkt-<slug>` for a Zeka Kupu Turkiye competition. */
	competitionId: string;
}

/**
 * Calendar handoff sheet. Google Calendar cannot import an .ics URL, so its users
 * get a prefilled event screen instead of a download they would have to import by
 * hand. Everyone else gets the .ics file, which Apple Calendar and Outlook open
 * natively.
 */
export default function AddToCalendarModal(props: Props) {
	const {competitionId} = props;
	const {t, i18n} = useTranslation();

	const base = `${getApiBase()}/calendar/competition/${encodeURIComponent(competitionId)}`;
	const lang = `?lang=${encodeURIComponent(i18n.language || 'tr')}`;

	function openGoogle() {
		openInAppBrowser(`${base}/google${lang}`);
	}

	function openIcs() {
		const url = `${base}.ics${lang}`;

		if (isNative()) {
			// Must leave the app WebView. Capacitor sets no DownloadListener and
			// `allowNavigation: ['zktimer.app']` keeps main-frame navigation inside
			// the WebView, so an attachment loaded there would do nothing at all.
			// The Browser plugin hands the URL to a Chrome Custom Tab (Android) or
			// SFSafariViewController (iOS), which own a real download stack.
			openInAppBrowser(url);
			return;
		}

		// Served as an attachment, so the page itself does not navigate away.
		window.location.href = url;
	}

	return (
		<div className={b()}>
			<div className={b('icon')}>
				<CalendarPlus weight="fill" />
			</div>

			<h2 className={b('title')}>{t('add_to_calendar.title')}</h2>

			<div className={b('options')}>
				<button type="button" className={b('option')} onClick={openGoogle}>
					<span className={b('option-icon')}>
						<GoogleLogo weight="bold" />
					</span>
					<span className={b('option-text')}>
						<span className={b('option-name')}>{t('add_to_calendar.google')}</span>
						<span className={b('option-hint')}>{t('add_to_calendar.google_hint')}</span>
					</span>
					<CaretRight weight="bold" className={b('option-caret')} />
				</button>

				<button type="button" className={b('option')} onClick={openIcs}>
					<span className={b('option-icon')}>
						<DownloadSimple weight="bold" />
					</span>
					<span className={b('option-text')}>
						<span className={b('option-name')}>{t('add_to_calendar.ics')}</span>
						<span className={b('option-hint')}>{t('add_to_calendar.ics_hint')}</span>
					</span>
					<CaretRight weight="bold" className={b('option-caret')} />
				</button>
			</div>

			{/* Round times slip all day long at a real competition. Promising them in
			    someone's calendar is worse than not putting them there at all. */}
			<p className={b('note')}>{t('add_to_calendar.note')}</p>
		</div>
	);
}
