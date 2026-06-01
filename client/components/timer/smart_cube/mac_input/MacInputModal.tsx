import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Copy, Check} from 'phosphor-react';
import block from '../../../../styles/bem';
import './MacInputModal.scss';

const b = block('mac-input');

// Canonical MAC format used by every encrypted cube/timer: XX:XX:XX:XX:XX:XX (hex).
const MAC_REGEX = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/;

// Chrome's built-in BLE device page lists each device's address — easiest way on desktop.
const CHROME_INTERNALS = 'chrome://bluetooth-internals/#devices';

interface MacInputModalProps {
	defaultMac?: string | null;
	deviceName?: string;
	// Injected by Modal (cloneElement). onComplete carries the verified MAC string.
	onComplete?: (mac: string) => void;
	onClose?: () => void;
}

function normalizeMac(raw: string): string {
	return raw.trim().toUpperCase().replace(/-/g, ':');
}

export default function MacInputModal({defaultMac, deviceName, onComplete, onClose}: MacInputModalProps) {
	const {t} = useTranslation();
	const [value, setValue] = useState(defaultMac || '');
	const [copied, setCopied] = useState(false);

	// chrome:// pages can't be opened from a link (browser security), so clicking copies
	// the address and the user pastes it into the address bar.
	function copyAddr() {
		try {
			navigator.clipboard?.writeText(CHROME_INTERNALS);
			setCopied(true);
			setTimeout(() => setCopied(false), 1600);
		} catch (_) {
			/* ignore */
		}
	}

	const normalized = normalizeMac(value);
	const isValid = MAC_REGEX.test(normalized);
	const showError = value.trim().length > 0 && !isValid;

	function submit() {
		if (!isValid) return;
		onComplete?.(normalized);
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === 'Enter' && isValid) {
			submit();
		}
	}

	return (
		<div className={b()}>
			<h3 className={b('title')}>{t('smart_cube.mac_input_title')}</h3>
			<p className={b('intro')}>
				{deviceName
					? t('smart_cube.mac_input_intro_named', {device: deviceName})
					: t('smart_cube.mac_input_intro')}
			</p>

			<input
				className={b('field', {invalid: showError})}
				type="text"
				value={value}
				placeholder="XX:XX:XX:XX:XX:XX"
				spellCheck={false}
				autoCapitalize="characters"
				autoComplete="off"
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={handleKeyDown}
				autoFocus
			/>
			{showError && <span className={b('error')}>{t('smart_cube.mac_input_format_error')}</span>}

			<div className={b('help')}>
				<span className={b('help-title')}>{t('smart_cube.mac_input_help_title')}</span>
				<ul className={b('help-list')}>
					<li>{t('smart_cube.mac_input_help_windows')}</li>
					<li>{t('smart_cube.mac_input_help_macos')}</li>
					<li>{t('smart_cube.mac_input_help_android')}</li>
				</ul>

				<p className={b('chrome-hint')}>{t('smart_cube.mac_input_chrome_hint')}</p>
				<button
					type="button"
					className={b('chromelink', {copied})}
					onClick={copyAddr}
					title={t('smart_cube.ble_info_copy_flag')}
				>
					<span className={b('chromelink-url')}>{CHROME_INTERNALS}</span>
					{copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
					{copied && (
						<span className={b('chromelink-hint')}>{t('smart_cube.ble_info_copied')}</span>
					)}
				</button>
			</div>

			<div className={b('actions')}>
				<button className={b('btn', {ghost: true})} type="button" onClick={() => onClose?.()}>
					{t('smart_cube.mac_input_cancel')}
				</button>
				<button className={b('btn', {primary: true})} type="button" onClick={submit} disabled={!isValid}>
					{t('smart_cube.mac_input_connect')}
				</button>
			</div>
		</div>
	);
}
