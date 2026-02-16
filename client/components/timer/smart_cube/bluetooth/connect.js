import Particula from './particula';
import SmartCube from './smart_cube';
import GAN from './gan';
import Giiker from './giiker';
import { getBleAdapter } from '../../../../util/ble';
import { isNative } from '../../../../util/platform';

export default class Connect extends SmartCube {
	device = null;
	adapter = null;

	connect = async () => {
		try {
			console.log('[BLE] connect() called, isNative:', isNative());
			this.adapter = await getBleAdapter();
			console.log('[BLE] adapter type:', this.adapter.constructor.name);

			const device = await this.adapter.requestDevice({
				nameFilters: ['Gi', 'Mi Smart Magic Cube', 'GAN', 'Gan', 'gan', 'GoCube', 'Rubiks'],
				serviceFilters: [
					// Giiker
					'0000aadb-0000-1000-8000-00805f9b34fb',
					'0000aaaa-0000-1000-8000-00805f9b34fb',
					'0000fe95-0000-1000-8000-00805f9b34fb',
					// Gan
					'0000fff0-0000-1000-8000-00805f9b34fb',
					'00001805-0000-1000-8000-00805f9b34fb',
				],
				optionalServices: [
					'0000180a-0000-1000-8000-00805f9b34fb',
					'0000180f-0000-1000-8000-00805f9b34fb',
					'9fa480e0-4967-4542-9390-d343dc5d04ae',
					'00001805-0000-1000-8000-00805f9b34fb',
					'd0611e78-bbb4-4591-a5f8-487910ae4366',
					'6e400001-b5a3-f393-e0a9-e50e24dc4179',
					'f95a48e6-a721-11e9-a2a3-022ae2dbcce4',
					'battery_service',
					'generic_access',
					'device_information',
					...Particula.opServices,
					// GAN
					'0000fff0-0000-1000-8000-00805f9b34fb',
					'0000fff5-0000-1000-8000-00805f9b34fb',
					'0000fff7-0000-1000-8000-00805f9b34fb',
					'0000fff2-0000-1000-8000-00805f9b34fb',
					'0000fff3-0000-1000-8000-00805f9b34fb',
					'0000180a-0000-1000-8000-00805f9b34fb',
					'00002a23-0000-1000-8000-00805f9b34fb',
					'00002a28-0000-1000-8000-00805f9b34fb',
					'8653000a-43e6-47b7-9cb0-5fc21d4ae340',
					'00000010-0000-fff7-fff6-fff5fff4fff0',
					'00001805-0000-1000-8000-00805f9b34fb',
				],
			});

			console.log('[BLE] device found:', device.name, device.deviceId);
			this.device = device;
			this.alertConnecting();

			if (device.name.startsWith('Gi') || device.name.startsWith('Mi Smart Magic Cube')) {
				const cube = new Giiker(device, this.adapter);
				cube.init();
				this.activeCube = cube;
			} else if (device.name.toLowerCase().startsWith('gan')) {
				const cube = new GAN(device, this.adapter);
				cube.init();
				this.activeCube = cube;
			} else if (device.name.startsWith('GoCube') || device.name.startsWith('Rubiks')) {
				const cube = new Particula(device, this.adapter);
				cube.init();
				this.activeCube = cube;
			} else {
				return Promise.resolve();
			}
		} catch (error) {
			console.log('Bluetooth connection cancelled or failed:', error);
		}
	};

	disconnect = async () => {
		if (!this.device || !this.adapter) {
			return;
		}
		await this.adapter.disconnect(this.device);
		this.device = null;
	};
}
