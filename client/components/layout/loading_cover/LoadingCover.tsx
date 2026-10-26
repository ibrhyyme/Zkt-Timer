import React, { useEffect } from 'react';
import './LoadingCover.scss';
import block from '../../../styles/bem';
import { getLocalStorage } from '../../../util/data/local_storage';
import CSS from 'csstype';
import { useTranslation } from 'react-i18next';
import { addEventListener, removeEventListener } from '../../../util/event_handler';

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
	const [loadedSolves, setLoadedSolves] = React.useState(0);

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

	// A boot that never finishes throws nothing, so without this the logo would
	// just spin forever. After the threshold the cover offers a way out.
	//
	// The countdown restarts on every progress event. A first launch on a large
	// account downloads tens of thousands of solves page by page and legitimately
	// runs for minutes; offering a retry button in the middle of that is actively
	// harmful, since retrying starts the download over from zero.
	useEffect(() => {
		if (fadeOut) return;

		let timer: ReturnType<typeof setTimeout>;

		const arm = () => {
			clearTimeout(timer);
			timer = setTimeout(() => setStuck(true), STUCK_THRESHOLD_MS);
		};

		const onProgress = (data: { loadedSolves: number }) => {
			setLoadedSolves(data?.loadedSolves ?? 0);
			// Progress means the boot is alive, so it is not stuck after all.
			setStuck(false);
			arm();
		};

		addEventListener('bootProgressEvent', onProgress);
		arm();

		return () => {
			clearTimeout(timer);
			removeEventListener('bootProgressEvent', onProgress);
		};
	}, [fadeOut]);

	return (
		<div
			style={style}
			className={b({
				fadeOut,
			})}
		>
			<span className="zt-logo spin" aria-label="Zkt Timer" style={{ width: '8rem', height: '8rem' }}>
				<img className="zt-logo__img zt-logo__img--dark" src="/public/images/zkt-logo.png" alt="" />
				<img className="zt-logo__img zt-logo__img--light" src="/public/images/zkt-logo-white.png" alt="" />
			</span>
			{!fadeOut && loadedSolves > 0 && !stuck && (
				// A restore in flight. Shown instead of the retry prompt so a user
				// watching a long first launch can see it is working, and is not
				// nudged into a reload that would start the download over.
				<div className={b('stuck')}>
					<div className={b('stuck-message')}>
						{t('common.boot_downloading_solves', { count: loadedSolves })}
					</div>
				</div>
			)}
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
