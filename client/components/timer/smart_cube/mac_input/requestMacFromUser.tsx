import React from 'react';
import {getStore} from '../../../store';
import {openModal} from '../../../../actions/general';
import MacInputModal from './MacInputModal';

interface RequestMacOptions {
	defaultMac?: string | null;
	deviceName?: string;
}

/**
 * Async replacement for window.prompt() when an encrypted cube/timer needs its MAC.
 * Opens MacInputModal and resolves with the normalized MAC (XX:XX:XX:XX:XX:XX) once the
 * user confirms, or null if they cancel. Safe to call from non-React BLE connection code.
 */
export function requestMacFromUser(opts: RequestMacOptions = {}): Promise<string | null> {
	return new Promise((resolve) => {
		if (typeof window === 'undefined') {
			resolve(null);
			return;
		}

		const store = getStore();
		let settled = false;
		const finish = (mac: string | null) => {
			if (settled) return;
			settled = true;
			resolve(mac);
		};

		store.dispatch(
			openModal(
				<MacInputModal defaultMac={opts.defaultMac} deviceName={opts.deviceName} />,
				{
					width: 440,
					hideCloseButton: true,
					// Modal injects onComplete/onClose into MacInputModal; we mirror them here.
					onComplete: (mac: string) => finish(mac),
					onClose: () => finish(null),
				}
			)
		);
	});
}
