import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Bluetooth, AppleLogo, GooglePlayLogo} from 'phosphor-react';
import block from '../../../styles/bem';
import './BluetoothConnectInfoModal.scss';

const b = block('ble-info');

const APP_STORE_IOS = 'https://apps.apple.com/us/app/zkt-timer/id6760920873';
const PLAY_STORE_ANDROID = 'https://play.google.com/store/apps/details?id=com.zktimer.app';

interface BluetoothConnectInfoModalProps {
	// Injected by Modal (cloneElement).
	onComplete?: () => void;
	onClose?: () => void;
}

export default function BluetoothConnectInfoModal({onComplete, onClose}: BluetoothConnectInfoModalProps) {
	const {t} = useTranslation();
	const [dontShow, setDontShow] = useState(false);

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
			<div className={b('icon')}>
				<Bluetooth size={34} weight="bold" />
			</div>
			<h3 className={b('title')}>{t('smart_cube.ble_info_title')}</h3>
			<p className={b('lead')}>{t('smart_cube.ble_info_lead')}</p>

			<ul className={b('list')}>
				<li>{t('smart_cube.ble_info_bluetooth_on')}</li>
				<li>{t('smart_cube.ble_info_browser')}</li>
				<li>{t('smart_cube.ble_info_chrome_flag')}</li>
			</ul>

			<div className={b('app')}>
				<span className={b('app-text')}>{t('smart_cube.ble_info_app_cta')}</span>
				<div className={b('app-buttons')}>
					<a className={b('store')} href={APP_STORE_IOS} target="_blank" rel="noopener noreferrer">
						<AppleLogo size={18} weight="fill" />
						{t('smart_cube.ble_info_app_store')}
					</a>
					<a className={b('store')} href={PLAY_STORE_ANDROID} target="_blank" rel="noopener noreferrer">
						<GooglePlayLogo size={18} weight="fill" />
						{t('smart_cube.ble_info_play_store')}
					</a>
				</div>
			</div>

			<label className={b('dontshow')}>
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
	);
}
