import { BleClient } from '@capacitor-community/bluetooth-le';
import { BleAdapter, BleDevice, BleRequestDeviceOptions } from './ble-adapter';

export class CapacitorBleAdapter implements BleAdapter {
	private initialized = false;
	private disconnectCallbacks = new Map<string, () => void>();

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			console.log('[BLE] CapacitorBleAdapter: initializing BleClient...');
			await BleClient.initialize({ androidNeverForLocation: true });
			this.initialized = true;
			console.log('[BLE] CapacitorBleAdapter: initialized successfully');
		}
	}

	async requestDevice(options: BleRequestDeviceOptions): Promise<BleDevice> {
		await this.ensureInitialized();

		console.log('[BLE] CapacitorBleAdapter: scanning with nameFilters:', options.nameFilters);

		return new Promise<BleDevice>(async (resolve, reject) => {
			let resolved = false;

			const timeout = setTimeout(() => {
				if (!resolved) {
					resolved = true;
					BleClient.stopLEScan();
					reject(new Error('BLE taramasi zaman asimina ugradi. Kubun acik ve yakin oldugundan emin olun.'));
				}
			}, 15000);

			try {
				await BleClient.requestLEScan(
					{ allowDuplicates: false },
					(result) => {
						if (resolved) return;

						const name = result.device.name || result.localName || '';
						if (!name) return;

						const matches = options.nameFilters.some(
							(prefix) =>
								name.startsWith(prefix) ||
								name.toLowerCase().startsWith(prefix.toLowerCase())
						);

						if (matches) {
							resolved = true;
							clearTimeout(timeout);
							BleClient.stopLEScan();
							console.log('[BLE] Matching device found:', name, result.device.deviceId);
							resolve({
								deviceId: result.device.deviceId,
								name: name,
							});
						}
					}
				);
			} catch (error) {
				if (!resolved) {
					resolved = true;
					clearTimeout(timeout);
					reject(error);
				}
			}
		});
	}

	async connect(device: BleDevice, onDisconnect?: () => void): Promise<void> {
		await this.ensureInitialized();

		if (onDisconnect) {
			this.disconnectCallbacks.set(device.deviceId, onDisconnect);
		}

		await BleClient.connect(device.deviceId, (deviceId) => {
			const cb = this.disconnectCallbacks.get(deviceId);
			if (cb) {
				cb();
				this.disconnectCallbacks.delete(deviceId);
			}
		});
	}

	async disconnect(device: BleDevice): Promise<void> {
		try {
			await BleClient.disconnect(device.deviceId);
		} catch (e) {
			// Zaten bağlı değilse hata vermez
		}
		this.disconnectCallbacks.delete(device.deviceId);
	}

	async getServices(device: BleDevice): Promise<string[]> {
		const services = await BleClient.getServices(device.deviceId);
		return services.map((s) => s.uuid);
	}

	async readCharacteristic(device: BleDevice, serviceUuid: string, characteristicUuid: string): Promise<DataView> {
		const result = await BleClient.read(device.deviceId, serviceUuid, characteristicUuid);
		return result;
	}

	async writeCharacteristic(device: BleDevice, serviceUuid: string, characteristicUuid: string, data: ArrayBuffer): Promise<void> {
		await BleClient.write(device.deviceId, serviceUuid, characteristicUuid, new DataView(data));
	}

	async startNotifications(
		device: BleDevice,
		serviceUuid: string,
		characteristicUuid: string,
		callback: (value: DataView) => void
	): Promise<void> {
		await BleClient.startNotifications(device.deviceId, serviceUuid, characteristicUuid, callback);
	}

	async stopNotifications(device: BleDevice, serviceUuid: string, characteristicUuid: string): Promise<void> {
		await BleClient.stopNotifications(device.deviceId, serviceUuid, characteristicUuid);
	}

	async watchAdvertisements(_device: BleDevice): Promise<Map<number, DataView> | null> {
		// Capacitor BLE plugin watchAdvertisements desteklemiyor
		// Android'de deviceId zaten MAC adresi
		return null;
	}
}
