import React from 'react';
import { getStore } from '../../store';
import { openModal } from '../../../actions/general';
import { isNative } from '../../../util/platform';
import BluetoothConnectInfoModal from './BluetoothConnectInfoModal';

/**
 * Web-only pre-connection info screen (browser/Chrome-flag guidance + app download links).
 * Resolves true if the user proceeds, false if they cancel. On native — or once the user
 * ticked "don't show again" — it resolves true immediately without showing anything.
 */
export function showBleConnectInfo(): Promise<boolean> {
	return new Promise((resolve) => {
		if (typeof window === 'undefined' || isNative()) {
			resolve(true);
			return;
		}

		let dismissed = false;
		try {
			dismissed = localStorage.getItem('ble_info_dismissed') === '1';
		} catch (_) {
			/* ignore */
		}
		if (dismissed) {
			resolve(true);
			return;
		}

		const store = getStore();
		let settled = false;
		const finish = (proceed: boolean) => {
			if (settled) return;
			settled = true;
			resolve(proceed);
		};

		store.dispatch(
			openModal(React.createElement(BluetoothConnectInfoModal), {
				width: 480,
				hideCloseButton: true,
				// Modal injects onComplete/onClose into BluetoothConnectInfoModal.
				onComplete: () => finish(true),
				onClose: () => finish(false),
			})
		);
	});
}
