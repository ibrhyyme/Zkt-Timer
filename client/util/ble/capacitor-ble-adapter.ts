import { BleClient } from '@capacitor-community/bluetooth-le';
import { BleAdapter, BleDevice, BleRequestDeviceOptions, BleScannedDevice } from './ble-adapter';

interface ScannedEntry {
	name: string;
	rssi: number | null;
	manufacturerData?: Map<number, DataView>;
}

export class CapacitorBleAdapter implements BleAdapter {
	private initialized = false;
	private disconnectCallbacks = new Map<string, () => void>();
	private scanRejectFn: ((reason: Error) => void) | null = null;
	private scanTimeoutId: ReturnType<typeof setTimeout> | null = null;
	private scanResolved = false;
	// Devices collected during the current scan (deviceId -> entry). The user picks one
	// from this set via selectScannedDevice; we no longer auto-connect to the first match.
	private scannedDevices = new Map<string, ScannedEntry>();
	private selectionResolve: ((device: BleDevice) => void) | null = null;
	private onScanUpdate?: (devices: BleScannedDevice[]) => void;

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
		}

		// Always re-check — Bluetooth can be toggled off AFTER the adapter was first initialized.
		// Gating this behind `!initialized` meant a later scan could start with BT off and just
		// hang on "scanning" without telling the user (Android doesn't auto-prompt like iOS).
		const enabled = await BleClient.isEnabled();
		if (!enabled) {
			console.error('[BLE] CapacitorBleAdapter: Bluetooth is disabled');
			throw new Error('BLE_DISABLED');
		}
	}

	abortScan(): void {
		if (!this.scanResolved) {
			this.scanResolved = true;
			if (this.scanTimeoutId) {
				clearTimeout(this.scanTimeoutId);
				this.scanTimeoutId = null;
			}
			this.selectionResolve = null;
			BleClient.stopLEScan();
			if (this.scanRejectFn) {
				this.scanRejectFn(new Error('BLE_SCAN_ABORTED'));
				this.scanRejectFn = null;
			}
		}
	}

	// Confirms the user's choice from the scan list. Resolves the pending requestDevice.
	selectScannedDevice(deviceId: string): void {
		const entry = this.scannedDevices.get(deviceId);
		if (!entry || !this.selectionResolve) return;
		console.log('[BLE] User selected device:', entry.name, deviceId);
		this.selectionResolve({
			deviceId,
			name: entry.name,
			manufacturerData: entry.manufacturerData,
		});
	}

	private emitScanUpdate(): void {
		if (!this.onScanUpdate) return;
		const list: BleScannedDevice[] = [...this.scannedDevices.entries()]
			.map(([id, d]) => ({ deviceId: id, name: d.name, rssi: d.rssi }))
			// Strongest signal first (closest device). Null rssi sinks to the bottom.
			.sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
		this.onScanUpdate(list);
	}

	async requestDevice(options: BleRequestDeviceOptions): Promise<BleDevice> {
		await this.ensureInitialized();

		this.scanResolved = false;
		this.scanRejectFn = null;
		this.scanTimeoutId = null;
		this.scannedDevices = new Map();
		this.selectionResolve = null;
		this.onScanUpdate = options.onScanUpdate;

		const excludeIds = new Set(options.excludeDeviceIds || []);
		console.log('[BLE] CapacitorBleAdapter: scanning with nameFilters:', options.nameFilters,
			excludeIds.size > 0 ? 'excluding:' : '', excludeIds.size > 0 ? [...excludeIds] : '');

		return new Promise<BleDevice>(async (resolve, reject) => {
			this.scanRejectFn = reject;

			// Resolve the scan once the user picks a device (no more auto-connect to first match).
			this.selectionResolve = (device: BleDevice) => {
				if (this.scanResolved) return;
				this.scanResolved = true;
				if (this.scanTimeoutId) {
					clearTimeout(this.scanTimeoutId);
					this.scanTimeoutId = null;
				}
				this.scanRejectFn = null;
				this.selectionResolve = null;
				BleClient.stopLEScan();
				resolve(device);
			};

			// Safety timeout: if the user never picks and never cancels, give up eventually.
			this.scanTimeoutId = setTimeout(() => {
				if (!this.scanResolved) {
					console.warn('[BLE] 60s scan TIMEOUT — no selection');
					this.scanResolved = true;
					this.scanRejectFn = null;
					this.selectionResolve = null;
					BleClient.stopLEScan();
					reject(new Error('BLE_SCAN_TIMEOUT'));
				}
			}, 60000);

			try {
				console.log('[BLE] Starting requestLEScan...');
				await BleClient.requestLEScan(
					// allowDuplicates so RSSI refreshes and late-advertising devices still appear.
					{ allowDuplicates: true },
					(result) => {
						if (this.scanResolved) return;

						const name = result.device.name || result.localName || '';
						const deviceId = result.device.deviceId;
						if (!name) return;
						if (excludeIds.has(deviceId)) return;

						// acceptAll: bypass name filters (debug feature)
						const matches = options.acceptAll
							? true
							: options.nameFilters.some(
								(prefix) =>
									name.startsWith(prefix) ||
									name.toLowerCase().startsWith(prefix.toLowerCase())
							);
						if (!matches) return;

						// Capture/refresh manufacturer data (needed for real MAC address discovery).
						let mfData: Map<number, DataView> | undefined;
						const rawMf = (result as any).manufacturerData;
						if (rawMf && typeof rawMf === 'object') {
							mfData = new Map<number, DataView>();
							for (const [key, value] of Object.entries(rawMf)) {
								if (value instanceof DataView) {
									mfData.set(Number(key), value);
								}
							}
						}

						const rssi = typeof (result as any).rssi === 'number' ? (result as any).rssi : null;
						const existing = this.scannedDevices.get(deviceId);
						const newRssi = rssi ?? existing?.rssi ?? null;

						// allowDuplicates fires per advertisement (many/sec). Only re-emit to Redux
						// when the list visibly changes — a new device, a rename, or a signal change
						// big enough to matter (~one bar). Small RSSI jitter is absorbed silently.
						const isNew = !existing;
						const nameChanged = !!existing && existing.name !== name;
						const rssiChanged = !!existing && Math.abs((existing.rssi ?? -100) - (newRssi ?? -100)) >= 8;

						this.scannedDevices.set(deviceId, {
							name,
							rssi: newRssi,
							manufacturerData: (mfData && mfData.size > 0) ? mfData : existing?.manufacturerData,
						});

						if (isNew || nameChanged || rssiChanged) {
							// Surface the live list to the UI (sorted strongest-first).
							this.emitScanUpdate();
						}
					}
				);
				console.log('[BLE] requestLEScan active — collecting devices, waiting for user selection');
			} catch (error) {
				console.error('[BLE] requestLEScan ERROR:', error);
				if (!this.scanResolved) {
					this.scanResolved = true;
					if (this.scanTimeoutId) {
						clearTimeout(this.scanTimeoutId);
						this.scanTimeoutId = null;
					}
					this.scanRejectFn = null;
					this.selectionResolve = null;
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
