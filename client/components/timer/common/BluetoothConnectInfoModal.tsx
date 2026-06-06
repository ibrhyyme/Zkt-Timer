import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Bluetooth, CaretDown, Copy, Check} from 'phosphor-react';
import block from '../../../styles/bem';
import './BluetoothConnectInfoModal.scss';

const b = block('ble-info');

const APP_STORE_IOS = 'https://apps.apple.com/us/app/zkt-timer/id6760920873';
const PLAY_STORE_ANDROID = 'https://play.google.com/store/apps/details?id=com.zktimer.app';
const FLAG_URL = 'chrome://flags/#enable-experimental-web-platform-features';

// Served statically from public/ — esbuild has no svg loader, so we reference by URL.
// Use the /public/ prefix to match the app-wide convention (landing badges, logos);
// the bare /images/... path is not reliably served in production.
const APP_STORE_BADGE = '/public/images/ble_info/app-store.svg';
const GOOGLE_PLAY_BADGE = '/public/images/ble_info/google-play.svg';

interface BluetoothConnectInfoModalProps {
	// Injected by Modal (cloneElement).
	onComplete?: () => void;
	onClose?: () => void;
}

export default function BluetoothConnectInfoModal({onComplete, onClose}: BluetoothConnectInfoModalProps) {
	const {t} = useTranslation();
	const [dontShow, setDontShow] = useState(false);
	const [copied, setCopied] = useState(false);
	const [troubleOpen, setTroubleOpen] = useState(false);

	// chrome:// URLs can't be opened from a link (browser security), so clicking copies
	// the flag path to the clipboard and the user pastes it into the address bar.
	function copyFlag() {
		try {
			navigator.clipboard?.writeText(FLAG_URL);
			setCopied(true);
			setTimeout(() => setCopied(false), 1600);
		} catch (_) {
			/* ignore */
		}
	}

	function connect() {
		if (dontShow) {
			try {
				localStorage.setItem('ble_info_dismissed', '1');
			} catch (_) {
				/* ignore */
			}
		}
		onComplete?.();
	}

	return (
		<div className={b()}>
			{/* Left accent panel — identity + context chips */}
			<aside className={b('aside')}>
				<div className={b('glyph')}>
					<Bluetooth size={40} weight="bold" />
				</div>
				<span className={b('aside-ring')} />
				<h3 className={b('aside-title')}>{t('smart_cube.ble_info_title')}</h3>
				<div className={b('chips')}>
					<span className={b('chip')}>Bluetooth</span>
					<span className={b('chip')}>Chromium</span>
					<span className={b('chip')}>chrome://flags</span>
				</div>
			</aside>

			{/* Right content — requirements, app download, actions */}
			<div className={b('main')}>
				<p className={b('lead')}>{t('smart_cube.ble_info_lead')}</p>

				<ol className={b('reqs')}>
					<li className={b('req')}>
						<span className={b('num')}>1</span>
						<div className={b('req-body')}>
							<span className={b('req-text')}>{t('smart_cube.ble_info_bluetooth_on')}</span>
						</div>
					</li>
					<li className={b('req')}>
						<span className={b('num')}>2</span>
						<div className={b('req-body')}>
							<span className={b('req-text')}>{t('smart_cube.ble_info_browser')}</span>
						</div>
					</li>
					<li className={b('req')}>
						<span className={b('num')}>3</span>
						<div className={b('req-body')}>
							<span className={b('req-text')}>{t('smart_cube.ble_info_chrome_flag_before')}</span>
							<button
								type="button"
								className={b('flaglink', {copied})}
								onClick={copyFlag}
								title={t('smart_cube.ble_info_copy_flag')}
							>
								<span className={b('flaglink-url')}>{FLAG_URL}</span>
								{copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
								{copied && (
									<span className={b('flaglink-hint')}>{t('smart_cube.ble_info_copied')}</span>
								)}
							</button>
							<span className={b('req-text')}>{t('smart_cube.ble_info_chrome_flag_after')}</span>

							{/* Native-looking Chrome flag row, rebuilt in the modal's own language */}
							<div className={b('flag')}>
								<div className={b('flag-info')}>
									<span className={b('flag-title')}>Experimental Web Platform features</span>
									<span className={b('flag-desc')}>
										Enables experimental Web Platform features that are in development. – Mac, Windows,
										Linux, ChromeOS, Android
									</span>
									<span className={b('flag-id')}>#enable-experimental-web-platform-features</span>
								</div>
								<span className={b('flag-select')} aria-hidden="true">
									{t('smart_cube.ble_info_flag_enabled')}
									<CaretDown size={12} weight="bold" />
								</span>
							</div>
						</div>
					</li>
				</ol>

				{/* Troubleshooting — collapsed by default so it doesn't bloat the modal */}
				<div className={b('trouble')}>
					<button
						type="button"
						className={b('trouble-toggle')}
						onClick={() => setTroubleOpen((v) => !v)}
						aria-expanded={troubleOpen}
					>
						<span>{t('smart_cube.ble_info_trouble_toggle')}</span>
						<CaretDown
							size={14}
							weight="bold"
							className={b('trouble-caret', {open: troubleOpen})}
						/>
					</button>
					{troubleOpen && (
						<div className={b('trouble-body')}>
							<div className={b('trouble-group')}>
								<span className={b('trouble-group-title')}>
									{t('smart_cube.ble_info_trouble_general_title')}
								</span>
								<ul className={b('trouble-list')}>
									<li className={b('trouble-item')}>{t('smart_cube.ble_info_trouble_general_1')}</li>
									<li className={b('trouble-item')}>{t('smart_cube.ble_info_trouble_general_2')}</li>
								</ul>
							</div>
							<div className={b('trouble-group')}>
								<span className={b('trouble-group-title')}>
									{t('smart_cube.ble_info_trouble_mac_title')}
								</span>
								<ul className={b('trouble-list')}>
									<li className={b('trouble-item')}>{t('smart_cube.ble_info_trouble_mac_1')}</li>
									<li className={b('trouble-item')}>{t('smart_cube.ble_info_trouble_mac_2')}</li>
									<li className={b('trouble-item')}>{t('smart_cube.ble_info_trouble_mac_3')}</li>
								</ul>
							</div>
						</div>
					)}
				</div>

				<div className={b('app')}>
					<span className={b('app-text')}>{t('smart_cube.ble_info_app_cta')}</span>
					<div className={b('badges')}>
						<a className={b('badge')} href={APP_STORE_IOS} target="_blank" rel="noopener noreferrer">
							<img src={APP_STORE_BADGE} alt={t('smart_cube.ble_info_app_store')} />
						</a>
						<a className={b('badge')} href={PLAY_STORE_ANDROID} target="_blank" rel="noopener noreferrer">
							<img src={GOOGLE_PLAY_BADGE} alt={t('smart_cube.ble_info_play_store')} />
						</a>
					</div>
				</div>

				<div className={b('footer')}>
					<label className={b('dont')}>
						<input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
						<span>{t('smart_cube.ble_info_dont_show')}</span>
					</label>
					<div className={b('actions')}>
						<button className={b('btn', {ghost: true})} type="button" onClick={() => onClose?.()}>
							{t('smart_cube.ble_info_cancel')}
						</button>
						<button className={b('btn', {primary: true})} type="button" onClick={connect}>
							{t('smart_cube.ble_info_connect')}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
