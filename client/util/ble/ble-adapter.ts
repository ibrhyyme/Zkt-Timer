export interface BleDevice {
	deviceId: string;
	name: string;
	manufacturerData?: Map<number, DataView>;
}

/**
 * A device discovered during a scan, surfaced to the UI so the user can pick the right
 * one (native only — web uses the Chrome picker). rssi is the signal strength (closer =
 * stronger = less negative); null when the platform doesn't report it.
 */
export interface BleScannedDevice {
	deviceId: string;
	name: string;
	rssi: number | null;
}

export interface BleRequestDeviceOptions {
	nameFilters: string[];
	serviceFilters?: string[];
	optionalServices: string[];
	excludeDeviceIds?: string[];
	/**
	 * If true, name filters are bypassed, all BLE devices appear in the list.
	 * Debug feature for non-standard named cubes (clone, firmware update, odd variant).
	 */
	acceptAll?: boolean;
	/**
	 * Web only: company identifier codes whose manufacturer data the page needs to read.
	 * Chrome strips advertisement manufacturerData unless the matching CIC is declared here
	 * in requestDevice — without it watchAdvertisements yields no MAC and connection falls
	 * back to a (often wrong) name-derived guess. Native ignores this (it scans raw advs).
	 */
	optionalManufacturerData?: number[];
	/**
	 * Native only: called whenever the set of matching devices changes during a scan
	 * (sorted strongest-signal first). The UI shows these and the user selects one via
	 * BleAdapter.selectScannedDevice. Not called by the web adapter (Chrome picker handles it).
	 */
	onScanUpdate?: (devices: BleScannedDevice[]) => void;
}

export interface BleAdapter {
	requestDevice(options: BleRequestDeviceOptions): Promise<BleDevice>;
	connect(device: BleDevice, onDisconnect?: () => void): Promise<void>;
	disconnect(device: BleDevice): Promise<void>;
	getServices(device: BleDevice): Promise<string[]>;
	readCharacteristic(device: BleDevice, serviceUuid: string, characteristicUuid: string): Promise<DataView>;
	writeCharacteristic(device: BleDevice, serviceUuid: string, characteristicUuid: string, data: ArrayBuffer): Promise<void>;
	startNotifications(
		device: BleDevice,
		serviceUuid: string,
		characteristicUuid: string,
		callback: (value: DataView) => void
	): Promise<void>;
	stopNotifications(device: BleDevice, serviceUuid: string, characteristicUuid: string): Promise<void>;
	watchAdvertisements?(device: BleDevice): Promise<Map<number, DataView> | null>;
	abortScan?(): void;
	/**
	 * Native only: confirms the user's device choice during an active requestDevice scan.
	 * The pending requestDevice promise resolves with the chosen device. No-op on web.
	 */
	selectScannedDevice?(deviceId: string): void;
}
