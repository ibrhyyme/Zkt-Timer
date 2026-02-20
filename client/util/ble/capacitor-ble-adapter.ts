import { BleClient } from '@capacitor-community/bluetooth-le';
import { BleAdapter, BleDevice, BleRequestDeviceOptions } from './ble-adapter';

export class CapacitorBleAdapter implements BleAdapter {
	private initialized = false;
	private disconnectCallbacks = new Map<string, () => void>();
	private scanRejectFn: ((reason: Error) => void) | null = null;
	private scanTimeoutId: ReturnType<typeof setTimeout> | null = null;
	private scanResolved = false;

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			console.log('[BLE] CapacitorBleAdapter: initializing BleClient...');
			await BleClient.initialize({ androidNeverForLocation: true });
			this.initialized = true;
			console.log('[BLE] CapacitorBleAdapter: initialized successfully');
		}
	}

	abortScan(): void {
		if (!this.scanResolved) {
			this.scanResolved = true;
			if (this.scanTimeoutId) {
				clearTimeout(this.scanTimeoutId);
				this.scanTimeoutId = null;
			}
			BleClient.stopLEScan();
			if (this.scanRejectFn) {
				this.scanRejectFn(new Error('BLE_SCAN_ABORTED'));
				this.scanRejectFn = null;
			}
		}
	}

	async requestDevice(options: BleRequestDeviceOptions): Promise<BleDevice> {
		await this.ensureInitialized();

		this.scanResolved = false;
		this.scanRejectFn = null;
		this.scanTimeoutId = null;

		const excludeIds = new Set(options.excludeDeviceIds || []);
		console.log('[BLE] CapacitorBleAdapter: scanning with nameFilters:', options.nameFilters,
			excludeIds.size > 0 ? 'excluding:' : '', excludeIds.size > 0 ? [...excludeIds] : '');

		return new Promise<BleDevice>(async (resolve, reject) => {
			this.scanRejectFn = reject;

			this.scanTimeoutId = setTimeout(() => {
				if (!this.scanResolved) {
					this.scanResolved = true;
					this.scanRejectFn = null;
					BleClient.stopLEScan();
					reject(new Error('BLE_SCAN_TIMEOUT'));
				}
			}, 15000);

			try {
				await BleClient.requestLEScan(
					{ allowDuplicates: false },
					(result) => {
						if (this.scanResolved) return;

						const name = result.device.name || result.localName || '';
						if (!name) return;

						if (excludeIds.has(result.device.deviceId)) return;

						const matches = options.nameFilters.some(
							(prefix) =>
								name.startsWith(prefix) ||
								name.toLowerCase().startsWith(prefix.toLowerCase())
						);

						if (matches) {
							this.scanResolved = true;
							if (this.scanTimeoutId) {
								clearTimeout(this.scanTimeoutId);
								this.scanTimeoutId = null;
							}
							this.scanRejectFn = null;
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
				if (!this.scanResolved) {
					this.scanResolved = true;
					if (this.scanTimeoutId) {
						clearTimeout(this.scanTimeoutId);
						this.scanTimeoutId = null;
					}
					this.scanRejectFn = null;
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
