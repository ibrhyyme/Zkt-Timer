import SmartCube from './smart_cube';
import { isEqual } from 'lodash';
import LZString from './lz_string';
import aes128 from './ae128';

import {
	connectGanCube,
} from 'gan-web-bluetooth';

export default class GAN extends SmartCube {
	device;

	constructor(device) {
		super();

		this.device = device;
	}

	customMacAddressProvider = async (device, isFallbackCall) => {
		const CACHE_KEY = 'gan_cube_mac';
		const cachedMac = localStorage.getItem(CACHE_KEY);

		// If we have a cached MAC and this is NOT a fallback call (meaning first attempt), try using it.
		// If it's a fallback call, it means the first attempt (potentially with cached MAC) failed, so we must ask.
		if (cachedMac && !isFallbackCall) {
			return cachedMac;
		}

		let macAddress;
		if (isFallbackCall) {
			// If fallback, pre-fill prompt with cached one if available, or empty
			macAddress = prompt('Unable do determine cube MAC address!\nPlease enter MAC address manually:', cachedMac || '');
		} else {
			macAddress =
				typeof device.watchAdvertisements == 'function'
					? null
					: prompt(
						'Seems like your browser does not support Web Bluetooth watchAdvertisements() API. Enable following flag in Chrome:\n\nchrome://flags/#enable-experimental-web-platform-features\n\nor enter cube MAC address manually:',
						cachedMac || ''
					);
		}

		if (macAddress) {
			const cleanedMac = macAddress.trim().toUpperCase();
			localStorage.setItem(CACHE_KEY, cleanedMac);
			return cleanedMac;
		}
		return macAddress;
	};

	init = async () => {
		try {
			console.log('Attempting to connect to Gan cube...');
			this.conn = await connectGanCube(async (device, isFallback) => {
				const mac = await this.customMacAddressProvider(device, isFallback);
				console.log('MAC Address provided:', mac);
				return mac;
			}, this.device);

			this.conn.events$.subscribe(this.handleCubeEvent);

			await this.conn.sendCubeCommand({ type: "REQUEST_BATTERY" });
			await this.conn.sendCubeCommand({ type: "REQUEST_HARDWARE" });

			// Not: alertConnected artık HARDWARE event'i alındıktan sonra çağrılıyor
		} catch (error) {
			console.error('Gan connection error:', error);
			alert(`Connection failed: ${error.message || error}`);
			this.alertDisconnected();
		}
	};

	handleCubeEvent = (event) => {
		if (event.type == 'MOVE') {
			if (event.move) {
				this.alertTurnCube(event.move);
			} else {
				console.warn('Move event received but no move property found:', event);
			}
		} else if (event.type == 'GYRO') {
			// Jiroskop verilerini işle
			if (event.quaternion) {
				this.alertGyroData(event.quaternion, event.velocity);
			}
		} else if (event.type == 'HARDWARE') {
			this.hardwareName = event.hardwareName;
			this.hardwareVersion = event.hardwareVersion;
			this.softwareVersion = event.softwareVersion;
			this.productDate = event.productDate;
			this.gyroSupported = event.gyroSupported;
			// Jiroskop desteği durumunu bildir
			this.alertGyroSupported(event.gyroSupported);

			// HARDWARE bilgisi alındıktan sonra bağlantıyı tamamla
			const deviceId = this.conn?.deviceMAC || this.device?.id || 'unknown';
			const dummyServer = {
				device: {
					name: this.hardwareName || this.device?.name || 'GAN Cube',
					id: deviceId
				}
			};
			this.alertConnected(dummyServer);
		} else if (event.type == 'BATTERY') {
			this.alertBatteryLevel(event.batteryLevel);
		} else if (event.type == 'DISCONNECT') {
			this.alertDisconnected();
		}
	};
}

