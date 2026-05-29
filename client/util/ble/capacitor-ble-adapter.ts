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
			console.log('[BLE] CapacitorBleAdapter: initializing...');
			try {
				// iOS: This call automatically triggers Bluetooth permission dialog
				// Android: androidNeverForLocation: true prevents location permission request
				await BleClient.initialize({ androidNeverForLocation: true });
				this.initialized = true;
				console.log('[BLE] CapacitorBleAdapter: initialized successfully');
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				console.error('[BLE] CapacitorBleAdapter: initialize ERROR:', msg);
				if (msg.includes('permission') || msg.includes('unauthorized')) {
					throw new Error('BLE_PERMISSION_DENIED');
				}
				throw e;
			}

			const enabled = await BleClient.isEnabled();
			if (!enabled) {
				console.error('[BLE] CapacitorBleAdapter: Bluetooth is disabled');
				throw new Error('BLE_DISABLED');
			}
			console.log('[BLE] CapacitorBleAdapter: Bluetooth is enabled');
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
					console.warn('[BLE] 15s scan TIMEOUT — no devices found');
					this.scanResolved = true;
					this.scanRejectFn = null;
					BleClient.stopLEScan();
					reject(new Error('BLE_SCAN_TIMEOUT'));
				}
			}, 15000);

			try {
				console.log('[BLE] Starting requestLEScan...');
				await BleClient.requestLEScan(
					{ allowDuplicates: false },
					(result) => {
						if (this.scanResolved) return;

						const name = result.device.name || result.localName || '';
						const deviceId = result.device.deviceId;

						// Log all devices including unnamed ones
						console.log('[BLE] Device found:', {
							name: name || '(unnamed)',
							deviceId,
							rssi: (result as any).rssi ?? 'N/A',
							localName: result.localName || 'N/A',
						});

						if (!name) return;

						if (excludeIds.has(deviceId)) {
							console.log('[BLE] Device in exclude list, skipping:', name);
							return;
						}

						// acceptAll: bypass name filters (debug feature)
						const matches = options.acceptAll
							? true
							: options.nameFilters.some(
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

							// Capture manufacturer data (needed for real MAC address in GAN cubes)
							let mfData: Map<number, DataView> | undefined;
							const rawMf = (result as any).manufacturerData;
							if (rawMf && typeof rawMf === 'object') {
								mfData = new Map<number, DataView>();
								for (const [key, value] of Object.entries(rawMf)) {
									if (value instanceof DataView) {
										mfData.set(Number(key), value);
									}
								}
								if (mfData.size > 0) {
									console.log('[BLE] Manufacturer data captured, key count:', mfData.size);
								}
							}

							console.log('[BLE] MATCHING device found:', name, deviceId);
							resolve({
								deviceId: deviceId,
								name: name,
								manufacturerData: mfData,
							});
						} else {
							console.log('[BLE] Device name DOES NOT MATCH:', name, '| filters:', options.nameFilters);
						}
					}
				);
				console.log('[BLE] requestLEScan SUCCESSFUL — scan active, waiting 15s...');
			} catch (error) {
				console.error('[BLE] requestLEScan ERROR:', error);
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

		const MAX_GATT_RETRIES = 3;
		for (let attempt = 0; attempt < MAX_GATT_RETRIES; attempt++) {
			console.log(`[BLE] BleClient.connect attempt ${attempt + 1}/${MAX_GATT_RETRIES}:`, device.name, device.deviceId);
			try {
				if (attempt > 0) {
					// Wait for GATT stack to recover
					await new Promise((r) => setTimeout(r, 1000 + attempt * 500));
				}
				await BleClient.connect(device.deviceId, (deviceId) => {
					console.warn('[BLE] Device DISCONNECTED:', deviceId);
					const cb = this.disconnectCallbacks.get(deviceId);
					if (cb) {
						cb();
						this.disconnectCallbacks.delete(deviceId);
					}
				});
				console.log('[BLE] BleClient.connect SUCCESSFUL:', device.name);
				return;
			} catch (e) {
				console.error(`[BLE] BleClient.connect ERROR (attempt ${attempt + 1}):`, e);
				// Throw error on final attempt
				if (attempt === MAX_GATT_RETRIES - 1) {
					throw e;
				}
				// Clean up previous GATT instance
				try {
					await BleClient.disconnect(device.deviceId);
				} catch (_) {
					// ignore
				}
			}
		}
	}

	async disconnect(device: BleDevice): Promise<void> {
		try {
			await BleClient.disconnect(device.deviceId);
		} catch (e) {
			// Ignore error if already disconnected
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
		// @capacitor-community/bluetooth-le registers callback to native side before sending to bridge;
		// no race condition like in WebBleAdapter.
		await BleClient.startNotifications(device.deviceId, serviceUuid, characteristicUuid, callback);
	}

	async stopNotifications(device: BleDevice, serviceUuid: string, characteristicUuid: string): Promise<void> {
		await BleClient.stopNotifications(device.deviceId, serviceUuid, characteristicUuid);
	}

	async watchAdvertisements(device: BleDevice): Promise<Map<number, DataView> | null> {
		// Return manufacturer data captured during scan
		// Real MAC address is embedded in manufacturer data for GAN cubes
		if (device.manufacturerData && device.manufacturerData.size > 0) {
			console.log('[BLE] watchAdvertisements: returning manufacturer data captured during scan');
			return device.manufacturerData;
		}
		return null;
	}
}
