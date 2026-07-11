import React, {ReactNode, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {WifiSlash, ArrowLeft} from 'phosphor-react';
import block from '../../../styles/bem';
import {useOnlineStatus} from '../../../util/hooks/useOnlineStatus';
import './OfflineGuard.scss';

const b = block('offline-guard');

interface Props {
	children: ReactNode;
}

/**
 * Wraps server-dependent pages (rooms, competitions, profile, pro, account...):
 * entering them offline shows a friendly notice instead of a blank screen; when
 * connectivity returns the page renders (and fetches) fresh. Local-first pages
 * (timer, sessions, stats, battle, trainer) must NOT be wrapped.
 *
 * Once the page has rendered, a later connectivity drop does NOT unmount it:
 * yanking a live room or a half-filled form on a network blip loses state the
 * page's own error handling (socket reconnect, failed-save toasts) deals with.
 */
export default function OfflineGuard({children}: Props) {
	const {t} = useTranslation();
	const history = useHistory();
	const online = useOnlineStatus();
	const renderedRef = useRef(false);

	if (online || renderedRef.current) {
		renderedRef.current = true;
		return <>{children}</>;
	}

	return (
		<div className={b()}>
			<div className={b('content')}>
				<div className={b('signal')}>
					<span className={b('ring')} />
					<span className={b('ring')} />
					<span className={b('ring')} />
					<div className={b('icon-wrapper')}>
						<WifiSlash size={44} weight="fill" className={b('icon')} />
					</div>
				</div>
				<h2 className={b('title')}>{t('offline.page_title')}</h2>
				<p className={b('description')}>{t('offline.page_description')}</p>
				<div className={b('progress')}>
					<span className={b('progress-fill')} />
				</div>
				<button className={b('back-btn')} onClick={() => history.push('/timer')}>
					<ArrowLeft size={16} />
					{t('site_config.go_to_timer')}
				</button>
			</div>
		</div>
	);
}
